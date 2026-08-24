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
  }));
}
