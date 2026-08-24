/**
 * เทียบข้อมูลระหว่าง Firestore (จากไฟล์ backup) กับ PostgreSQL
 *
 *   npm run verify:migration
 *
 * ตอบคำถามเดียว: ข้อมูลย้ายมาครบหรือมีอะไรตกหล่น
 *
 * ไม่ได้เทียบแค่จำนวนรวม เพราะจำนวนรวมตรงกันแต่ข้อมูลไปผูกผิดฟาร์มก็ยังเป็นไปได้
 * สคริปต์นี้จึงเทียบ 4 ระดับ:
 *   1. จำนวนต่อตาราง
 *   2. จำนวนต่อฟาร์ม (จับกรณีต้นไม้ไปโผล่ผิดฟาร์ม)
 *   3. ความถูกต้องเชิงโครงสร้าง (รีวิวกำพร้า, รหัสซ้ำ, ค่าที่ต้องมีแต่ว่าง)
 *   4. เทียบค่าทีละฟิลด์แบบสุ่มตัวอย่าง (จับกรณีจำนวนครบแต่เนื้อหาเพี้ยน)
 *
 * จบด้วย exit code 1 ถ้าเจอปัญหา เพื่อให้เอาไปต่อใน CI ได้
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_FILE = resolve(__dirname, '..', 'backup', 'firestore-latest.json');

interface Doc { __id: string; [key: string]: unknown }

let failures = 0;
let warnings = 0;

function check(label: string, expected: number, actual: number, note = '') {
  const ok = expected === actual;
  if (!ok) failures++;
  const mark = ok ? 'OK  ' : 'FAIL';
  const diff = ok ? '' : `  (ต่าง ${actual - expected > 0 ? '+' : ''}${actual - expected})`;
  console.log(
    `  [${mark}] ${label.padEnd(26)} firestore=${String(expected).padStart(5)}  postgres=${String(actual).padStart(5)}${diff}${note ? '  ' + note : ''}`
  );
}

function pass(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`);
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

  // ------------------------------------------------------------------
  // คำนวณยอดที่ "ควรจะเป็น" จากฝั่ง Firestore
  // ต้องใช้ตรรกะข้ามต้นซ้ำแบบเดียวกับ import-postgres.ts เป๊ะ ๆ
  // ------------------------------------------------------------------
  const seenCodes = new Set<string>();
  const seenIds = new Set<string>();
  const expected = {
    farms: farms.length,
    trees: 0, reviews: 0, treeVarieties: 0, certifications: 0, smartTech: 0,
  };
  const skipped: string[] = [];
  let skippedReviews = 0;
  const treesPerFarm = new Map<string, number>();
  const reviewsPerFarm = new Map<string, number>();

  for (const farm of farms) {
    expected.certifications += (farm.certificationDetails as unknown[] ?? []).length;
    expected.smartTech += (farm.smartTechnologies as unknown[] ?? []).length;
    expected.treeVarieties += (farm.treeVarieties as unknown[] ?? []).length;

    let farmTrees = 0;
    let farmReviews = 0;
    for (const t of (farm.individualTrees as Record<string, unknown>[] ?? [])) {
      const code = t.code ? String(t.code) : null;
      const id = t.id ? String(t.id) : code ? `tree-${code}` : null;
      if (!code || !id) continue;
      if (seenCodes.has(code) || seenIds.has(id)) {
        skipped.push(code);
        skippedReviews += (t.reviews as unknown[] ?? []).length;
        continue;
      }
      seenCodes.add(code);
      seenIds.add(id);
      farmTrees++;
      farmReviews += (t.reviews as unknown[] ?? []).length;
    }
    expected.trees += farmTrees;
    expected.reviews += farmReviews;
    treesPerFarm.set(farm.__id, farmTrees);
    reviewsPerFarm.set(farm.__id, farmReviews);
  }
  for (const t of looseTrees) {
    const code = t.code ? String(t.code) : null;
    if (!code || seenCodes.has(code) || seenIds.has(t.__id)) continue;
    seenCodes.add(code);
    seenIds.add(t.__id);
    expected.trees++;
    const fid = String(t.farmId ?? '');
    treesPerFarm.set(fid, (treesPerFarm.get(fid) ?? 0) + 1);
  }
  expected.reviews += looseReviews.length;

  const client = new Client({ connectionString });
  await client.connect();
  const one = async (sql: string, params: unknown[] = []) =>
    Number((await client.query(sql, params)).rows[0].count);

  console.log(`เทียบกับ backup ที่ export เมื่อ ${backup.exportedAt}\n`);

  // ------------------------------------------------------------------
  console.log('--- 1. จำนวน record ต่อตาราง ---');
  check('farms', expected.farms, await one('SELECT count(*) FROM farms'));
  check('trees', expected.trees, await one('SELECT count(*) FROM trees'),
    skipped.length ? `(ข้ามต้นรหัสซ้ำ ${skipped.length} ต้นโดยตั้งใจ)` : '');
  check('reviews', expected.reviews, await one('SELECT count(*) FROM reviews'),
    skippedReviews ? `(ข้ามรีวิวของต้นที่ข้าม ${skippedReviews})` : '');
  check('tree_varieties', expected.treeVarieties, await one('SELECT count(*) FROM tree_varieties'));
  check('farm_certifications', expected.certifications, await one('SELECT count(*) FROM farm_certifications'));
  check('farm_smart_technologies', expected.smartTech, await one('SELECT count(*) FROM farm_smart_technologies'));

  // ------------------------------------------------------------------
  console.log('\n--- 2. จำนวนต้นไม้และรีวิวแยกรายฟาร์ม ---');
  const pgTrees = await client.query('SELECT farm_id, count(*)::int AS n FROM trees GROUP BY farm_id');
  const pgReviews = await client.query('SELECT farm_id, count(*)::int AS n FROM reviews GROUP BY farm_id');
  const pgTreeMap = new Map(pgTrees.rows.map((r) => [r.farm_id, r.n]));
  const pgReviewMap = new Map(pgReviews.rows.map((r) => [r.farm_id, r.n]));

  let perFarmBad = 0;
  for (const farm of farms) {
    const et = treesPerFarm.get(farm.__id) ?? 0;
    const at = pgTreeMap.get(farm.__id) ?? 0;
    const er = reviewsPerFarm.get(farm.__id) ?? 0;
    const ar = pgReviewMap.get(farm.__id) ?? 0;
    if (et !== at || er !== ar) {
      perFarmBad++;
      failures++;
      console.log(`  [FAIL] ${farm.__id.padEnd(30)} ต้นไม้ ${et}->${at}  รีวิว ${er}->${ar}`);
    }
  }
  if (perFarmBad === 0) {
    console.log(`  [OK  ] ทั้ง ${farms.length} ฟาร์มมีจำนวนต้นไม้และรีวิวตรงกันหมด`);
  }

  // ------------------------------------------------------------------
  console.log('\n--- 3. ความถูกต้องเชิงโครงสร้าง ---');
  const orphanReviews = await one(
    'SELECT count(*) FROM reviews WHERE tree_id IS NULL'
  );
  pass('ไม่มีรีวิวที่ไม่ผูกกับต้นไม้', orphanReviews === 0,
    orphanReviews ? `พบ ${orphanReviews} รายการ` : '');

  const badFarmRef = await one(
    'SELECT count(*) FROM trees t LEFT JOIN farms f ON f.id = t.farm_id WHERE f.id IS NULL'
  );
  pass('ต้นไม้ทุกต้นชี้ไปยังฟาร์มที่มีอยู่จริง', badFarmRef === 0);

  const dupCodes = await one(
    'SELECT count(*) FROM (SELECT code FROM trees GROUP BY code HAVING count(*) > 1) x'
  );
  pass('ไม่มีรหัสต้นไม้ (code) ซ้ำ', dupCodes === 0);

  const mismatchCode = await one(
    'SELECT count(*) FROM reviews r JOIN trees t ON t.id = r.tree_id WHERE t.code <> r.tree_code'
  );
  pass('tree_code ในรีวิวตรงกับ code ของต้นที่ผูกอยู่', mismatchCode === 0);

  const emptyNames = await one(
    "SELECT count(*) FROM farms WHERE name IS NULL OR btrim(name) = ''"
  );
  pass('ทุกฟาร์มมีชื่อ', emptyNames === 0);

  // ------------------------------------------------------------------
  console.log('\n--- 4. เทียบค่าทีละฟิลด์ (สุ่มตัวอย่าง) ---');

  // 4.1 ฟาร์ม
  const sampleFarms = farms.slice(0, 6);
  let farmFieldBad = 0;
  for (const farm of sampleFarms) {
    const { rows } = await client.query(
      'SELECT name, province, total_trees, harvested_fruits, rating, top_varieties, photos FROM farms WHERE id = $1',
      [farm.__id]
    );
    if (rows.length === 0) { farmFieldBad++; failures++; console.log(`  [FAIL] ไม่พบฟาร์ม ${farm.__id}`); continue; }
    const r = rows[0];
    const problems: string[] = [];
    if (r.name !== farm.name) problems.push(`name "${farm.name}" -> "${r.name}"`);
    if (r.province !== farm.province) problems.push(`province`);
    if (Number(r.total_trees) !== Number(farm.totalTrees ?? 0)) problems.push('total_trees');
    if (Number(r.harvested_fruits) !== Number(farm.harvestedFruits ?? 0)) problems.push('harvested_fruits');
    if (Number(r.rating) !== Number(farm.rating ?? 0)) problems.push('rating');
    if (r.top_varieties.length !== (farm.topVarieties as unknown[] ?? []).length) problems.push('top_varieties');
    if (r.photos.length !== (farm.photos as unknown[] ?? []).length) problems.push('photos');
    if (problems.length) {
      farmFieldBad++; failures++;
      console.log(`  [FAIL] ${farm.__id}: ${problems.join(', ')}`);
    }
  }
  if (farmFieldBad === 0) console.log(`  [OK  ] ฟาร์มตัวอย่าง ${sampleFarms.length} รายการ ค่าตรงทุกฟิลด์`);

  // 4.2 ต้นไม้ + รีวิว จากฟาร์มแรกที่มีข้อมูลจริง
  const richFarm = farms.find((f) => (f.individualTrees as unknown[] ?? []).length > 0);
  if (richFarm) {
    const srcTrees = (richFarm.individualTrees as Record<string, unknown>[]).slice(0, 5);
    let treeBad = 0;
    for (const st of srcTrees) {
      const { rows } = await client.query(
        'SELECT name, variety, age_years, yield_fruit_count, rating, health_status, sweetness_brix FROM trees WHERE code = $1',
        [String(st.code)]
      );
      if (rows.length === 0) { treeBad++; failures++; console.log(`  [FAIL] ไม่พบต้นไม้ ${st.code}`); continue; }
      const r = rows[0];
      const problems: string[] = [];
      if (r.name !== st.name) problems.push('name');
      if (r.variety !== st.variety) problems.push('variety');
      if (Number(r.age_years) !== Number(st.ageYears ?? 0)) problems.push('age_years');
      if (Number(r.yield_fruit_count) !== Number(st.yieldFruitCount ?? 0)) problems.push('yield_fruit_count');
      if (Number(r.rating) !== Number(st.rating ?? 0)) problems.push('rating');
      if (r.health_status !== (st.healthStatus ?? 'good')) problems.push('health_status');
      if (st.sweetnessBrix != null && Number(r.sweetness_brix) !== Number(st.sweetnessBrix)) problems.push('sweetness_brix');
      if (problems.length) { treeBad++; failures++; console.log(`  [FAIL] ต้น ${st.code}: ${problems.join(', ')}`); }
    }
    if (treeBad === 0) console.log(`  [OK  ] ต้นไม้ตัวอย่าง ${srcTrees.length} ต้นจาก ${richFarm.__id} ค่าตรงทุกฟิลด์`);

    // รีวิว: เทียบข้อความเต็ม ๆ เพราะภาษาไทยมีโอกาสเพี้ยนจาก encoding
    const srcReviews: Record<string, unknown>[] = [];
    for (const t of (richFarm.individualTrees as Record<string, unknown>[])) {
      for (const r of (t.reviews as Record<string, unknown>[] ?? [])) srcReviews.push(r);
      if (srcReviews.length >= 5) break;
    }
    let revBad = 0;
    for (const sr of srcReviews.slice(0, 5)) {
      const { rows } = await client.query(
        'SELECT author_name, comment, rating, tasting_notes, verified_nfc FROM reviews WHERE source_id = $1',
        [`nested:${sr.id}`]
      );
      if (rows.length === 0) { revBad++; failures++; console.log(`  [FAIL] ไม่พบรีวิว ${sr.id}`); continue; }
      const r = rows[0];
      const problems: string[] = [];
      if (r.author_name !== sr.authorName) problems.push('author_name');
      if (r.comment !== sr.comment) problems.push('comment (ข้อความไม่ตรง!)');
      if (Number(r.rating) !== Number(sr.rating ?? 0)) problems.push('rating');
      if (r.tasting_notes.length !== (sr.tastingNotes as unknown[] ?? []).length) problems.push('tasting_notes');
      if (r.verified_nfc !== (sr.verifiedNfc === true)) problems.push('verified_nfc');
      if (problems.length) { revBad++; failures++; console.log(`  [FAIL] รีวิว ${sr.id}: ${problems.join(', ')}`); }
    }
    if (revBad === 0 && srcReviews.length > 0) {
      console.log(`  [OK  ] รีวิวตัวอย่าง ${Math.min(srcReviews.length, 5)} รายการ ข้อความไทยตรงกันทุกตัวอักษร`);
    }
  }

  // 4.3 ไฟล์ใบรับรองที่เก็บเป็น base64 -- เช็คว่าไม่ถูกตัดทอน
  const srcCertDocs: { farm: string; len: number }[] = [];
  for (const f of farms) {
    for (const c of (f.certificationDetails as Record<string, unknown>[] ?? [])) {
      if (c.documentPhoto) srcCertDocs.push({ farm: f.__id, len: String(c.documentPhoto).length });
    }
  }
  if (srcCertDocs.length > 0) {
    const { rows } = await client.query(
      'SELECT farm_id, length(document_photo) AS len FROM farm_certifications WHERE document_photo IS NOT NULL'
    );
    const srcTotal = srcCertDocs.reduce((s, x) => s + x.len, 0);
    const pgTotal = rows.reduce((s, r) => s + Number(r.len), 0);
    check('ไฟล์ใบรับรอง (จำนวน)', srcCertDocs.length, rows.length);
    pass(
      'ขนาดข้อมูล base64 รวมเท่าเดิม ไม่ถูกตัดทอน',
      srcTotal === pgTotal,
      `${(srcTotal / 1024 / 1024).toFixed(2)} MB -> ${(pgTotal / 1024 / 1024).toFixed(2)} MB`
    );
  }

  // ------------------------------------------------------------------
  console.log('\n--- สรุป ---');
  if (skipped.length > 0) {
    console.log(`  ข้ามต้นไม้รหัสซ้ำโดยตั้งใจ ${skipped.length} ต้น: ${skipped.join(', ')}`);
    warnings++;
  }
  if (backup.errors) {
    console.log(`  collection ที่ export ไม่ได้: ${Object.keys(backup.errors).join(', ')}`);
    console.log('  (ตกลงกันแล้วว่าจะไม่ย้ายข้อมูลผู้ใช้ ให้สมัครใหม่บนระบบใหม่)');
    warnings++;
  }

  await client.end();

  if (failures > 0) {
    console.log(`\n  ไม่ผ่าน ${failures} รายการ -- ข้อมูลยังไม่ตรงกัน`);
    process.exit(1);
  }
  console.log(`\n  ผ่านทั้งหมด${warnings > 0 ? ` (มีข้อควรทราบ ${warnings} ข้อด้านบน)` : ''}`);
  console.log('  ข้อมูลใน Postgres ตรงกับ Firestore ครบทุก record');
}

main().catch((err) => {
  console.error('verify ล้มเหลว:', err);
  process.exit(1);
});
