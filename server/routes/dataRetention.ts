import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { RETENTION_DAYS, STILL_HAS_PII } from '../jobs/purgeRejectedPii.js';

/**
 * รายงานการล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธ
 *
 * 013 สร้างตารางบันทึกไว้เพื่อให้ตอบได้ว่าข้อมูลหายไปเพราะถูกล้างตามกำหนด
 * ไม่ใช่หายเพราะบั๊ก แต่บันทึกนั้นอ่านได้ทาง SQL ทางเดียว ซึ่งแปลว่าเวลามีคน
 * ถามจริง ๆ ก็ยังตอบไม่ได้อยู่ดี
 *
 * แอดมินเท่านั้น บันทึกนี้บอกว่าคำขอไหนเคยมีข้อมูลส่วนตัวอะไรอยู่
 * ซึ่งไม่ใช่ของสาธารณะแม้ตัวข้อมูลจะถูกลบไปแล้ว
 */
export const dataRetentionRouter = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

dataRetentionRouter.get(
  '/log',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const asked = Number(req.query.limit);
    const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, MAX_LIMIT) : DEFAULT_LIMIT;

    /*
      สถานะของงานล้าง

      รายงานที่มีแต่ประวัติยังไม่พอ ตารางว่างเปล่าตีความได้สองแบบ คืองานล้าง
      ทำงานปกติแต่ยังไม่มีอะไรถึงกำหนด กับงานล้างไม่เคยทำงานเลย ซึ่งต่างกันมาก

      overdue คือคำตอบของคำถามนั้น ถ้ามีแถวเลยกำหนดแล้วยังไม่ถูกล้าง
      แปลว่าตัวตั้งเวลาไม่ได้ทำงาน

      ใช้ STILL_HAS_PII ตัวเดียวกับที่งานล้างใช้เลือกแถว ถ้านิยามคนละแบบ
      หน้ารายงานจะบอกตัวเลขที่ไม่ตรงกับสิ่งที่ระบบจะลงมือทำจริง
    */
    const [entries, pending, purged] = await Promise.all([
      pool.query(
        `SELECT id, farm_request_id, fields_cleared, rejected_at, purged_at, trigger_source
           FROM data_retention_log
          ORDER BY purged_at DESC, id DESC
          LIMIT $1`,
        [limit]
      ),
      pool.query(
        `SELECT
           count(*)::int AS pending_count,
           count(*) FILTER (
             WHERE reviewed_at < now() - make_interval(days => $1::int)
           )::int AS overdue_count,
           min(reviewed_at) + make_interval(days => $1::int) AS next_due_at
         FROM farm_requests
        WHERE status = 'rejected'
          AND reviewed_at IS NOT NULL
          AND (${STILL_HAS_PII})`,
        [RETENTION_DAYS]
      ),
      pool.query(
        `SELECT count(*)::int AS total, max(purged_at) AS last_purged_at FROM data_retention_log`
      ),
    ]);

    const p = pending.rows[0];

    res.json({
      entries: entries.rows.map((r) => ({
        id: Number(r.id),
        farmRequestId: r.farm_request_id,
        fieldsCleared: r.fields_cleared ?? [],
        rejectedAt: r.rejected_at ? new Date(r.rejected_at).toISOString() : null,
        purgedAt: new Date(r.purged_at).toISOString(),
        triggerSource: r.trigger_source,
      })),
      summary: {
        retentionDays: RETENTION_DAYS,
        totalPurged: purged.rows[0].total,
        lastPurgedAt: purged.rows[0].last_purged_at
          ? new Date(purged.rows[0].last_purged_at).toISOString()
          : null,
        /** คำขอที่ถูกปฏิเสธและยังถือข้อมูลส่วนตัวอยู่ ทั้งที่ถึงและยังไม่ถึงกำหนด */
        pendingCount: p.pending_count,
        /** เลยกำหนดแล้วแต่ยังไม่ถูกล้าง ถ้าไม่เป็นศูนย์แปลว่างานล้างไม่ได้ทำงาน */
        overdueCount: p.overdue_count,
        /** วันครบกำหนดของรายการที่ใกล้ที่สุด */
        nextDueAt: p.next_due_at ? new Date(p.next_due_at).toISOString() : null,
      },
    });
  })
);
