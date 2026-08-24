/**
 * นำข้อมูลที่ export มาจาก Firestore ใส่เข้า PostgreSQL
 *
 *   npm run import:postgres
 *
 * อ่านจาก backup/firestore-latest.json (ผลลัพธ์ของ npm run export:firestore)
 *
 * หลักการทำงาน:
 *   - ทำงานทั้งหมดใน transaction เดียว ถ้าพังกลางทางจะ rollback ทั้งหมด
 *     ไม่มีสภาพ "ย้ายไปได้ครึ่งเดียว" ซึ่งเป็นสิ่งที่แย่ที่สุดตอนย้ายข้อมูล
 *   - รันซ้ำได้ (idempotent) ใช้ ON CONFLICT DO UPDATE กับตารางที่มี key ธรรมชาติ
 *     และลบของเดิมของฟาร์มนั้นก่อนใส่ใหม่สำหรับตารางลูกที่ไม่มี key ธรรมชาติ
 *
 * เรื่องที่ต้องรู้ -- ต้นไม้รหัสซ้ำ:
 *   ข้อมูลเดิมใน Firestore มีต้นไม้ 12 ต้นที่ใช้ code ซ้ำกับต้นอื่น (และ id ซ้ำด้วย)
 *   เกิดจากฟาร์มทดสอบที่ตั้งชื่อคล้ายกัน แล้วโค้ดสร้างรหัสจากอักษรนำหน้าชื่อ
 *   Firestore ปล่อยผ่านเพราะต้นไม้เป็นแค่ array ใน document ไม่มีการบังคับ unique
 *   แต่ Postgres มี UNIQUE บน trees.code เพื่อกันสแกน NFC แล้วได้ต้นผิด
 *   สคริปต์นี้จึงเก็บต้นที่เจอก่อน และข้ามต้นที่ซ้ำ พร้อมพิมพ์รายการที่ข้ามให้ดู
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_FILE = resolve(__dirname, '..', 'backup', 'firestore-latest.json');

// ---------------------------------------------------------------------------
// helper แปลงค่าให้ปลอดภัยก่อนลง DB
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
const bool = (v: unknown): boolean => v === true || v === 'true';
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined).map(String) : [];

interface Doc {
  __id: string;
  [key: string]: unknown;
}

interface Stats {
  farms: number;
  trees: number;
  reviews: number;
  treeVarieties: number;
  certifications: number;
  smartTech: number;
  skippedTrees: { code: string; id: string; farmId: string; reason: string }[];
  skippedReviews: number;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ไม่พบ DATABASE_URL -- ตรวจว่ามีไฟล์ .env อยู่หรือยัง');
    process.exit(1);
  }

  const backup = JSON.parse(readFileSync(BACKUP_FILE, 'utf8'));
  const farms: Doc[] = backup.collections.farms ?? [];
  const looseTrees: Doc[] = backup.collections.trees ?? [];
  const looseReviews: Doc[] = backup.collections.reviews ?? [];

  console.log(`อ่านไฟล์ backup: ${BACKUP_FILE}`);
  console.log(`  export เมื่อ ${backup.exportedAt}`);
  console.log(`  ฟาร์ม ${farms.length} | /trees ${looseTrees.length} | /reviews ${looseReviews.length}\n`);

  const client = new Client({ connectionString });
  await client.connect();

  const stats: Stats = {
    farms: 0, trees: 0, reviews: 0, treeVarieties: 0,
    certifications: 0, smartTech: 0, skippedTrees: [], skippedReviews: 0,
  };

  // กันรหัสต้นไม้ซ้ำข้ามฟาร์ม -- เจอก่อนได้ไปก่อน
  const seenTreeCodes = new Set<string>();
  const seenTreeIds = new Set<string>();

  try {
    await client.query('BEGIN');

    for (const farm of farms) {
      const contact = (farm.contact ?? {}) as Record<string, unknown>;

      await client.query(
        `INSERT INTO farms (
           id, rank, name, name_en, province, district,
           varieties_count, top_varieties, total_trees, harvested_fruits,
           rating, review_count, logo_bg_color, logo_text_color, established_year,
           certifications, photos, highlight, about_story,
           contact_facebook, contact_instagram, contact_line_id,
           contact_phone, contact_website, contact_address
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
           $16,$17,$18,$19,$20,$21,$22,$23,$24,$25
         )
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
           contact_website=EXCLUDED.contact_website, contact_address=EXCLUDED.contact_address`,
        [
          farm.__id, num(farm.rank, 99), str(farm.name) ?? '(ไม่มีชื่อ)', str(farm.nameEn),
          str(farm.province) ?? '(ไม่ระบุ)', str(farm.district),
          num(farm.varietiesCount, 0), arr(farm.topVarieties),
          num(farm.totalTrees, 0), num(farm.harvestedFruits, 0),
          num(farm.rating, 0), num(farm.reviewCount, 0),
          str(farm.logoBgColor), str(farm.logoTextColor), num(farm.establishedYear),
          arr(farm.certifications), arr(farm.photos),
          str(farm.highlight), str(farm.aboutStory),
          str(contact.facebook), str(contact.instagram), str(contact.lineId),
          str(contact.phoneNumber ?? contact.phone),
          str(contact.websiteUrl ?? contact.website),
          str(contact.locationAddress ?? contact.address),
        ]
      );
      stats.farms++;

      // ตารางลูกที่ไม่มี key ธรรมชาติ -- ล้างของฟาร์มนี้ก่อนใส่ใหม่ เพื่อให้รันซ้ำได้
      await client.query('DELETE FROM farm_certifications WHERE farm_id = $1', [farm.__id]);

      const certs = Array.isArray(farm.certificationDetails) ? farm.certificationDetails : [];
      for (const [i, c] of certs.entries()) {
        const cert = c as Record<string, unknown>;
        await client.query(
          `INSERT INTO farm_certifications
             (farm_id, name, name_th, short_code, cert_number, issued_by, valid_until,
              verified, sort_order, file_name, file_type, document_photo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            farm.__id,
            str(cert.name) ?? str(cert.nameTh) ?? '(ไม่ระบุ)', str(cert.nameTh),
            str(cert.shortCode), str(cert.certNumber), str(cert.issuedBy),
            str(cert.validUntil), bool(cert.verified), i,
            str(cert.fileName), str(cert.fileType), str(cert.documentPhoto),
          ]
        );
        stats.certifications++;
      }

      const techs = Array.isArray(farm.smartTechnologies) ? farm.smartTechnologies : [];
      for (const [i, t] of techs.entries()) {
        const tech = t as Record<string, unknown>;
        // id ของ smartTech ใน Firestore เป็นแค่ 'st-1' ซึ่งซ้ำข้ามฟาร์ม
        // จึงเติม farm id เข้าไปข้างหน้าให้ unique จริง
        const techId = `${farm.__id}__${str(tech.id) ?? `st-${i + 1}`}`;
        await client.query(
          `INSERT INTO farm_smart_technologies (id, farm_id, name, subtext, icon_emoji, active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO UPDATE SET
             name=EXCLUDED.name, subtext=EXCLUDED.subtext, icon_emoji=EXCLUDED.icon_emoji,
             active=EXCLUDED.active, sort_order=EXCLUDED.sort_order`,
          [techId, farm.__id, str(tech.name) ?? '(ไม่ระบุ)', str(tech.subtext),
           str(tech.iconEmoji), tech.active !== false, i]
        );
        stats.smartTech++;
      }

      const varieties = Array.isArray(farm.treeVarieties) ? farm.treeVarieties : [];
      for (const [i, v] of varieties.entries()) {
        const va = v as Record<string, unknown>;
        const varietyId = `${farm.__id}__${str(va.id) ?? `var-${i + 1}`}`;
        await client.query(
          `INSERT INTO tree_varieties
             (id, farm_id, name, name_en, category, category_label, tag,
              avg_weight_kg, yield_per_tree, total_trees_count, rating, reviews_count,
              sweetness_brix, taste_profile, harvest_season, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (id) DO UPDATE SET
             name=EXCLUDED.name, name_en=EXCLUDED.name_en, category=EXCLUDED.category,
             category_label=EXCLUDED.category_label, tag=EXCLUDED.tag,
             avg_weight_kg=EXCLUDED.avg_weight_kg, yield_per_tree=EXCLUDED.yield_per_tree,
             total_trees_count=EXCLUDED.total_trees_count, rating=EXCLUDED.rating,
             reviews_count=EXCLUDED.reviews_count, sweetness_brix=EXCLUDED.sweetness_brix,
             taste_profile=EXCLUDED.taste_profile, harvest_season=EXCLUDED.harvest_season,
             sort_order=EXCLUDED.sort_order`,
          [varietyId, farm.__id, str(va.name) ?? '(ไม่ระบุ)', str(va.nameEn),
           str(va.category) ?? 'durian_main', str(va.categoryLabel), str(va.tag),
           num(va.avgWeightKg, 0), num(va.yieldPerTree, 0), num(va.totalTreesCount, 0),
           num(va.rating, 0), num(va.reviewsCount, 0), num(va.sweetnessBrix),
           str(va.tasteProfile), str(va.harvestSeason), i]
        );
        stats.treeVarieties++;
      }

      // ---- ต้นไม้ที่ฝังอยู่ในเอกสารฟาร์ม ----
      const trees = Array.isArray(farm.individualTrees) ? farm.individualTrees : [];
      for (const t of trees) {
        const tree = t as Record<string, unknown>;
        const code = str(tree.code);
        const id = str(tree.id) ?? (code ? `tree-${code}` : null);
        if (!code || !id) continue;

        if (seenTreeCodes.has(code) || seenTreeIds.has(id)) {
          stats.skippedTrees.push({
            code, id, farmId: farm.__id,
            reason: seenTreeCodes.has(code) ? 'code ซ้ำ' : 'id ซ้ำ',
          });
          // ข้ามรีวิวของต้นที่ถูกข้ามไปด้วย ไม่งั้นรีวิวจะไปผูกกับต้นผิด
          const skippedReviews = Array.isArray(tree.reviews) ? tree.reviews.length : 0;
          stats.skippedReviews += skippedReviews;
          continue;
        }
        seenTreeCodes.add(code);
        seenTreeIds.add(id);

        await insertTree(client, id, farm.__id, tree);
        stats.trees++;

        const reviews = Array.isArray(tree.reviews) ? tree.reviews : [];
        for (const r of reviews) {
          await insertNestedReview(client, r as Record<string, unknown>, id, code, farm.__id);
          stats.reviews++;
        }
      }
    }

    // ---- collection /trees ที่แยกอยู่ (โค้ดปัจจุบันไม่เคยเขียน แต่รองรับไว้) ----
    for (const t of looseTrees) {
      const code = str(t.code);
      const farmId = str(t.farmId);
      if (!code || !farmId) continue;
      if (seenTreeCodes.has(code) || seenTreeIds.has(t.__id)) {
        stats.skippedTrees.push({ code, id: t.__id, farmId, reason: 'ซ้ำกับต้นที่ฝังในฟาร์ม' });
        continue;
      }
      seenTreeCodes.add(code);
      seenTreeIds.add(t.__id);
      await insertTree(client, t.__id, farmId, t);
      stats.trees++;
    }

    // ---- collection /reviews ที่แยกอยู่ (โครงสร้างฟิลด์ต่างจากรีวิวที่ฝังในต้นไม้) ----
    for (const r of looseReviews) {
      const treeCode = str(r.treeCode);
      if (!treeCode) continue;
      await client.query(
        `INSERT INTO reviews
           (tree_id, tree_code, farm_id, author_name, rating, comment,
            nfc_fruit_tag, verified_nfc, tasting_notes, review_date, source_id)
         VALUES (
           (SELECT id FROM trees WHERE code = $1), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
         )
         ON CONFLICT (source_id) DO NOTHING`,
        [treeCode, str(r.farmId), str(r.authorName) ?? '(ไม่ระบุ)', num(r.rating, 0),
         str(r.comment) ?? '', str(r.verifiedNfcTag), bool(r.isVerifiedBuyer),
         arr(r.flavorNotes), str(r.date), `loose:${r.__id}`]
      );
      stats.reviews++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nimport ล้มเหลว -- rollback ทั้งหมดแล้ว ฐานข้อมูลไม่ถูกแตะต้อง');
    console.error(err);
    await client.end();
    process.exit(1);
  }

  console.log('--- นำเข้าสำเร็จ ---');
  console.log(`  farms                    ${String(stats.farms).padStart(5)}`);
  console.log(`  trees                    ${String(stats.trees).padStart(5)}`);
  console.log(`  reviews                  ${String(stats.reviews).padStart(5)}`);
  console.log(`  tree_varieties           ${String(stats.treeVarieties).padStart(5)}`);
  console.log(`  farm_certifications      ${String(stats.certifications).padStart(5)}`);
  console.log(`  farm_smart_technologies  ${String(stats.smartTech).padStart(5)}`);

  if (stats.skippedTrees.length > 0) {
    console.log(`\n--- ต้นไม้ที่ข้ามเพราะรหัสซ้ำ (${stats.skippedTrees.length} ต้น) ---`);
    for (const s of stats.skippedTrees) {
      console.log(`  ${s.code.padEnd(12)} ${s.reason.padEnd(10)} (${s.farmId})`);
    }
    if (stats.skippedReviews > 0) {
      console.log(`  พร้อมรีวิวที่ผูกกับต้นเหล่านั้นอีก ${stats.skippedReviews} รายการ`);
    }
  }

  console.log('\nรัน npm run verify:migration เพื่อเทียบยอดกับ Firestore');
  await client.end();
}

async function insertTree(client: Client, id: string, farmId: string, tree: Record<string, unknown>) {
  await client.query(
    `INSERT INTO trees (
       id, farm_id, code, name, variety, category, category_label, badge,
       propagation_type, propagation_label, propagation_code, zone, planted_date, age_years,
       yield_fruit_count, yield_weight_kg, diaries_count, rating, review_count,
       health_status, sweetness_brix, last_watered, last_fertilized, expected_harvest, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
     ON CONFLICT (id) DO UPDATE SET
       farm_id=EXCLUDED.farm_id, code=EXCLUDED.code, name=EXCLUDED.name, variety=EXCLUDED.variety,
       category=EXCLUDED.category, category_label=EXCLUDED.category_label, badge=EXCLUDED.badge,
       propagation_type=EXCLUDED.propagation_type, propagation_label=EXCLUDED.propagation_label,
       propagation_code=EXCLUDED.propagation_code, zone=EXCLUDED.zone,
       planted_date=EXCLUDED.planted_date, age_years=EXCLUDED.age_years,
       yield_fruit_count=EXCLUDED.yield_fruit_count, yield_weight_kg=EXCLUDED.yield_weight_kg,
       diaries_count=EXCLUDED.diaries_count, rating=EXCLUDED.rating, review_count=EXCLUDED.review_count,
       health_status=EXCLUDED.health_status, sweetness_brix=EXCLUDED.sweetness_brix,
       last_watered=EXCLUDED.last_watered, last_fertilized=EXCLUDED.last_fertilized,
       expected_harvest=EXCLUDED.expected_harvest, notes=EXCLUDED.notes`,
    [
      id, farmId, str(tree.code), str(tree.name) ?? '(ไม่มีชื่อ)', str(tree.variety) ?? '(ไม่ระบุ)',
      str(tree.category) ?? 'durian_main', str(tree.categoryLabel), str(tree.badge),
      str(tree.propagationType) ?? 'grafted', str(tree.propagationLabel), str(tree.propagationCode),
      str(tree.zone), str(tree.plantedDate), num(tree.ageYears, 0),
      num(tree.yieldFruitCount, 0), num(tree.yieldWeightKg, 0), num(tree.diariesCount, 0),
      num(tree.rating, 0), num(tree.reviewCount, 0),
      str(tree.healthStatus) ?? 'good', num(tree.sweetnessBrix),
      str(tree.lastWatered), str(tree.lastFertilized), str(tree.expectedHarvest), str(tree.notes),
    ]
  );
}

async function insertNestedReview(
  client: Client, r: Record<string, unknown>, treeId: string, treeCode: string, farmId: string
) {
  await client.query(
    `INSERT INTO reviews (
       tree_id, tree_code, farm_id, author_name, rating, comment,
       nfc_fruit_tag, nfc_fruit_weight_kg, verified_nfc, tasting_notes,
       fruit_photo, avatar_url, review_date, source_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (source_id) DO UPDATE SET
       author_name=EXCLUDED.author_name, rating=EXCLUDED.rating, comment=EXCLUDED.comment,
       nfc_fruit_tag=EXCLUDED.nfc_fruit_tag, nfc_fruit_weight_kg=EXCLUDED.nfc_fruit_weight_kg,
       verified_nfc=EXCLUDED.verified_nfc, tasting_notes=EXCLUDED.tasting_notes,
       fruit_photo=EXCLUDED.fruit_photo, avatar_url=EXCLUDED.avatar_url,
       review_date=EXCLUDED.review_date`,
    [
      treeId, treeCode, farmId, str(r.authorName) ?? '(ไม่ระบุ)', num(r.rating, 0),
      str(r.comment) ?? '', str(r.nfcFruitTag), num(r.nfcFruitWeightKg),
      bool(r.verifiedNfc), arr(r.tastingNotes),
      str(r.fruitPhoto), str(r.avatarUrl), str(r.reviewDate),
      // id ของรีวิวที่ฝังในต้นไม้ unique อยู่แล้ว แต่เติม prefix กันชนกับ /reviews
      `nested:${str(r.id) ?? `${treeCode}-${Math.random().toString(36).slice(2)}`}`,
    ]
  );
}

main().catch((err) => {
  console.error('import ล้มเหลว:', err);
  process.exit(1);
});
