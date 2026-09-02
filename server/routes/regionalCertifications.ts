import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';

/**
 * ใบรับรองระดับโซน และคำขอที่รอแอดมินจับคู่
 *
 * ใบอย่าง GI เป็นของโซนภูมิศาสตร์ ไม่ใช่ของสวนรายตัว สวนหลายแห่งในโซนเดียวกัน
 * ใช้ใบเดียวกัน ระบบจึงไม่มีทางรู้เองว่าสวนที่เพิ่งยื่นคำขอมาควรอยู่โซนไหน
 * 014 เก็บใบพวกนี้ไว้เป็นคำขอค้างใน regional_certification_requests
 *
 * แต่คำขอที่ค้างอยู่นั้นยังไม่มีทางไหนในหน้าเว็บเข้าถึงได้เลย ต้องเปิด psql
 * มาสั่ง SQL เอง ซึ่งจากมุมผู้ใช้ก็ไม่ต่างจากตอนที่ใบหายไปเงียบ ๆ
 * ไฟล์นี้เปิดประตูให้ศูนย์อนุมัติมาจัดการได้
 *
 * ทุกเส้นทางเป็นของแอดมินเท่านั้น การจับคู่คือการมอบตรารับรองให้สวน
 * ซึ่งเป็นสิ่งที่ผู้บริโภคใช้ตัดสินใจซื้อ ไม่ใช่สิ่งที่เจ้าของสวนกดให้ตัวเองได้
 */
export const regionalCertificationsRouter = Router();

/**
 * รายชื่อโซนที่จับคู่ได้
 *
 * ส่งจำนวนสวนที่ผูกอยู่แล้วไปด้วย แอดมินจะได้แยกออกว่าโซนไหนใช้งานจริง
 * กับโซนที่ยังว่างอยู่ ซึ่งช่วยตัดสินตอนชื่อโซนคล้ายกันหลายอัน
 */
regionalCertificationsRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT rc.id, rc.region_name, rc.province, rc.cert_number,
              rc.issuing_authority, rc.approval_status,
              ct.code AS type_code, ct.name_th AS type_name_th,
              (SELECT count(*) FROM farm_regional_certifications frc
                WHERE frc.regional_certification_id = rc.id)::int AS linked_farm_count
         FROM regional_certifications rc
         JOIN certification_types ct ON ct.id = rc.certification_type_id
        ORDER BY ct.sort_order, rc.province, rc.region_name`
    );

    res.json({
      zones: rows.map((r) => ({
        id: Number(r.id),
        regionName: r.region_name,
        province: r.province,
        certNumber: r.cert_number ?? '',
        issuingAuthority: r.issuing_authority ?? '',
        approvalStatus: r.approval_status,
        typeCode: r.type_code,
        typeNameTh: r.type_name_th ?? r.type_code,
        linkedFarmCount: r.linked_farm_count,
      })),
    });
  })
);

const ALLOWED_STATUSES = ['pending', 'linked', 'rejected'] as const;

/**
 * คำขอที่รอจับคู่
 *
 * ค่าตั้งต้นคือเฉพาะที่ยังค้าง เพราะนั่นคือกองงานที่แอดมินต้องเคลียร์
 * ส่วนคำขอที่จัดการไปแล้วขอดูได้ด้วยการระบุสถานะ ไว้ใช้ตอนต้องย้อนดูว่า
 * ใบใบหนึ่งเคยถูกตัดสินไปว่าอย่างไร
 */
regionalCertificationsRouter.get(
  '/requests',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const asked = String(req.query.status ?? 'pending');
    const status = (ALLOWED_STATUSES as readonly string[]).includes(asked) ? asked : 'pending';

    const { rows } = await pool.query(
      `SELECT r.id, r.farm_id, r.cert_number, r.issuing_authority, r.status,
              r.admin_notes, r.resolved_by, r.resolved_at, r.created_at,
              r.regional_certification_id,
              f.name AS farm_name, f.province,
              ct.code AS type_code, ct.name_th AS type_name_th,
              rc.region_name AS linked_region_name
         FROM regional_certification_requests r
         JOIN farms f ON f.id = r.farm_id
         JOIN certification_types ct ON ct.id = r.certification_type_id
         LEFT JOIN regional_certifications rc ON rc.id = r.regional_certification_id
        WHERE r.status = $1
        ORDER BY r.created_at`,
      [status]
    );

    res.json({ requests: rows.map(toRegionalRequest) });
  })
);

function toRegionalRequest(r: Record<string, any>) {
  return {
    id: Number(r.id),
    farmId: r.farm_id,
    farmName: r.farm_name,
    province: r.province,
    typeCode: r.type_code,
    typeNameTh: r.type_name_th ?? r.type_code,
    certNumber: r.cert_number ?? '',
    issuingAuthority: r.issuing_authority ?? '',
    status: r.status,
    adminNotes: r.admin_notes ?? '',
    resolvedBy: r.resolved_by ?? '',
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    regionalCertificationId:
      r.regional_certification_id === null ? null : Number(r.regional_certification_id),
    linkedRegionName: r.linked_region_name ?? '',
  };
}

/**
 * จับคู่คำขอเข้ากับโซน
 *
 * ทำในทรานแซกชันเดียวทั้งการผูกสวนกับโซนและการปิดคำขอ ถ้าแยกกันแล้วพังกลางทาง
 * จะได้สถานะครึ่ง ๆ กลาง ๆ คือคำขอปิดไปแล้วแต่สวนไม่เคยได้ตรา ซึ่งเป็นอาการ
 * เดียวกับปัญหาที่งานนี้ตั้งใจแก้พอดี
 *
 * ล็อกแถวคำขอด้วย FOR UPDATE เพราะแอดมินสองคนอาจเปิดหน้าเดียวกันค้างไว้
 * แล้วกดจับคู่คนละโซนพร้อมกัน
 */
regionalCertificationsRouter.post(
  '/requests/:id/link',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const zoneId = Number(req.body?.regionalCertificationId);
    if (!Number.isInteger(zoneId) || zoneId <= 0) {
      return res.status(400).json({ error: 'กรุณาเลือกโซนที่ต้องการจับคู่' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const found = await client.query(
        `SELECT id, farm_id, certification_type_id, status
           FROM regional_certification_requests WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      if (found.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'ไม่พบคำขอที่ระบุ' });
      }

      const reqRow = found.rows[0];
      if (reqRow.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'คำขอนี้ถูกจัดการไปแล้ว' });
      }

      const zone = await client.query(
        `SELECT id, certification_type_id FROM regional_certifications WHERE id = $1`,
        [zoneId]
      );
      if (zone.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'ไม่พบโซนที่เลือก' });
      }

      // คำขอ GI ต้องคู่กับโซน GI เท่านั้น ถ้าปล่อยให้คู่ข้ามประเภทได้
      // สวนจะได้ตราของมาตรฐานที่ไม่เคยยื่นมา
      if (zone.rows[0].certification_type_id !== reqRow.certification_type_id) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ error: 'โซนที่เลือกเป็นใบรับรองคนละประเภทกับคำขอนี้' });
      }

      // สวนอาจถูกผูกกับโซนนี้ไว้แล้วจากคำขอก่อนหน้า ซึ่งไม่ใช่ข้อผิดพลาด
      await client.query(
        `INSERT INTO farm_regional_certifications (farm_id, regional_certification_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [reqRow.farm_id, zoneId]
      );

      const updated = await client.query(
        `UPDATE regional_certification_requests
            SET status = 'linked', regional_certification_id = $2,
                admin_notes = COALESCE($3, admin_notes),
                resolved_by = $4, resolved_at = now()
          WHERE id = $1
          RETURNING *`,
        [reqRow.id, zoneId, req.body?.adminNotes ?? null, req.user!.username]
      );

      await client.query('COMMIT');

      res.json({ request: await withJoins(updated.rows[0]) });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/**
 * ปฏิเสธคำขอ
 *
 * ใช้เมื่อใบที่แนบมาไม่ตรงกับทะเบียนโซนไหนเลย หรือข้อมูลไม่พอจะตัดสิน
 * ไม่ลบแถวทิ้ง เพราะการปฏิเสธเป็นการตัดสินที่ควรมีร่องรอย และเจ้าของสวน
 * ควรตามได้ว่าใบที่ยื่นไปถูกพิจารณาแล้วด้วยเหตุผลอะไร
 */
regionalCertificationsRouter.post(
  '/requests/:id/reject',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const updated = await pool.query(
      `UPDATE regional_certification_requests
          SET status = 'rejected', admin_notes = $2,
              resolved_by = $3, resolved_at = now()
        WHERE id = $1 AND status = 'pending'
        RETURNING *`,
      [req.params.id, req.body?.adminNotes ?? null, req.user!.username]
    );

    if (updated.rowCount === 0) {
      // แยกให้ออกระหว่างไม่มีคำขอนี้ กับมีแต่ถูกจัดการไปแล้ว
      const exists = await pool.query(
        `SELECT 1 FROM regional_certification_requests WHERE id = $1`,
        [req.params.id]
      );
      return exists.rowCount === 0
        ? res.status(404).json({ error: 'ไม่พบคำขอที่ระบุ' })
        : res.status(409).json({ error: 'คำขอนี้ถูกจัดการไปแล้ว' });
    }

    res.json({ request: await withJoins(updated.rows[0]) });
  })
);

/** เติมชื่อสวนและชื่อประเภทให้แถวที่เพิ่งเขียน เพื่อให้รูปร่างตรงกับตอนอ่านรายการ */
async function withJoins(row: Record<string, any>) {
  const { rows } = await pool.query(
    `SELECT r.*, f.name AS farm_name, f.province,
            ct.code AS type_code, ct.name_th AS type_name_th,
            rc.region_name AS linked_region_name
       FROM regional_certification_requests r
       JOIN farms f ON f.id = r.farm_id
       JOIN certification_types ct ON ct.id = r.certification_type_id
       LEFT JOIN regional_certifications rc ON rc.id = r.regional_certification_id
      WHERE r.id = $1`,
    [row.id]
  );
  return toRegionalRequest(rows[0] ?? row);
}
