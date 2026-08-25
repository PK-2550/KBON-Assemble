import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { pool } from '../db.js';

export const careLogsRouter = Router();

const ACTIVITY_TYPES = [
  'watering',
  'fertilizing',
  'pruning',
  'spraying',
  'harvesting',
  'inspection',
  'other',
] as const;

/**
 * ช่องทางนำข้อมูลเข้าใช้ API key ไม่ใช่ session ของผู้ใช้
 *
 * ผู้เรียกคือระบบของสวน ไม่ใช่คนที่นั่งอยู่หน้าเว็บ จึงไม่มี cookie ให้ใช้
 * แอดมินที่ล็อกอินอยู่ก็เรียกได้เหมือนกัน เผื่อต้องแก้ข้อมูลด้วยมือ
 *
 * เทียบสตริงแบบวนครบทุกตัวอักษรเสมอ ไม่ใช้ === ตรง ๆ
 * เพราะ === หยุดทันทีที่เจอตัวอักษรต่างกัน เวลาที่ใช้จึงบอกใบ้ได้ว่า
 * เดาถูกไปกี่ตัวแล้ว ซึ่งใช้เดา key ทีละตัวได้
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function requireIngestAuth(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();

  const expected = process.env.CARE_LOG_API_KEY;
  if (!expected) {
    return res.status(503).json({
      error: 'ยังไม่ได้ตั้งค่า CARE_LOG_API_KEY ในไฟล์ .env จึงยังรับข้อมูลเข้าไม่ได้',
    });
  }

  const provided = req.header('x-api-key');
  if (!provided || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'API key ไม่ถูกต้อง' });
  }
  next();
}

function toCareLog(r: Record<string, any>) {
  return {
    id: r.id,
    treeCode: r.tree_code,
    farmId: r.farm_id,
    activityType: r.activity_type,
    activityLabel: r.activity_label ?? undefined,
    performedAt: r.performed_at instanceof Date
      ? r.performed_at.toISOString().slice(0, 10)
      : String(r.performed_at ?? '').slice(0, 10),
    notes: r.notes ?? undefined,
    source: r.source,
    externalId: r.external_id ?? undefined,
    photoCount: Number(r.photo_count ?? 0),
    createdAt: r.created_at?.toISOString?.() ?? undefined,
  };
}

/**
 * ประวัติการดูแลของต้นไม้ต้นหนึ่ง เรียงจากล่าสุดไปเก่าสุด
 *
 * ไม่ส่งตัวรูปมาด้วย ส่งแค่จำนวนรูป เพราะรูปอาจเป็น base64 ก้อนใหญ่
 * ถ้าแนบมาทุกครั้งการเปิดแท็บประวัติจะดึงข้อมูลหลายเมกะไบต์โดยไม่จำเป็น
 * ผู้ใช้ที่อยากดูรูปค่อยกดเข้าไปทีละรายการ
 */
careLogsRouter.get('/trees/:code/care-logs', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.*, (SELECT count(*) FROM tree_care_log_photos p WHERE p.log_id = l.id) AS photo_count
     FROM tree_care_logs l
     WHERE l.tree_code = $1
     ORDER BY l.performed_at DESC, l.created_at DESC`,
    [req.params.code]
  );
  res.json({ logs: rows.map(toCareLog) });
}));

/** รูปของรายการหนึ่ง -- ดึงแยกตอนผู้ใช้กดดู */
careLogsRouter.get('/care-logs/:id/photos', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT photo, caption FROM tree_care_log_photos WHERE log_id = $1 ORDER BY sort_order, id',
    [req.params.id]
  );
  res.json({ photos: rows.map((r) => ({ photo: r.photo, caption: r.caption ?? undefined })) });
}));

interface IncomingLog {
  treeCode?: unknown;
  activityType?: unknown;
  activityLabel?: unknown;
  performedAt?: unknown;
  notes?: unknown;
  source?: unknown;
  externalId?: unknown;
  photos?: unknown;
}

/**
 * รับข้อมูลประวัติการดูแลเข้าระบบ ทีละหลายรายการ
 *
 *   POST /api/care-logs/import
 *   headers: x-api-key
 *   body: { logs: [ { treeCode, activityType, performedAt, notes?, photos?, externalId? } ] }
 *
 * รันซ้ำได้ -- รายการที่มี externalId เดิมจะถูกเขียนทับ ไม่ใช่เพิ่มใหม่
 * ทั้งชุดอยู่ใน transaction เดียว ถ้ามีรายการไหนผิดจะไม่บันทึกอะไรเลย
 * เพื่อไม่ให้ได้ข้อมูลเข้าไปครึ่ง ๆ กลาง ๆ แล้วแยกไม่ออกว่าซิงก์ถึงไหน
 */
careLogsRouter.post('/care-logs/import', requireIngestAuth, asyncHandler(async (req, res) => {
  const incoming: IncomingLog[] = Array.isArray(req.body?.logs) ? req.body.logs : [];
  if (incoming.length === 0) {
    return res.status(400).json({ error: 'ไม่มีรายการใน logs' });
  }
  if (incoming.length > 1000) {
    return res.status(413).json({ error: 'ส่งได้ครั้งละไม่เกิน 1000 รายการ' });
  }

  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  let photos = 0;

  try {
    await client.query('BEGIN');

    for (const [i, item] of incoming.entries()) {
      const at = `รายการที่ ${i + 1}`;

      if (typeof item.treeCode !== 'string' || !item.treeCode.trim()) {
        throw new Error(`${at}: ต้องระบุ treeCode`);
      }
      const type = String(item.activityType ?? 'other');
      if (!ACTIVITY_TYPES.includes(type as (typeof ACTIVITY_TYPES)[number])) {
        throw new Error(
          `${at}: activityType "${type}" ไม่ถูกต้อง ใช้ได้เฉพาะ ${ACTIVITY_TYPES.join(', ')}`
        );
      }
      const performedAt = String(item.performedAt ?? '');
      if (!/^\d{4}-\d{2}-\d{2}/.test(performedAt)) {
        throw new Error(`${at}: performedAt ต้องอยู่ในรูปแบบ YYYY-MM-DD`);
      }

      const tree = await client.query('SELECT id, farm_id FROM trees WHERE code = $1', [
        item.treeCode.trim(),
      ]);
      if (tree.rows.length === 0) {
        throw new Error(`${at}: ไม่พบต้นไม้รหัส ${item.treeCode}`);
      }

      const source = String(item.source ?? 'import');
      const externalId =
        typeof item.externalId === 'string' && item.externalId.trim()
          ? item.externalId.trim()
          : null;

      const saved = await client.query(
        `INSERT INTO tree_care_logs
           (tree_id, tree_code, farm_id, activity_type, activity_label,
            performed_at, notes, source, external_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
         DO UPDATE SET
           activity_type=EXCLUDED.activity_type,
           activity_label=EXCLUDED.activity_label,
           performed_at=EXCLUDED.performed_at,
           notes=EXCLUDED.notes
         RETURNING id, (xmax = 0) AS is_new`,
        [
          tree.rows[0].id,
          item.treeCode.trim(),
          tree.rows[0].farm_id,
          type,
          typeof item.activityLabel === 'string' ? item.activityLabel : null,
          performedAt.slice(0, 10),
          typeof item.notes === 'string' ? item.notes : null,
          source,
          externalId,
        ]
      );

      const logId = saved.rows[0].id;
      if (saved.rows[0].is_new) inserted++;
      else updated++;

      // เขียนรูปใหม่ทั้งชุดเมื่อผู้ส่งระบุ photos มา
      // ถ้าไม่ส่งมาเลยให้คงรูปเดิมไว้ ระบบต้นทางบางระบบส่งรูปแยกรอบ
      if (Array.isArray(item.photos)) {
        await client.query('DELETE FROM tree_care_log_photos WHERE log_id = $1', [logId]);
        for (const [pi, p] of item.photos.entries()) {
          const url = typeof p === 'string' ? p : (p as { photo?: string })?.photo;
          if (typeof url !== 'string' || !url.trim()) continue;
          await client.query(
            `INSERT INTO tree_care_log_photos (log_id, photo, caption, sort_order)
             VALUES ($1,$2,$3,$4)`,
            [logId, url.trim(), typeof p === 'object' ? ((p as any).caption ?? null) : null, pi]
          );
          photos++;
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'นำเข้าข้อมูลไม่สำเร็จ';
    return res.status(400).json({ error: message });
  } finally {
    client.release();
  }

  res.status(201).json({ inserted, updated, photos, total: incoming.length });
}));

/** ลบรายการหนึ่ง -- แอดมินเท่านั้น ใช้ตอนข้อมูลจากต้นทางผิด */
careLogsRouter.delete('/care-logs/:id', requireIngestAuth, asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM tree_care_logs WHERE id = $1 RETURNING id', [
    req.params.id,
  ]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'ไม่พบรายการที่ระบุ' });
  }
  res.json({ ok: true });
}));
