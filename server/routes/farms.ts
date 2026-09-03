import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { pool } from '../db.js';
import { loadFarms, upsertFarmStandalone, formatValidUntil } from '../farmsRepo.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

export const farmsRouter = Router();

/**
 * รายชื่อฟาร์มทั้งหมด พร้อมต้นไม้และรีวิวที่ซ้อนอยู่ข้างใน
 *
 * ไม่รวมรูปใบรับรอง (base64 เกือบ 1 MB) เพราะหน้ารายการไม่ได้ใช้
 * ถ้าต้องการรูปให้เรียก GET /api/farms/:id
 *
 * การกรองและเรียงลำดับทำที่ฝั่ง client เหมือนเดิม (App.tsx useMemo)
 * เพราะข้อมูลมีแค่หลักสิบฟาร์ม ยังไม่คุ้มที่จะย้ายมาทำใน SQL
 */
farmsRouter.get('/', asyncHandler(async (_req, res) => {
  // หน้ารายชื่อได้เฉพาะใบรับรองที่ผ่านการตรวจแล้ว ตราบนหน้านี้ต้องแปลว่า
  // ผ่านการตรวจจริง ส่วนใบที่ยังไม่ผ่านดูได้ที่หน้ารายละเอียดซึ่งบอกสถานะครบ
  const farms = await loadFarms({ approvedCertsOnly: true });
  res.json({ farms });
}));

farmsRouter.get('/:id', asyncHandler(async (req, res) => {
  const farms = await loadFarms({ farmId: req.params.id, includeCertificatePhotos: true });
  if (farms.length === 0) {
    return res.status(404).json({ error: 'ไม่พบฟาร์มที่ระบุ' });
  }
  res.json({ farm: farms[0] });
}));

/** เพิ่มฟาร์มใหม่ -- เฉพาะแอดมิน */
farmsRouter.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อฟาร์ม' });
  }
  if (typeof body.province !== 'string' || !body.province.trim()) {
    return res.status(400).json({ error: 'กรุณาเลือกจังหวัด' });
  }

  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `farm-${Date.now()}`;

  const exists = await pool.query('SELECT 1 FROM farms WHERE id = $1', [id]);
  if (exists.rowCount && exists.rowCount > 0) {
    return res.status(409).json({ error: 'มีฟาร์มที่ใช้รหัสนี้อยู่แล้ว' });
  }

  const topVarieties: string[] = Array.isArray(body.topVarieties)
    ? body.topVarieties.map(String).filter(Boolean)
    : [];

  const { rows } = await pool.query(
    `INSERT INTO farms (
       id, rank, name, name_en, province, district,
       varieties_count, top_varieties, total_trees, harvested_fruits,
       rating, review_count, logo_bg_color, logo_text_color,
       certifications, highlight, about_story
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id`,
    [
      id,
      Number(body.rank) || 99,
      body.name.trim(),
      body.nameEn ?? null,
      body.province.trim(),
      body.district ?? null,
      Math.max(topVarieties.length, 1),
      topVarieties.length > 0 ? topVarieties : ['หมอนทอง'],
      Number(body.totalTrees) || 0,
      Number(body.harvestedFruits) || 0,
      Number(body.rating) || 0,
      Number(body.reviewCount) || 0,
      body.logoBgColor ?? null,
      body.logoTextColor ?? null,
      Array.isArray(body.certifications) ? body.certifications.map(String) : [],
      body.highlight ?? null,
      body.aboutStory ?? null,
    ]
  );

  const farms = await loadFarms({ farmId: rows[0].id });
  res.status(201).json({ farm: farms[0] });
}));

/** แก้ไขฟาร์ม -- เฉพาะแอดมิน แก้เฉพาะฟิลด์ที่ส่งมา */
farmsRouter.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  // whitelist ฟิลด์ที่แก้ได้ ไม่รับ key อะไรก็ได้จาก client มาต่อเป็น SQL
  const editable: Record<string, string> = {
    name: 'name', nameEn: 'name_en', province: 'province', district: 'district',
    rank: 'rank', totalTrees: 'total_trees', harvestedFruits: 'harvested_fruits',
    rating: 'rating', reviewCount: 'review_count', highlight: 'highlight',
    aboutStory: 'about_story', logoBgColor: 'logo_bg_color', logoTextColor: 'logo_text_color',
    establishedYear: 'established_year',
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(editable)) {
    if (key in body) {
      values.push(body[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (Array.isArray(body.topVarieties)) {
    values.push(body.topVarieties.map(String));
    sets.push(`top_varieties = $${values.length}`);
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' });
  }

  values.push(req.params.id);
  const result = await pool.query(
    `UPDATE farms SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`,
    values
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'ไม่พบฟาร์มที่ระบุ' });
  }

  const farms = await loadFarms({ farmId: req.params.id });
  res.json({ farm: farms[0] });
}));

/**
 * เขียนทับฟาร์มทั้งก้อน (แทน saveFarmToFirestore ของเดิม)
 *
 * แอดมินแก้ได้ทุกฟาร์ม ส่วนผู้จัดการสวนแก้ได้เฉพาะฟาร์มที่ตัวเองดูแล
 * ของเดิมฝั่ง Firestore ใครก็เขียนทับฟาร์มไหนก็ได้ ขอแค่มีชื่อฟาร์มเป็น string
 */
farmsRouter.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const farmId = req.params.id;

  const owner = await pool.query('SELECT manager_id FROM farms WHERE id = $1', [farmId]);
  if (owner.rowCount === 0) {
    return res.status(404).json({ error: 'ไม่พบฟาร์มที่ระบุ' });
  }

  const isAdmin = req.user!.role === 'admin';
  const isOwner = owner.rows[0].manager_id === req.user!.uid;
  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'แก้ไขได้เฉพาะฟาร์มที่คุณเป็นผู้ดูแล' });
  }

  const body = req.body ?? {};
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อฟาร์ม' });
  }

  // ใบรับรองแก้ผ่านทางนี้ไม่ได้ ทั้งผู้จัดการสวนและแอดมิน
  //
  // ตราใบรับรองบนหน้าเว็บต้องแปลว่าผ่านการตรวจของแอดมินแล้วจริง ถ้าเขียนทับได้
  // จากการบันทึกฟาร์ม เจ้าของสวนก็ตั้งตราให้ตัวเองได้ และการบันทึกเรื่องอื่น
  // เช่นการเปิดปิด SmartFarm ก็จะพาใบรับรองทั้งชุดไปเขียนทับโดยไม่ตั้งใจ
  // เพราะฝั่งเว็บส่งฟาร์มมาทั้งก้อนเสมอ
  //
  // ทางเดียวที่แก้ได้คือยื่นคำขอแก้ไขแล้วให้แอดมินอนุมัติ
  const { certificationDetails: _ignored, ...editable } = body;

  // ไม่ให้ client ย้ายเจ้าของฟาร์มเอง -- คงค่าเดิมไว้เสมอ
  await upsertFarmStandalone({ ...editable, id: farmId, managerId: owner.rows[0].manager_id });

  const farms = await loadFarms({ farmId });
  res.json({ farm: farms[0] });
}));

/** ลบฟาร์ม -- เฉพาะแอดมิน ต้นไม้และรีวิวจะถูกลบตามด้วย cascade */
farmsRouter.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM farms WHERE id = $1 RETURNING id', [req.params.id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'ไม่พบฟาร์มที่ระบุ' });
  }
  res.json({ ok: true, id: req.params.id });
}));

/**
 * เอกสารการส่งออกของสวน คือใบรับรองระดับการขนส่งรายเที่ยวอย่าง PHYTO
 *
 * ใบพวกนี้ถูกกันออกจากขาอ่านสาธารณะโดยตั้งใจ (loadFarms กรอง tier <> shipment)
 * เพราะไม่ใช่คุณสมบัติถาวรของสวน สวนที่ส่งออกไปหนึ่งตู้เมื่อปีที่แล้วไม่ควรได้
 * ตราติดตัวไปตลอด และ PHYTO เป็นเอกสารระหว่างผู้ส่งออกกับประเทศปลายทาง
 * ไม่ใช่เครื่องหมายคุณภาพที่ผู้บริโภคใช้ตัดสินใจ
 *
 * แต่ถ้าเก็บแล้วไม่มีใครเห็นที่ไหนเลย ก็เท่ากับใบหายไปเงียบ ๆ เส้นทางนี้จึงเปิด
 * ให้เจ้าของสวนกับผู้ดูแลดูได้ ในฐานะประวัติการส่งออก ไม่ใช่ตรารับรอง
 *
 * ไม่เปิดสาธารณะ เลขที่เที่ยวขนส่งกับเลขที่ใบเป็นข้อมูลทางการค้าของสวนนั้น
 * ต่างจากตรา GAP ที่ตั้งใจให้ทุกคนเห็น
 */
farmsRouter.get('/:id/export-documents', requireAuth, asyncHandler(async (req, res) => {
  const farmId = req.params.id;

  const owner = await pool.query('SELECT manager_id FROM farms WHERE id = $1', [farmId]);
  // แยกให้ออกระหว่างไม่มีสวนนี้ กับมีแต่ไม่ใช่ของคุณ
  if (owner.rowCount === 0) {
    return res.status(404).json({ error: 'ไม่พบฟาร์มที่ระบุ' });
  }

  const isAdmin = req.user!.role === 'admin';
  const isOwner = owner.rows[0].manager_id === req.user!.uid;
  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'ดูได้เฉพาะฟาร์มที่คุณเป็นผู้ดูแล' });
  }

  const { rows } = await pool.query(
    `SELECT c.id, ct.code AS short_code, ct.name_th, ct.name,
            c.cert_number, c.issuing_authority, c.shipment_ref,
            to_char(c.expiry_date, 'YYYY-MM-DD') AS expiry_date,
            c.expiry_precision, c.legacy_valid_until_raw,
            c.approval_status, c.admin_notes,
            c.attachment_file_name, c.attachment_file_type,
            c.created_at
       FROM certifications c
       JOIN certification_types ct ON ct.id = c.certification_type_id
      WHERE c.farm_id = $1 AND c.tier = 'shipment'
      ORDER BY c.created_at DESC`,
    [farmId]
  );

  res.json({
    documents: rows.map((r) => ({
      id: Number(r.id),
      shortCode: r.short_code,
      nameTh: r.name_th ?? r.name,
      certNumber: r.cert_number ?? '',
      issuedBy: r.issuing_authority ?? '',
      shipmentRef: r.shipment_ref ?? '',
      validUntil: formatValidUntil({
        legacy_valid_until_raw: r.legacy_valid_until_raw,
        expiry_date: r.expiry_date,
        expiry_precision: r.expiry_precision,
      }),
      approvalStatus: r.approval_status,
      adminNotes: r.admin_notes ?? '',
      fileName: r.attachment_file_name ?? '',
      fileType: r.attachment_file_type ?? '',
      createdAt: new Date(r.created_at).toISOString(),
    })),
  });
}));
