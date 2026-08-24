import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { pool } from '../db.js';
import { loadFarms } from '../farmsRepo.js';
import { requireAdmin } from '../middleware/auth.js';

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
  const farms = await loadFarms();
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
