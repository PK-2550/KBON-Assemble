import { pool } from '../db.js';

/**
 * ล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธ หลังผ่านไปตามกำหนดเวลาเก็บ
 *
 * เก็บแถวไว้ ล้างเฉพาะฟิลด์ที่ระบุตัวบุคคล เพราะร่องรอยการตัดสินของแอดมิน
 * ยังมีค่า ถ้าเจ้าของคำขอถามย้อนหลังว่าทำไมถูกปฏิเสธ ต้องตอบได้
 *
 * นับจาก reviewed_at ซึ่งเป็นวันที่ปฏิเสธ ไม่ใช่ created_at ที่เป็นวันยื่น
 * คำขอที่ยื่นไว้นานแล้วแต่เพิ่งถูกปฏิเสธเมื่อวาน ยังต้องเก็บข้อมูลไว้เต็ม
 */

/** กำหนดเวลาเก็บข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธ */
export const RETENTION_DAYS = 90;

/**
 * ฟิลด์ที่ถูกล้าง
 *
 * เลขบัตรกับรูปบัตรเป็นของอ่อนไหวที่สุด แต่ล้างแค่สองอย่างนั้นไม่พอ
 * ชื่อจริง เลขบัญชีธนาคาร ที่อยู่ และพิกัด ก็ระบุตัวบุคคลได้เหมือนกัน
 *
 * payload เก็บสำเนาของสิ่งที่ฟอร์มส่งมาทั้งก้อน จึงมีข้อมูลส่วนตัวซ้ำอยู่ข้างใน
 * ถ้าลืมล้างตรงนี้ การล้างคอลัมน์อื่นแทบไม่มีความหมาย
 */
export const PURGED_FIELDS = [
  'farmer_id_card_ciphertext',
  'farmer_id_card_photo_ciphertext',
  'farmer_id_card_check_digit',
  'farmer_id_card_file_type',
  'farmer_full_name',
  'bank_account_name',
  'user_display_name',
  'user_email_or_username',
  'location_address',
  'google_maps_url',
  'about_story',
  'cert_document_photo',
  'payload',
] as const;

/**
 * กุญแจของ advisory lock
 *
 * กันไม่ให้งานนี้รันซ้อนกันเอง ใช้ล็อกที่ฐานข้อมูลไม่ใช่ตัวแปรในหน่วยความจำ
 * เพราะตัวแปรกันได้แค่ภายใน process เดียว วันที่มีเซิร์ฟเวอร์หลายตัวจะกันไม่อยู่
 */
const LOCK_KEY = 771_090_113;

export interface PurgeCandidate {
  id: string;
  farmName: string;
  rejectedAt: Date;
}

export interface PurgeResult {
  /** แถวที่เข้าเงื่อนไข -- โหมดดูอย่างเดียวก็ได้รายการนี้ */
  candidates: PurgeCandidate[];
  /** ล้างไปจริงกี่แถว โหมดดูอย่างเดียวเป็น 0 เสมอ */
  purgedCount: number;
  /** ไม่ได้ทำอะไรเพราะมีอีกที่หนึ่งกำลังรันอยู่ */
  skippedLocked: boolean;
}

export interface PurgeOptions {
  apply?: boolean;
  trigger?: 'auto' | 'manual';
  retentionDays?: number;
}

/**
 * แถวที่ถูกล้างไปแล้วจะไม่เข้าเงื่อนไขอีก เพราะดูจากตัวข้อมูลเองว่ายังเหลืออะไร
 * ไม่ได้ดูจากธงที่ต้องคอยตั้งค่า การรันซ้ำจึงไม่ล้างซ้ำและไม่เพิ่มบันทึกซ้ำ
 * โดยไม่ต้องมีสถานะแยกให้หลุดกันได้
 */
const STILL_HAS_PII = PURGED_FIELDS.filter((f) => f !== 'payload')
  .map((f) => `${f} IS NOT NULL`)
  .concat(`payload <> '{}'::jsonb`)
  .join(' OR ');

export async function purgeRejectedRequestPii(
  options: PurgeOptions = {}
): Promise<PurgeResult> {
  const { apply = false, trigger = 'manual', retentionDays = RETENTION_DAYS } = options;

  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [LOCK_KEY]
    );
    if (!lock.rows[0].locked) {
      return { candidates: [], purgedCount: 0, skippedLocked: true };
    }

    try {
      const { rows } = await client.query<{ id: string; farm_name: string; reviewed_at: Date }>(
        `SELECT id, farm_name, reviewed_at
           FROM farm_requests
          WHERE status = 'rejected'
            AND reviewed_at IS NOT NULL
            AND reviewed_at < now() - make_interval(days => $1::int)
            AND (${STILL_HAS_PII})
          ORDER BY reviewed_at`,
        [retentionDays]
      );

      const candidates: PurgeCandidate[] = rows.map((r) => ({
        id: r.id,
        farmName: r.farm_name,
        rejectedAt: r.reviewed_at,
      }));

      if (!apply || candidates.length === 0) {
        return { candidates, purgedCount: 0, skippedLocked: false };
      }

      const ids = candidates.map((c) => c.id);

      // ล้างกับบันทึกอยู่ใน transaction เดียวกัน ไม่งั้นอาจล้างสำเร็จแล้วบันทึกล้ม
      // เหลือข้อมูลหายโดยไม่มีร่องรอยว่าใครล้างเมื่อไหร่
      await client.query('BEGIN');

      const setClause = PURGED_FIELDS.map((f) =>
        f === 'payload' ? `payload = '{}'::jsonb` : `${f} = NULL`
      ).join(', ');

      const updated = await client.query(
        `UPDATE farm_requests SET ${setClause} WHERE id = ANY($1)`,
        [ids]
      );

      await client.query(
        `INSERT INTO data_retention_log
           (farm_request_id, fields_cleared, rejected_at, trigger_source)
         SELECT id, $2::text[], reviewed_at, $3
           FROM farm_requests WHERE id = ANY($1)`,
        [ids, [...PURGED_FIELDS], trigger]
      );

      await client.query('COMMIT');

      return { candidates, purgedCount: updated.rowCount ?? 0, skippedLocked: false };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * ตั้งเวลาให้เซิร์ฟเวอร์เรียกงานล้างเองวันละครั้ง
 *
 * ปิดได้ด้วย PURGE_REJECTED_PII=off สำหรับเครื่องที่ไม่ควรแตะข้อมูล
 * เช่นตอนรันชุดทดสอบหรือเครื่องที่ต่อฐานสำเนา
 *
 * ไม่ปล่อยให้ error หลุดออกไป งานเบื้องหลังล้มต้องไม่ทำให้เซิร์ฟเวอร์ตาย
 */
export function scheduleRejectedPiiPurge(): NodeJS.Timeout | null {
  if (process.env.PURGE_REJECTED_PII === 'off') {
    console.log('งานล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธ: ปิดไว้ด้วย PURGE_REJECTED_PII=off');
    return null;
  }

  const runOnce = () => {
    purgeRejectedRequestPii({ apply: true, trigger: 'auto' })
      .then((r) => {
        if (r.skippedLocked) return;
        if (r.purgedCount > 0) {
          console.log(
            `ล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธเกิน ${RETENTION_DAYS} วัน แล้ว ${r.purgedCount} แถว`
          );
        }
      })
      .catch((err) => {
        console.error('งานล้างข้อมูลส่วนตัวล้มเหลว:', err instanceof Error ? err.message : err);
      });
  };

  runOnce();

  const timer = setInterval(runOnce, 24 * 60 * 60 * 1000);
  // ไม่ให้ timer ค้าง event loop ไว้ ไม่งั้นสั่งปิดเซิร์ฟเวอร์แล้วไม่ยอมจบ
  timer.unref();
  return timer;
}
