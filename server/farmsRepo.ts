import type { PoolClient } from 'pg';
import { pool } from './db.js';

/**
 * ประกอบข้อมูลจากตารางที่แยกกันใน Postgres กลับให้เป็นรูปร่างเดียวกับที่
 * frontend ใช้อยู่เดิม (DurianFarm ที่มี individualTrees ซ้อนอยู่ข้างใน)
 *
 * ทำแบบนี้โดยตั้งใจ เพื่อให้คอมโพเนนต์ UI ทั้ง 14 ตัวไม่ต้องแก้อะไรเลย
 * ฐานข้อมูลได้โครงสร้างที่ถูกต้อง (ตารางแยก + foreign key) ส่วน UI ยังเห็นรูปร่างเดิม
 *
 * ใช้วิธียิง 6 query แล้วประกอบใน JS แทนการ query ทีละฟาร์ม
 * เพื่อไม่ให้เกิด N+1 (15 ฟาร์มจะกลายเป็น 90 query)
 */

export interface LoadFarmsOptions {
  /** รวมรูปใบรับรองที่เป็น base64 มาด้วยไหม -- หน้า list ไม่ต้องใช้ และมันหนักเกือบ 1 MB */
  includeCertificatePhotos?: boolean;
  /** ดึงเฉพาะฟาร์มเดียว */
  farmId?: string;
}

export async function loadFarms(options: LoadFarmsOptions = {}) {
  const { includeCertificatePhotos = false, farmId } = options;

  const where = farmId ? 'WHERE id = $1' : '';
  const whereFk = farmId ? 'WHERE farm_id = $1' : '';
  const params = farmId ? [farmId] : [];

  const [farmRows, treeRows, reviewRows, varietyRows, certRows, techRows] = await Promise.all([
    pool.query(`SELECT * FROM farms ${where} ORDER BY rank, name`, params),
    pool.query(`SELECT * FROM trees ${whereFk} ORDER BY code`, params),
    pool.query(`SELECT * FROM reviews ${whereFk} ORDER BY created_at DESC`, params),
    pool.query(`SELECT * FROM tree_varieties ${whereFk} ORDER BY sort_order`, params),
    pool.query(
      `SELECT id, farm_id, name, name_th, short_code, cert_number, issued_by, valid_until,
              verified, sort_order, file_name, file_type
              ${includeCertificatePhotos ? ', document_photo' : ''}
       FROM farm_certifications ${whereFk} ORDER BY sort_order`,
      params
    ),
    pool.query(`SELECT * FROM farm_smart_technologies ${whereFk} ORDER BY sort_order`, params),
  ]);

  // จัดกลุ่มรีวิวตามต้นไม้ก่อน แล้วค่อยจัดกลุ่มต้นไม้ตามฟาร์ม
  const reviewsByTree = new Map<string, unknown[]>();
  for (const r of reviewRows.rows) {
    if (!r.tree_id) continue;
    const list = reviewsByTree.get(r.tree_id) ?? [];
    list.push({
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
    });
    reviewsByTree.set(r.tree_id, list);
  }

  const treesByFarm = new Map<string, unknown[]>();
  for (const t of treeRows.rows) {
    const list = treesByFarm.get(t.farm_id) ?? [];
    list.push({
      id: t.id,
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
      reviews: reviewsByTree.get(t.id) ?? [],
    });
    treesByFarm.set(t.farm_id, list);
  }

  const groupBy = <T extends { farm_id: string }>(rows: T[], map: (row: T) => unknown) => {
    const out = new Map<string, unknown[]>();
    for (const row of rows) {
      const list = out.get(row.farm_id) ?? [];
      list.push(map(row));
      out.set(row.farm_id, list);
    }
    return out;
  };

  const varietiesByFarm = groupBy(varietyRows.rows, (v) => ({
    id: v.id,
    name: v.name,
    nameEn: v.name_en ?? undefined,
    category: v.category,
    categoryLabel: v.category_label ?? '',
    tag: v.tag ?? undefined,
    avgWeightKg: v.avg_weight_kg,
    yieldPerTree: v.yield_per_tree,
    totalTreesCount: v.total_trees_count,
    rating: v.rating,
    reviewsCount: v.reviews_count,
    sweetnessBrix: v.sweetness_brix ?? undefined,
    tasteProfile: v.taste_profile ?? undefined,
    harvestSeason: v.harvest_season ?? undefined,
  }));

  const certsByFarm = groupBy(certRows.rows, (c) => ({
    name: c.name,
    nameTh: c.name_th ?? undefined,
    shortCode: c.short_code ?? '',
    certNumber: c.cert_number ?? '',
    issuedBy: c.issued_by ?? '',
    validUntil: c.valid_until ?? '',
    verified: c.verified,
    fileName: c.file_name ?? undefined,
    fileType: c.file_type ?? undefined,
    ...(c.document_photo !== undefined ? { documentPhoto: c.document_photo } : {}),
  }));

  const techByFarm = groupBy(techRows.rows, (t) => ({
    // ตัด prefix farm id ที่เติมตอน import ออก ให้ frontend เห็น id เดิม
    id: String(t.id).includes('__') ? String(t.id).split('__').slice(1).join('__') : t.id,
    name: t.name,
    subtext: t.subtext ?? '',
    iconEmoji: t.icon_emoji ?? '',
    active: t.active,
  }));

  return farmRows.rows.map((f) => ({
    id: f.id,
    rank: f.rank,
    name: f.name,
    nameEn: f.name_en ?? undefined,
    province: f.province,
    district: f.district ?? undefined,
    varietiesCount: f.varieties_count,
    topVarieties: f.top_varieties ?? [],
    totalTrees: f.total_trees,
    harvestedFruits: f.harvested_fruits,
    rating: f.rating,
    reviewCount: f.review_count,
    logoBgColor: f.logo_bg_color ?? undefined,
    logoTextColor: f.logo_text_color ?? undefined,
    establishedYear: f.established_year ?? undefined,
    certifications: f.certifications ?? [],
    certificationDetails: certsByFarm.get(f.id) ?? [],
    contact: {
      facebook: f.contact_facebook ?? undefined,
      instagram: f.contact_instagram ?? undefined,
      lineId: f.contact_line_id ?? undefined,
      phoneNumber: f.contact_phone ?? undefined,
      websiteUrl: f.contact_website ?? undefined,
      locationAddress: f.contact_address ?? undefined,
    },
    highlight: f.highlight ?? undefined,
    aboutStory: f.about_story ?? undefined,
    photos: f.photos ?? [],
    treeVarieties: varietiesByFarm.get(f.id) ?? [],
    individualTrees: treesByFarm.get(f.id) ?? [],
    smartTechnologies: techByFarm.get(f.id) ?? [],
    managerId: f.manager_id ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// เขียนฟาร์มทั้งก้อน (รวมข้อมูลซ้อน) ลงหลายตารางในครั้งเดียว
//
// ของเดิมฝั่ง Firestore ใช้ setDoc ทับทั้ง document จบในคำสั่งเดียว
// พอแตกเป็นตารางแยกแล้วต้องเขียนหลายที่ ซึ่งต้องอยู่ใน transaction เดียวกัน
// ไม่งั้นถ้าพังกลางทางจะได้ฟาร์มที่มีต้นไม้แต่ไม่มีใบรับรอง
// ---------------------------------------------------------------------------

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const num = (v: unknown, fallback: number | null = null): number | null => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined).map(String) : [];

export interface UpsertFarmInput {
  id: string;
  [key: string]: unknown;
}

/**
 * สร้างหรือเขียนทับฟาร์มหนึ่งรายการ พร้อมใบรับรอง เทคโนโลยี และสายพันธุ์
 *
 * ไม่แตะตาราง trees และ reviews เพราะฟีเจอร์สมัครฟาร์มไม่ได้ส่งข้อมูลต้นไม้มาด้วย
 * ถ้าเขียนทับด้วยค่าว่างจะทำให้ต้นไม้ที่มีอยู่หายไปทั้งหมด
 */
export async function upsertFarm(client: PoolClient, farm: UpsertFarmInput): Promise<string> {
  const contact = (farm.contact ?? {}) as Record<string, unknown>;
  const topVarieties = arr(farm.topVarieties);

  await client.query(
    `INSERT INTO farms (
       id, rank, name, name_en, province, district,
       varieties_count, top_varieties, total_trees, harvested_fruits,
       rating, review_count, logo_bg_color, logo_text_color, established_year,
       certifications, photos, highlight, about_story,
       contact_facebook, contact_instagram, contact_line_id,
       contact_phone, contact_website, contact_address, manager_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     ON CONFLICT (id) DO UPDATE SET
       rank=EXCLUDED.rank, name=EXCLUDED.name, name_en=EXCLUDED.name_en,
       province=EXCLUDED.province, district=EXCLUDED.district,
       varieties_count=EXCLUDED.varieties_count, top_varieties=EXCLUDED.top_varieties,
       total_trees=EXCLUDED.total_trees, harvested_fruits=EXCLUDED.harvested_fruits,
       rating=EXCLUDED.rating, review_count=EXCLUDED.review_count,
       logo_bg_color=EXCLUDED.logo_bg_color, logo_text_color=EXCLUDED.logo_text_color,
       established_year=EXCLUDED.established_year, certifications=EXCLUDED.certifications,
       photos=EXCLUDED.photos, highlight=EXCLUDED.highlight, about_story=EXCLUDED.about_story,
       contact_facebook=EXCLUDED.contact_facebook, contact_instagram=EXCLUDED.contact_instagram,
       contact_line_id=EXCLUDED.contact_line_id, contact_phone=EXCLUDED.contact_phone,
       contact_website=EXCLUDED.contact_website, contact_address=EXCLUDED.contact_address,
       manager_id=COALESCE(EXCLUDED.manager_id, farms.manager_id)`,
    [
      farm.id,
      num(farm.rank, 99),
      str(farm.name) ?? '(ไม่มีชื่อ)',
      str(farm.nameEn),
      str(farm.province) ?? '(ไม่ระบุ)',
      str(farm.district),
      num(farm.varietiesCount, Math.max(topVarieties.length, 1)),
      topVarieties.length > 0 ? topVarieties : ['หมอนทอง'],
      num(farm.totalTrees, 0),
      num(farm.harvestedFruits, 0),
      num(farm.rating, 0),
      num(farm.reviewCount, 0),
      str(farm.logoBgColor),
      str(farm.logoTextColor),
      num(farm.establishedYear),
      arr(farm.certifications),
      arr(farm.photos),
      str(farm.highlight),
      str(farm.aboutStory),
      str(contact.facebook),
      str(contact.instagram),
      str(contact.lineId),
      str(contact.phoneNumber ?? contact.phone),
      str(contact.websiteUrl ?? contact.website),
      str(contact.locationAddress ?? contact.address),
      str(farm.managerId),
    ]
  );

  // ใบรับรอง: ล้างของเดิมแล้วเขียนใหม่ เพราะไม่มี key ธรรมชาติให้ upsert
  // ทำเฉพาะตอนที่ผู้เรียกส่ง certificationDetails มาจริง ๆ
  if (Array.isArray(farm.certificationDetails)) {
    await client.query('DELETE FROM farm_certifications WHERE farm_id = $1', [farm.id]);
    for (const [i, c] of (farm.certificationDetails as Record<string, unknown>[]).entries()) {
      await client.query(
        `INSERT INTO farm_certifications
           (farm_id, name, name_th, short_code, cert_number, issued_by, valid_until,
            verified, sort_order, file_name, file_type, document_photo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          farm.id,
          str(c.name) ?? str(c.nameTh) ?? '(ไม่ระบุ)',
          str(c.nameTh),
          str(c.shortCode),
          str(c.certNumber),
          str(c.issuedBy),
          str(c.validUntil),
          c.verified === true,
          i,
          str(c.fileName),
          str(c.fileType),
          str(c.documentPhoto),
        ]
      );
    }
  }

  if (Array.isArray(farm.smartTechnologies)) {
    await client.query('DELETE FROM farm_smart_technologies WHERE farm_id = $1', [farm.id]);
    for (const [i, t] of (farm.smartTechnologies as Record<string, unknown>[]).entries()) {
      await client.query(
        `INSERT INTO farm_smart_technologies (id, farm_id, name, subtext, icon_emoji, active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          `${farm.id}__${str(t.id) ?? `st-${i + 1}`}`,
          farm.id,
          str(t.name) ?? '(ไม่ระบุ)',
          str(t.subtext),
          str(t.iconEmoji),
          t.active !== false,
          i,
        ]
      );
    }
  }

  if (Array.isArray(farm.treeVarieties)) {
    await client.query('DELETE FROM tree_varieties WHERE farm_id = $1', [farm.id]);
    for (const [i, v] of (farm.treeVarieties as Record<string, unknown>[]).entries()) {
      await client.query(
        `INSERT INTO tree_varieties
           (id, farm_id, name, name_en, category, category_label, tag,
            avg_weight_kg, yield_per_tree, total_trees_count, rating, reviews_count,
            sweetness_brix, taste_profile, harvest_season, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          `${farm.id}__${str(v.id) ?? `var-${i + 1}`}`,
          farm.id,
          str(v.name) ?? '(ไม่ระบุ)',
          str(v.nameEn),
          str(v.category) ?? 'durian_main',
          str(v.categoryLabel),
          str(v.tag),
          num(v.avgWeightKg, 0),
          num(v.yieldPerTree, 0),
          num(v.totalTreesCount, 0),
          num(v.rating, 0),
          num(v.reviewsCount, 0),
          num(v.sweetnessBrix),
          str(v.tasteProfile),
          str(v.harvestSeason),
          i,
        ]
      );
    }
  }

  return farm.id;
}

/** ใช้ upsertFarm นอก transaction ที่มีอยู่แล้ว */
export async function upsertFarmStandalone(farm: UpsertFarmInput): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await upsertFarm(client, farm);
    await client.query('COMMIT');
    return id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
