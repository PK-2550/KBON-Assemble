import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { parseValidUntil, formatValidUntil } from '../farmsRepo.js';
import { cleanZoneName, normalizeZoneNameKey } from '../../src/shared/regionalZoneName.js';

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

/**
 * แปลงแถวโซนเป็นรูปร่างที่หน้าเว็บใช้
 *
 * ใช้ formatValidUntil ตัวเดียวกับใบของสวน วันหมดอายุที่รู้แค่ปีจึงคืนเป็นปีเปล่า
 * ไม่ใช่ 31 ธ.ค. ซึ่งเป็นความแม่นยำที่ไม่เคยมีอยู่จริง
 */
function toZone(r: Record<string, any>) {
  return {
    id: Number(r.id),
    regionName: r.region_name,
    province: r.province,
    certNumber: r.cert_number ?? '',
    issuingAuthority: r.issuing_authority ?? '',
    validUntil: formatValidUntil({
      legacy_valid_until_raw: r.legacy_valid_until_raw,
      expiry_date: r.expiry_date,
      expiry_precision: r.expiry_precision,
    }),
    approvalStatus: r.approval_status,
    typeCode: r.type_code,
    typeNameTh: r.type_name_th ?? r.type_code,
    linkedFarmCount: Number(r.linked_farm_count ?? 0),
  };
}

/** อ่านโซนกลับมาในรูปแบบเดียวกับตอนดึงรายการ เพื่อให้หน้าเว็บใช้ต่อได้ทันที */
async function readZone(id: number) {
  const { rows } = await pool.query(
    `SELECT rc.id, rc.region_name, rc.province, rc.cert_number, rc.issuing_authority,
            to_char(rc.expiry_date, 'YYYY-MM-DD') AS expiry_date,
            rc.expiry_precision, rc.legacy_valid_until_raw, rc.approval_status,
            ct.code AS type_code, ct.name_th AS type_name_th,
            (SELECT count(*) FROM farm_regional_certifications frc
              WHERE frc.regional_certification_id = rc.id)::int AS linked_farm_count
       FROM regional_certifications rc
       JOIN certification_types ct ON ct.id = rc.certification_type_id
      WHERE rc.id = $1`,
    [id]
  );
  return toZone(rows[0]);
}

/**
 * หาโซนที่ชื่อชนกันหลังล้างค่าแล้ว
 *
 * เทียบด้วยกุญแจตัวเดียวกับดัชนีใน 015 ถ้าที่นี่หลวมกว่า ผู้ใช้จะเจอ error ดิบ
 * ของฐานข้อมูลแทนข้อความที่บอกได้ว่าไปชนกับโซนไหน
 *
 * ดึงชื่อทั้งหมดของประเภทนั้นมาเทียบใน JS แทนการเทียบใน SQL เพื่อให้กฎการล้างค่า
 * มีที่อยู่ที่เดียวคือ normalizeZoneNameKey จำนวนโซนอยู่ในหลักสิบ ไม่ใช่ปัญหา
 */
async function findNameClash(typeId: number, name: string, exceptId: number | null) {
  const key = normalizeZoneNameKey(name);
  const { rows } = await pool.query(
    `SELECT id, region_name FROM regional_certifications WHERE certification_type_id = $1`,
    [typeId]
  );
  return rows.find(
    (r) => Number(r.id) !== exceptId && normalizeZoneNameKey(r.region_name) === key
  );
}

/** หาโซนที่ถือเลขทะเบียนใบเดียวกัน ซึ่งแปลว่าซ้ำแน่นอนไม่ว่าจะตั้งชื่อต่างกันแค่ไหน */
async function findCertNumberClash(typeId: number, certNumber: string, exceptId: number | null) {
  if (!certNumber) return undefined;
  const { rows } = await pool.query(
    `SELECT id, region_name, cert_number
       FROM regional_certifications
      WHERE certification_type_id = $1 AND btrim(cert_number) = $2`,
    [typeId, certNumber]
  );
  return rows.find((r) => Number(r.id) !== exceptId);
}

/**
 * แปลงการชนดัชนีที่ฐานให้เป็นข้อความที่อ่านรู้เรื่อง
 *
 * ด่านข้างบนตรวจก่อนเขียนอยู่แล้ว ตัวนี้ไว้รับกรณีที่มีแอดมินอีกคนเขียนแทรก
 * ระหว่างจังหวะตรวจกับจังหวะเขียนพอดี ซึ่งเป็นช่องที่การตรวจในโค้ดปิดไม่ได้
 * ถ้าไม่ดัก ผู้ใช้จะได้ 500 พร้อมชื่อ constraint ซึ่งไม่บอกอะไรเลย
 */
function duplicateResponse(err: unknown): Record<string, unknown> | null {
  const e = err as { code?: string; constraint?: string };
  if (e?.code !== '23505') return null;

  if (e.constraint === 'regional_certifications_cert_number_idx') {
    return { error: 'เลขที่ใบรับรองนี้ถูกใช้กับโซนอื่นแล้ว', code: 'DUPLICATE_CERT_NUMBER' };
  }
  return { error: 'มีโซนชื่อนี้อยู่แล้ว กรุณาตั้งชื่ออื่น', code: 'DUPLICATE_NAME' };
}

/**
 * สร้างโซนใหม่
 *
 * หน้าจับคู่เดิมจับได้เฉพาะโซนที่มีอยู่แล้ว ถ้าใบที่สวนยื่นมาไม่ตรงโซนไหนเลย
 * แอดมินทำได้แค่ปฏิเสธ ทั้งที่ใบอาจถูกต้องทุกอย่าง แค่ระบบยังไม่รู้จักโซนนั้น
 */
regionalCertificationsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};

    const regionName = cleanZoneName(String(b.regionName ?? ''));
    const province = cleanZoneName(String(b.province ?? ''));
    const certNumber = cleanZoneName(String(b.certNumber ?? ''));
    const issuingAuthority = cleanZoneName(String(b.issuingAuthority ?? ''));

    if (!regionName) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อโซน' });
    }
    if (!province) {
      return res.status(400).json({ error: 'กรุณาเลือกจังหวัดของโซน' });
    }

    const type = await pool.query(
      `SELECT id, tier FROM certification_types WHERE code = $1 AND active`,
      [String(b.certificationTypeCode ?? '')]
    );
    if (type.rowCount === 0) {
      return res.status(400).json({ error: 'ไม่พบประเภทใบรับรองที่เลือก' });
    }

    // trigger ที่ฐานปฏิเสธอยู่แล้ว แต่ที่นั่นจะกลายเป็น 500 ที่ไม่บอกสาเหตุ
    if (type.rows[0].tier !== 'regional') {
      return res.status(400).json({
        error: 'ประเภทนี้เป็นใบของสวนรายแปลง ไม่ใช่ใบระดับโซน จึงสร้างเป็นโซนไม่ได้',
      });
    }
    const typeId = Number(type.rows[0].id);

    const nameClash = await findNameClash(typeId, regionName, null);
    if (nameClash) {
      return res.status(409).json({
        error: `มีโซนชื่อ ${nameClash.region_name} อยู่แล้ว กรุณาตั้งชื่ออื่น`,
        code: 'DUPLICATE_NAME',
      });
    }

    const certClash = await findCertNumberClash(typeId, certNumber, null);
    if (certClash) {
      return res.status(409).json({
        error: `เลขที่ใบรับรอง ${certClash.cert_number} ถูกใช้กับโซน ${certClash.region_name} แล้ว`,
        code: 'DUPLICATE_CERT_NUMBER',
      });
    }

    /*
      เตือนเมื่อจังหวัดนี้มีโซนของประเภทเดียวกันอยู่แล้ว

      ไม่บล็อกตาย เพราะจังหวัดหนึ่งขึ้นทะเบียน GI ได้มากกว่าหนึ่งใบจริง ๆ
      แต่กรณีที่พบบ่อยกว่าคือแอดมินลืมว่าเคยสร้างไว้แล้ว แล้วตั้งชื่อใหม่ที่
      ดัชนีชื่อจับไม่ได้ ให้คนเห็นของที่มีอยู่ก่อนแล้วตัดสินเอง
    */
    if (b.confirmDuplicate !== true) {
      const { rows } = await pool.query(
        `SELECT rc.id, rc.region_name, rc.province, rc.cert_number,
                (SELECT count(*) FROM farm_regional_certifications frc
                  WHERE frc.regional_certification_id = rc.id)::int AS linked_farm_count
           FROM regional_certifications rc
          WHERE rc.certification_type_id = $1 AND rc.province = $2
          ORDER BY rc.region_name`,
        [typeId, province]
      );

      if (rows.length > 0) {
        return res.status(409).json({
          error: `จังหวัด${province}มีโซนของมาตรฐานนี้อยู่แล้ว ${rows.length} โซน กรุณาตรวจว่าไม่ใช่โซนเดียวกันก่อนสร้างใหม่`,
          code: 'SIMILAR_ZONE_EXISTS',
          zones: rows.map((r) => ({
            id: Number(r.id),
            regionName: r.region_name,
            province: r.province,
            certNumber: r.cert_number ?? '',
            linkedFarmCount: r.linked_farm_count,
          })),
        });
      }
    }

    const { expiryDate, precision, legacyRaw } = parseValidUntil(String(b.validUntil ?? ''));

    /*
      สร้างเป็น approved ทันที

      ขาอ่านหน้ารายชื่อฟาร์มกรองเฉพาะใบที่ approved ถ้าโซนใหม่ค้างเป็น pending
      แอดมินจะสร้างโซน จับคู่สวน แล้วตราไม่ขึ้นโดยไม่มีอะไรบอกเลย ซึ่งเป็น
      ความล้มเหลวแบบเงียบชนิดเดียวกับที่งานชุดนี้ตั้งใจไล่ปิด

      ในระบบนี้แอดมินคือผู้ตรวจ ไม่มีชั้นอนุมัติซ้อน จึงบันทึกผู้ตรวจกับเวลาไว้
      เป็นร่องรอยแทน
    */
    try {
      const created = await pool.query(
        `INSERT INTO regional_certifications
           (certification_type_id, region_name, province, cert_number, issuing_authority,
            expiry_date, expiry_precision, legacy_valid_until_raw,
            approval_status, reviewed_by, reviewed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'approved',$9,now())
         RETURNING id`,
        [
          typeId,
          regionName,
          province,
          certNumber || null,
          issuingAuthority || null,
          expiryDate,
          precision,
          legacyRaw,
          req.user!.username,
        ]
      );

      res.status(201).json({ zone: await readZone(Number(created.rows[0].id)) });
    } catch (err) {
      const mapped = duplicateResponse(err);
      if (mapped) return res.status(409).json(mapped);
      throw err;
    }
  })
);

/**
 * แก้ไขโซน
 *
 * ชื่อโซนที่ 009 เติมให้เป็นชื่อจังหวัดล้วน ซึ่งไม่ใช่ชื่อจริงของทะเบียน GI
 * ก่อนหน้านี้แก้ได้ทาง SQL ทางเดียว
 *
 * การเปลี่ยนชื่อปลอดภัยเพราะสวนผูกกับโซนด้วย id ไม่ใช่ชื่อ
 *
 * ไม่เปิดให้เปลี่ยนประเภทใบ เพราะสวนทุกแห่งที่ผูกอยู่จะเปลี่ยนชนิดตราไปพร้อมกัน
 * เงียบ ๆ ค่าที่ส่งมาในช่องนั้นจึงถูกละทิ้ง ไม่ใช่ตอบว่าผิดพลาด
 *
 * คำเตือนเรื่องจังหวัดที่มีโซนอยู่แล้วใช้เฉพาะตอนสร้าง ตอนแก้ไขแอดมินกำลังมอง
 * โซนที่เลือกมาเองอยู่ ไม่ได้เสี่ยงกับการลืมว่ามีอะไรอยู่แบบตอนสร้างใหม่
 */
regionalCertificationsRouter.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(404).json({ error: 'ไม่พบโซนที่ระบุ' });
    }

    const current = await pool.query(
      `SELECT id, certification_type_id, region_name, province, cert_number, issuing_authority
         FROM regional_certifications WHERE id = $1`,
      [id]
    );
    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'ไม่พบโซนที่ระบุ' });
    }

    const row = current.rows[0];
    const typeId = Number(row.certification_type_id);
    const b = req.body ?? {};

    // ช่องที่ไม่ได้ส่งมาคงค่าเดิม ต่างจากช่องที่ส่งมาเป็นค่าว่างซึ่งแปลว่าตั้งใจล้าง
    const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
    const regionName = has('regionName') ? cleanZoneName(String(b.regionName ?? '')) : row.region_name;
    const province = has('province') ? cleanZoneName(String(b.province ?? '')) : row.province;
    const certNumber = has('certNumber')
      ? cleanZoneName(String(b.certNumber ?? ''))
      : (row.cert_number ?? '');
    const issuingAuthority = has('issuingAuthority')
      ? cleanZoneName(String(b.issuingAuthority ?? ''))
      : (row.issuing_authority ?? '');

    if (!regionName) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อโซน' });
    }
    if (!province) {
      return res.status(400).json({ error: 'กรุณาเลือกจังหวัดของโซน' });
    }

    // ยกเว้นตัวเองตอนเทียบ ไม่งั้นการบันทึกโดยไม่เปลี่ยนชื่อจะถูกมองว่าชนตัวเอง
    const nameClash = await findNameClash(typeId, regionName, id);
    if (nameClash) {
      return res.status(409).json({
        error: `มีโซนชื่อ ${nameClash.region_name} อยู่แล้ว กรุณาตั้งชื่ออื่น`,
        code: 'DUPLICATE_NAME',
      });
    }

    const certClash = await findCertNumberClash(typeId, certNumber, id);
    if (certClash) {
      return res.status(409).json({
        error: `เลขที่ใบรับรอง ${certClash.cert_number} ถูกใช้กับโซน ${certClash.region_name} แล้ว`,
        code: 'DUPLICATE_CERT_NUMBER',
      });
    }

    const expiry = has('validUntil') ? parseValidUntil(String(b.validUntil ?? '')) : null;

    try {
      await pool.query(
        `UPDATE regional_certifications
            SET region_name = $2, province = $3, cert_number = $4, issuing_authority = $5,
                expiry_date      = CASE WHEN $6 THEN $7::date ELSE expiry_date END,
                expiry_precision = CASE WHEN $6 THEN $8 ELSE expiry_precision END,
                legacy_valid_until_raw = CASE WHEN $6 THEN $9 ELSE legacy_valid_until_raw END,
                reviewed_by = $10, reviewed_at = now()
          WHERE id = $1`,
        [
          id,
          regionName,
          province,
          certNumber || null,
          issuingAuthority || null,
          expiry !== null,
          expiry?.expiryDate ?? null,
          expiry?.precision ?? 'day',
          expiry?.legacyRaw ?? null,
          req.user!.username,
        ]
      );

      res.json({ zone: await readZone(id) });
    } catch (err) {
      const mapped = duplicateResponse(err);
      if (mapped) return res.status(409).json(mapped);
      throw err;
    }
  })
);
