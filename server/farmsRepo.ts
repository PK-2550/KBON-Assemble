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
  /**
   * เอาเฉพาะใบรับรองที่ผ่านการตรวจของแอดมินแล้ว
   *
   * หน้ารายชื่อฟาร์มใช้ตัวนี้ ตราบนหน้านั้นคือสิ่งที่ผู้ซื้อเห็นก่อนกดเข้าไปดูสวน
   * ถ้าใบที่ยังรอตรวจติดมาด้วย สวนที่ยังไม่ผ่านจะดูเหมือนผ่านแล้วตั้งแต่หน้าแรก
   *
   * หน้ารายละเอียดไม่ใช้ เพราะแท็บใบรับรองต้องแสดงสถานะจริงของทุกใบ
   * ให้เจ้าของสวนเห็นว่าใบไหนติดอยู่ขั้นไหน
   *
   * กรองที่ SQL ไม่ใช่ที่ JS เพราะเงื่อนไขนี้ตรงกับ certifications_farm_approved_idx
   * ที่ 005 สร้างไว้ ซึ่งเป็น covering index ตอบได้โดยไม่ต้องเปิดแถวจริง
   */
  approvedCertsOnly?: boolean;
}

/**
 * ประกอบวันหมดอายุกลับเป็นข้อความแบบเดียวกับที่หน้าเว็บแสดงอยู่เดิม
 *
 * ข้อมูลเดิมเก็บเป็นปีเปล่าอย่าง '2029' ตารางใหม่แยกเป็นวันที่จริงกับธงบอก
 * ความละเอียด ถ้าคืนวันที่เต็มออกไปเสมอ ผู้ใช้จะเห็น 31 ธ.ค. ทั้งที่ของเดิม
 * รู้แค่ปี คือเติมความแม่นยำที่ไม่เคยมีอยู่จริง
 */
export function formatValidUntil(c: Record<string, unknown>): string {
  const raw = c.legacy_valid_until_raw as string | null;
  if (raw) return raw;

  const date = c.expiry_date as string | null;
  if (!date) return '';

  return c.expiry_precision === 'year' ? date.slice(0, 4) : date;
}

export async function loadFarms(options: LoadFarmsOptions = {}) {
  const { includeCertificatePhotos = false, farmId, approvedCertsOnly = false } = options;


  const where = farmId ? 'WHERE id = $1' : '';
  const whereFk = farmId ? 'WHERE farm_id = $1' : '';
  const params = farmId ? [farmId] : [];

  const [farmRows, treeRows, reviewRows, varietyRows, certRows, techRows] = await Promise.all([
    pool.query(`SELECT * FROM farms ${where} ORDER BY rank, name`, params),
    pool.query(`SELECT * FROM trees ${whereFk} ORDER BY code`, params),
    pool.query(`SELECT * FROM reviews ${whereFk} ORDER BY created_at DESC`, params),
    pool.query(`SELECT * FROM tree_varieties ${whereFk} ORDER BY sort_order`, params),
    // ใบรับรองมาจากสองตาราง
    //
    // certifications เก็บใบของสวนเอง ส่วน regional_certifications เก็บใบของโซน
    // ภูมิศาสตร์อย่าง GI ซึ่งสวนหลายแห่งใช้ใบเดียวกัน จึงต้องต่อผ่าน join table
    // ถ้าลืมฝั่งหลัง ใบ GI จะหายจากหน้าเว็บโดยที่ใบอื่นยังครบ ซึ่งสังเกตยาก
    //
    // ไม่รวมใบระดับการขนส่งรายเที่ยว เพราะไม่ใช่คุณสมบัติถาวรของสวน
    // จึงไม่ควรไปโผล่ปนกับใบรับรองของสวนตามที่ 005 ตั้งใจไว้
    //
    // แปลงวันหมดอายุเป็นข้อความตั้งแต่ใน SQL ไม่ปล่อยให้เป็น Date
    // ไทยอยู่ UTC+7 การเรียก toISOString กับ Date ที่เป็นเที่ยงคืนตามเวลาเครื่อง
    // จะได้วันที่ย้อนไปหนึ่งวัน
    pool.query(
      `SELECT c.farm_id, ct.name, ct.name_th, ct.code AS short_code,
              c.cert_number, c.issuing_authority AS issued_by,
              to_char(c.expiry_date, 'YYYY-MM-DD') AS expiry_date,
              c.expiry_precision, c.legacy_valid_until_raw,
              c.approval_status, c.tier, ct.sort_order,
              c.attachment_file_name AS file_name, c.attachment_file_type AS file_type
              ${includeCertificatePhotos ? ', c.attachment_data AS document_photo' : ''}
         FROM certifications c
         JOIN certification_types ct ON ct.id = c.certification_type_id
        WHERE c.tier <> 'shipment' ${farmId ? 'AND c.farm_id = $1' : ''}
              ${approvedCertsOnly ? "AND c.approval_status = 'approved'" : ''}
       UNION ALL
       SELECT frc.farm_id, ct.name, ct.name_th, ct.code AS short_code,
              rc.cert_number, rc.issuing_authority AS issued_by,
              to_char(rc.expiry_date, 'YYYY-MM-DD') AS expiry_date,
              rc.expiry_precision, rc.legacy_valid_until_raw,
              rc.approval_status, ct.tier, ct.sort_order,
              rc.attachment_file_name AS file_name, rc.attachment_file_type AS file_type
              ${includeCertificatePhotos ? ', rc.attachment_data AS document_photo' : ''}
         FROM farm_regional_certifications frc
         JOIN regional_certifications rc ON rc.id = frc.regional_certification_id
         JOIN certification_types ct ON ct.id = rc.certification_type_id
        WHERE true ${farmId ? 'AND frc.farm_id = $1' : ''}
              ${approvedCertsOnly ? "AND rc.approval_status = 'approved'" : ''}
        ORDER BY sort_order`,
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
    validUntil: formatValidUntil(c),
    tier: c.tier,
    approvalStatus: c.approval_status,
    // เก็บไว้ให้โค้ดเดิมที่ยังอ่าน verified อยู่ ค่าจริงที่ใช้ตัดสินคือ approvalStatus
    verified: c.approval_status === 'approved',
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
/**
 * แปลงรหัสย่อแบบข้อความอิสระของตารางเก่า ให้เป็นรหัสประเภทของตารางใหม่
 *
 * ค่าที่จับคู่ไม่ได้ตกไปเป็น LEGACY_OTHER ไม่ใช่ถูกทิ้ง เพราะใบที่หายไปเงียบ ๆ
 * แปลว่าฟาร์มเสียตราไปโดยไม่มีใครรู้ ใช้เกณฑ์เดียวกับที่ 005 ใช้ตอนย้ายข้อมูล
 */
function certificationTypeCode(shortCode: string | null): string {
  const code = (shortCode ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');

  // รหัสที่ตรงกับ code ในตาราง certification_types อยู่แล้ว ส่งผ่านไปตรง ๆ
  // ประเภทที่เพิ่มเข้าฐานทีหลังจึงใช้ได้ทันทีโดยไม่ต้องกลับมาแก้ฟังก์ชันนี้
  if (KNOWN_TYPE_CODES.has(code)) return code;

  // ค่าที่ฟอร์มรุ่นเก่าเคยส่งมา ยังต้องแปลให้ถูกต่อไป
  if (code.startsWith('ORGANIC')) return 'ORGANIC_TH';
  if (code === 'ISO' || code.startsWith('ISO22000')) return 'ISO22000';
  if (code === 'QMARK' || code === 'Q_MARK') return 'Q_MARK';

  return 'LEGACY_OTHER';
}

/**
 * รหัสประเภทที่ตารางค้นหารู้จัก
 *
 * ตรงกับ code ใน certification_types ที่ 005 กับ 014 สร้างไว้ เก็บเป็นชุดที่นี่
 * เพื่อให้ตัวแปลงรหัสส่งค่าที่ตรงอยู่แล้วผ่านไปได้โดยไม่ต้องไล่เขียนเงื่อนไข
 * ทีละประเภท
 *
 * ถ้าเพิ่มประเภทใหม่ในฐานแล้วลืมเติมที่นี่ ใบจะตกไปเป็น LEGACY_OTHER
 * ซึ่งเห็นได้ทันทีจากตราที่ขึ้นว่า อื่น ๆ ไม่ใช่หายไปเงียบ ๆ
 */
const KNOWN_TYPE_CODES = new Set([
  'GAP',
  'ORGANIC_TH',
  'GMP',
  'GACC',
  'PHYTO',
  'GI',
  'Q_MARK',
  'ISO22000',
]);

/**
 * ปีเปล่าอย่าง '2029' นับเป็นความละเอียดระดับปี แล้วปัดเป็น 31 ธ.ค.
 *
 * ส่งออกไปให้เส้นทางจัดการโซนใช้ด้วย ใบของโซนกับใบของสวนเก็บวันหมดอายุ
 * ด้วยรูปแบบเดียวกัน ถ้าแยกกันเขียนสองที่ วันหนึ่งจะแสดงคนละอย่าง
 */
export function parseValidUntil(raw: string | null): {
  expiryDate: string | null;
  precision: 'day' | 'year';
  legacyRaw: string | null;
} {
  const value = (raw ?? '').trim();
  if (/^\d{4}$/.test(value)) {
    return { expiryDate: `${value}-12-31`, precision: 'year', legacyRaw: null };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { expiryDate: value, precision: 'day', legacyRaw: null };
  }
  return { expiryDate: null, precision: 'day', legacyRaw: value || null };
}

/**
 * เขียนใบรับรองลงตาราง certifications
 *
 * ไม่ลบแล้วเขียนใหม่แบบตารางเก่า เพราะแถวในตารางใหม่ถือสถานะการตรวจ ผู้ตรวจ
 * และหมายเหตุของแอดมินไว้ด้วย การลบทิ้งทุกครั้งที่บันทึกฟาร์มจะล้างร่องรอย
 * การตรวจไปหมด แล้วตราใบรับรองก็จะไม่ได้แปลว่าผ่านการตรวจแล้วอีกต่อไป
 *
 * ไม่ลบแถวที่ไม่อยู่ในรายการที่ส่งมาด้วย การถอนใบรับรองเป็นการกระทำของแอดมิน
 * ที่ควรมีร่องรอย ไม่ใช่ผลข้างเคียงของการบันทึกฟาร์ม
 */
async function writeCertifications(
  client: PoolClient,
  farmId: string,
  details: Record<string, unknown>[]
): Promise<void> {
  for (const c of details) {
    const code = certificationTypeCode(str(c.shortCode));

    // ใบระดับภูมิภาคอยู่คนละตาราง และ trigger ของ certifications จะโยน exception
    // ถ้าเผลอเขียนลงมา ต้องให้แอดมินจับคู่สวนเข้ากับโซนเอง เพราะแถวเดิม
    // ไม่มีข้อมูลบอกว่าเป็นใบของโซนไหน
    const type = await client.query(
      `SELECT id, tier FROM certification_types WHERE code = $1`,
      [code]
    );
    if (type.rowCount === 0) continue;

    // ใบระดับโซนอย่าง GI ไปตาราง regional_certifications ซึ่งแอดมินต้องจับคู่เอง
    // เพราะแถวคำขอไม่มีข้อมูลบอกว่าสวนนี้ควรอยู่โซนไหน
    //
    // เดิมข้ามทิ้งเฉย ๆ ผู้ใช้กรอกครบ แอดมินกดอนุมัติ แล้วใบหายไปโดยไม่มีใครรู้
    // ตอนนี้บันทึกเป็นคำขอค้างไว้ให้แอดมินมาจัดการ
    if (type.rows[0].tier === 'regional') {
      await client.query(
        `INSERT INTO regional_certification_requests
           (farm_id, certification_type_id, cert_number, issuing_authority)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (farm_id, certification_type_id)
           WHERE status = 'pending' DO NOTHING`,
        [farmId, type.rows[0].id, str(c.certNumber), str(c.issuedBy)]
      );
      continue;
    }

    const typeId = type.rows[0].id;
    const { expiryDate, precision, legacyRaw } = parseValidUntil(str(c.validUntil));
    const fileType = c.fileType === 'image' || c.fileType === 'pdf' ? c.fileType : null;

    // ยกสถานะเป็นอนุมัติได้ แต่ไม่ลดสถานะของใบที่แอดมินอนุมัติไปแล้ว
    const approve = c.verified === true;

    const updated = await client.query(
      `UPDATE certifications
          SET cert_number            = $3,
              issuing_authority      = $4,
              expiry_date            = $5,
              expiry_precision       = $6,
              legacy_valid_until_raw = $7,
              attachment_data        = COALESCE($8, attachment_data),
              attachment_file_name   = COALESCE($9, attachment_file_name),
              attachment_file_type   = COALESCE($10, attachment_file_type),
              approval_status        = CASE WHEN $11 THEN 'approved' ELSE approval_status END
        WHERE farm_id = $1 AND certification_type_id = $2
        RETURNING id`,
      [
        farmId,
        typeId,
        str(c.certNumber),
        str(c.issuedBy),
        expiryDate,
        precision,
        legacyRaw,
        str(c.documentPhoto),
        str(c.fileName),
        fileType,
        approve,
      ]
    );

    if (updated.rowCount === 0) {
      await client.query(
        `INSERT INTO certifications
           (certification_type_id, tier, farm_id, issuing_authority, cert_number,
            expiry_date, expiry_precision, legacy_valid_until_raw,
            attachment_data, attachment_file_name, attachment_file_type, approval_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          typeId,
          type.rows[0].tier,
          farmId,
          str(c.issuedBy),
          str(c.certNumber),
          expiryDate,
          precision,
          legacyRaw,
          str(c.documentPhoto),
          str(c.fileName),
          fileType,
          approve ? 'approved' : 'pending',
        ]
      );
    }
  }
}

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

  // ใบรับรอง -- เขียนเฉพาะตารางชุดใหม่
  //
  // ตาราง farm_certifications เดิมไม่ถูกเขียนจากที่ไหนอีกแล้ว เหลือไว้เป็น
  // ข้อมูลอ้างอิงจนกว่า 007 จะลบทิ้ง ขาอ่านย้ายมาอ่านตารางใหม่แล้ว
  //
  // ทำเฉพาะตอนที่ผู้เรียกส่ง certificationDetails มาจริง ๆ
  if (Array.isArray(farm.certificationDetails)) {
    await writeCertifications(client, farm.id, farm.certificationDetails as Record<string, unknown>[]);
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
