import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const treesRouter = Router();

/** แปลงแถวในตาราง reviews ให้เป็นรูปร่าง TreeReview ที่ frontend ใช้ */
function toTreeReview(r: Record<string, any>) {
  return {
    id: r.source_id?.replace(/^nested:|^loose:/, '') ?? r.id,
    authorName: r.author_name,
    nfcFruitTag: r.nfc_fruit_tag ?? '',
    nfcFruitWeightKg: r.nfc_fruit_weight_kg ?? undefined,
    rating: r.rating,
    reviewDate: r.review_date ?? '',
    comment: r.comment,
    verifiedNfc: r.verified_nfc,
    avatarUrl: r.avatar_url ?? undefined,
    tastingNotes: r.tasting_notes ?? [],
    fruitPhoto: r.fruit_photo ?? undefined,
  };
}

/** ข้อมูลต้นไม้รายต้น -- ค้นด้วย code เพราะเป็นรหัสที่อยู่บนแท็ก NFC */
treesRouter.get('/:code', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM trees WHERE code = $1', [req.params.code]);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'ไม่พบต้นไม้รหัสนี้ในระบบ' });
  }
  const t = rows[0];
  res.json({
    tree: {
      id: t.id,
      farmId: t.farm_id,
      code: t.code,
      name: t.name,
      variety: t.variety,
      category: t.category,
      categoryLabel: t.category_label ?? '',
      badge: t.badge ?? undefined,
      propagationType: t.propagation_type,
      propagationLabel: t.propagation_label ?? '',
      propagationCode: t.propagation_code ?? 'AUTO',
      zone: t.zone ?? '',
      plantedDate: t.planted_date ?? '',
      ageYears: t.age_years,
      yieldFruitCount: t.yield_fruit_count,
      yieldWeightKg: t.yield_weight_kg,
      diariesCount: t.diaries_count,
      rating: t.rating,
      reviewCount: t.review_count,
      healthStatus: t.health_status,
      sweetnessBrix: t.sweetness_brix ?? undefined,
      lastWatered: t.last_watered ?? undefined,
      lastFertilized: t.last_fertilized ?? undefined,
      expectedHarvest: t.expected_harvest ?? undefined,
      notes: t.notes ?? undefined,
    },
  });
}));

/** รีวิวของต้นไม้ต้นนี้ */
treesRouter.get('/:code/reviews', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM reviews WHERE tree_code = $1 ORDER BY created_at DESC',
    [req.params.code]
  );
  res.json({ reviews: rows.map(toTreeReview) });
}));

/**
 * เพิ่มรีวิวใหม่ -- ต้องล็อกอิน
 *
 * ของเดิมมีฟังก์ชัน saveReviewToFirestore เขียนไว้แต่ไม่มีใครเรียกเลย
 * แปลว่าที่ผ่านมาไม่เคยเขียนรีวิวใหม่ได้จริง ตอนนี้ทำให้ใช้งานได้แล้ว
 *
 * ไม่ไปแก้ค่า review_count / rating ที่เก็บไว้ในตาราง trees และ farms
 * เพราะตัวเลขชุดนั้นเป็นข้อมูลบรรณาธิการ ไม่ได้มาจากการนับรีวิวจริง
 * (เช่น farm-01 เก็บ review_count = 1420 แต่มีรีวิวในระบบไม่กี่รายการ)
 * หน้าจอแสดงจำนวนจากรายการรีวิวที่ดึงมาจริงอยู่แล้ว
 */
treesRouter.post('/:code/reviews', requireAuth, asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const code = req.params.code;

  if (typeof body.comment !== 'string' || !body.comment.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกความคิดเห็น' });
  }
  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
    return res.status(400).json({ error: 'คะแนนต้องอยู่ระหว่าง 0 ถึง 10' });
  }

  const treeResult = await pool.query('SELECT id, farm_id FROM trees WHERE code = $1', [code]);
  if (treeResult.rows.length === 0) {
    return res.status(404).json({ error: 'ไม่พบต้นไม้รหัสนี้ในระบบ' });
  }
  const tree = treeResult.rows[0];

  const { rows } = await pool.query(
    `INSERT INTO reviews (
       tree_id, tree_code, farm_id, author_name, rating, comment,
       nfc_fruit_tag, nfc_fruit_weight_kg, verified_nfc, tasting_notes, review_date, source_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      tree.id, code, tree.farm_id,
      // ชื่อผู้เขียนมาจาก token ไม่ใช่จาก body -- client ปลอมเป็นคนอื่นไม่ได้
      req.user!.username,
      rating,
      body.comment.trim(),
      typeof body.nfcFruitTag === 'string' ? body.nfcFruitTag : null,
      Number.isFinite(Number(body.nfcFruitWeightKg)) ? Number(body.nfcFruitWeightKg) : null,
      body.verifiedNfc === true,
      Array.isArray(body.tastingNotes) ? body.tastingNotes.map(String) : [],
      new Date().toISOString().slice(0, 10),
      `api:${req.user!.uid}:${Date.now()}`,
    ]
  );

  res.status(201).json({ review: toTreeReview(rows[0]) });
}));
