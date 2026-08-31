import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../server/db';
import { purgeRejectedRequestPii, PURGED_FIELDS } from '../../server/jobs/purgeRejectedPii';

/**
 * ข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธต้องถูกล้างอัตโนมัติหลัง 90 วัน
 *
 * ระบบเก็บเลขบัตรและรูปบัตรไว้เพื่อให้แอดมินตรวจตัวตนตอนพิจารณา
 * เมื่อปฏิเสธไปแล้วและเวลาผ่านไปพอสมควร ก็ไม่มีเหตุผลให้เก็บต่อ
 *
 * นับจาก reviewed_at ซึ่งเป็นวันที่ปฏิเสธ ไม่ใช่ created_at ที่เป็นวันยื่น
 * คำขอที่ยื่นนานแล้วแต่เพิ่งถูกปฏิเสธเมื่อวาน ยังต้องเก็บข้อมูลไว้
 *
 * needs_revision ใช้ปุ่มเดียวกับ rejected และเซ็ต reviewed_at เหมือนกัน
 * แต่แปลว่าให้ผู้ใช้แก้แล้วส่งกลับมา ไม่ใช่การปฏิเสธ ถ้ากวาดรวมไปด้วย
 * จะไปลบข้อมูลของคนที่กำลังแก้คำขออยู่ แล้วเขาจะส่งกลับมาไม่ได้
 */

const SUFFIX = Date.now().toString(36);
const PREFIX = `purge_test_${SUFFIX}`;

/** สร้างคำขอตรง ๆ ที่ฐาน เพื่อกำหนด reviewed_at ย้อนหลังได้ */
async function seedRequest(opts: {
  key: string;
  status: string;
  reviewedDaysAgo: number | null;
}): Promise<string> {
  const id = `${PREFIX}_${opts.key}`;
  await pool.query(
    `INSERT INTO farm_requests (
       id, user_id, user_display_name, user_email_or_username,
       farm_name, province, status, reviewed_at, reviewed_by, admin_notes,
       farmer_full_name, bank_account_name, location_address, google_maps_url,
       about_story, cert_document_photo, farmer_id_card_file_type,
       farmer_id_card_ciphertext, farmer_id_card_photo_ciphertext,
       farmer_id_card_check_digit, payload
     ) VALUES (
       $1, $2, 'ผู้ยื่นทดสอบ', 'tester@example.com',
       $3, 'จันทบุรี', $4,
       CASE WHEN $5::int IS NULL THEN NULL ELSE now() - make_interval(days => $5::int) END,
       'แอดมินทดสอบ', 'เอกสารไม่ครบ',
       'นายทดสอบ ถูกปฏิเสธ', 'ธนาคารทดสอบ 123', 'บ้านเลขที่ 1', 'https://maps.example/x',
       'เรื่องราวสวน', 'data:image/jpeg;base64,Q0VSVA==', 'image',
       $6, $7, '8', '{"secret":"x"}'::jsonb
     )`,
    [
      id,
      `${PREFIX}_user`,
      `สวนทดสอบล้างข้อมูล ${opts.key}`,
      opts.status,
      opts.reviewedDaysAgo,
      Buffer.from('id-ciphertext'),
      Buffer.from('photo-ciphertext'),
    ]
  );
  return id;
}

async function readRow(id: string) {
  const { rows } = await pool.query(`SELECT * FROM farm_requests WHERE id = $1`, [id]);
  return rows[0];
}

let oldRejected = '';
let freshRejected = '';
let oldNeedsRevision = '';
let oldApproved = '';
let oldPending = '';

beforeAll(async () => {
  await pool.query(`DELETE FROM farm_requests WHERE id LIKE $1`, [`${PREFIX}%`]);

  oldRejected = await seedRequest({ key: 'old_rejected', status: 'rejected', reviewedDaysAgo: 120 });
  freshRejected = await seedRequest({ key: 'fresh_rejected', status: 'rejected', reviewedDaysAgo: 30 });
  oldNeedsRevision = await seedRequest({
    key: 'old_needs_revision',
    status: 'needs_revision',
    reviewedDaysAgo: 200,
  });
  oldApproved = await seedRequest({ key: 'old_approved', status: 'approved', reviewedDaysAgo: 400 });
  oldPending = await seedRequest({ key: 'old_pending', status: 'pending', reviewedDaysAgo: null });
});

afterAll(async () => {
  await pool.query(`DELETE FROM data_retention_log WHERE farm_request_id LIKE $1`, [`${PREFIX}%`]);
  await pool.query(`DELETE FROM farm_requests WHERE id LIKE $1`, [`${PREFIX}%`]);
  await pool.end();
});

describe('ล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธเกิน 90 วัน', () => {
  test('โหมดดูอย่างเดียว บอกรายการที่จะถูกล้าง แต่ไม่แก้อะไรจริง', async () => {
    const result = await purgeRejectedRequestPii({ apply: false });

    expect(result.candidates.map((c) => c.id)).toContain(oldRejected);
    expect(result.purgedCount).toBe(0);

    const row = await readRow(oldRejected);
    expect(row.farmer_id_card_ciphertext).not.toBeNull();
  });

  test('ล้างจริงแล้วข้อมูลส่วนตัวหายครบทุกฟิลด์', async () => {
    const result = await purgeRejectedRequestPii({ apply: true });
    expect(result.purgedCount).toBeGreaterThanOrEqual(1);

    const row = await readRow(oldRejected);
    for (const field of PURGED_FIELDS) {
      // payload เป็น NOT NULL จึงล้างเป็นวัตถุว่างแทนการเซ็ต null
      const expected = field === 'payload' ? {} : null;
      expect({ field, value: row[field] }).toEqual({ field, value: expected });
    }
  });

  test('ร่องรอยการตัดสินยังอยู่ครบ ตอบผู้ใช้ย้อนหลังได้', async () => {
    const row = await readRow(oldRejected);

    expect(row.status).toBe('rejected');
    expect(row.reviewed_by).toBe('แอดมินทดสอบ');
    expect(row.admin_notes).toBe('เอกสารไม่ครบ');
    expect(row.reviewed_at).not.toBeNull();
    expect(row.province).toBe('จันทบุรี');
  });

  test('คำขอที่เพิ่งถูกปฏิเสธ 30 วัน ต้องไม่ถูกแตะ', async () => {
    const row = await readRow(freshRejected);

    expect(row.farmer_id_card_ciphertext).not.toBeNull();
    expect(row.farmer_full_name).toBe('นายทดสอบ ถูกปฏิเสธ');
  });

  test('needs_revision ต้องไม่ถูกแตะ แม้ผ่านมา 200 วัน', async () => {
    // ตีกลับให้แก้ ไม่ใช่ปฏิเสธ ถ้าล้างข้อมูลไป เจ้าของจะส่งกลับมาไม่ได้
    const row = await readRow(oldNeedsRevision);

    expect(row.farmer_id_card_ciphertext).not.toBeNull();
    expect(row.farmer_id_card_photo_ciphertext).not.toBeNull();
    expect(row.farmer_full_name).toBe('นายทดสอบ ถูกปฏิเสธ');
  });

  test('คำขอที่อนุมัติแล้วและที่ยังรอตรวจ ต้องไม่ถูกแตะ', async () => {
    for (const id of [oldApproved, oldPending]) {
      const row = await readRow(id);
      expect({ id, cipher: row.farmer_id_card_ciphertext === null }).toEqual({ id, cipher: false });
    }
  });

  test('บันทึกไว้ว่าล้างอะไรของแถวไหนเมื่อไหร่', async () => {
    const { rows } = await pool.query(
      `SELECT farm_request_id, fields_cleared, trigger_source, rejected_at, purged_at
         FROM data_retention_log WHERE farm_request_id = $1`,
      [oldRejected]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].fields_cleared.sort()).toEqual([...PURGED_FIELDS].sort());
    expect(rows[0].purged_at).not.toBeNull();
    expect(rows[0].rejected_at).not.toBeNull();
  });

  test('บันทึกต้องไม่เก็บค่าที่ลบไป ไม่งั้นกลายเป็นที่เก็บข้อมูลอ่อนไหวแห่งใหม่', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM data_retention_log WHERE farm_request_id = $1`,
      [oldRejected]
    );
    const serialized = JSON.stringify(rows[0]);

    // ตรวจค่าจริงที่ถูกลบ ไม่ใช่ชื่อคอลัมน์
    // fields_cleared เก็บชื่อคอลัมน์ซึ่งมีคำว่า ciphertext อยู่ในตัวมันเองอยู่แล้ว
    expect(serialized).not.toContain('นายทดสอบ ถูกปฏิเสธ');
    expect(serialized).not.toContain('ธนาคารทดสอบ');
    expect(serialized).not.toContain('tester@example.com');
    expect(serialized).not.toContain('id-ciphertext');
    expect(serialized).not.toContain('photo-ciphertext');
    expect(serialized).not.toContain('maps.example');
  });

  test('รันซ้ำแล้วไม่ล้างซ้ำ และไม่เพิ่มบันทึกซ้ำ', async () => {
    const again = await purgeRejectedRequestPii({ apply: true });
    expect(again.candidates.map((c) => c.id)).not.toContain(oldRejected);

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM data_retention_log WHERE farm_request_id = $1`,
      [oldRejected]
    );
    expect(rows[0].n).toBe(1);
  });
});
