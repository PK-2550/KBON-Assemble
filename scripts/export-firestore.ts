/**
 * ดูดข้อมูลทั้งหมดออกจาก Firestore มาเก็บเป็นไฟล์ JSON
 *
 *   npm run export:firestore
 *
 * อ่านอย่างเดียว ไม่เขียนอะไรกลับเข้า Firestore เลย
 *
 * ใช้ firebase web SDK ตัวเดียวกับที่แอปใช้ ไม่ต้องใช้ service account key
 * เพราะ firestore.rules ปัจจุบันเปิดให้อ่านได้หมด (ดูหัวข้อ 1.5 ในรายงานสำรวจ)
 *
 * สิ่งที่ต้องระวัง: ข้อมูลจริงใน Firestore ไม่ได้อยู่แค่ระดับ collection
 * ต้นไม้ถูกฝังเป็น array อยู่ในเอกสารฟาร์ม (farms/{id}.individualTrees[])
 * และรีวิวก็ฝังซ้อนอยู่ในต้นไม้อีกชั้น สคริปต์นี้จึงนับทั้งระดับ collection
 * และระดับที่ฝังอยู่ เพื่อให้ 3.3 เอาไปเทียบยอดกับ Postgres ได้ครบ
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, type Firestore } from 'firebase/firestore';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = resolve(__dirname, '..', 'backup');

/** collection ที่ประกาศไว้ใน firebase-blueprint.json ทั้งหมด */
const COLLECTIONS = ['farms', 'trees', 'reviews', 'users', 'accounts'] as const;
type CollectionName = (typeof COLLECTIONS)[number];

interface ExportedDoc {
  __id: string;
  [key: string]: unknown;
}

interface CollectionResult {
  docs: ExportedDoc[];
  error: string | null;
}

/**
 * แปลงค่าที่ Firestore ส่งกลับมาให้กลายเป็น JSON ธรรมดา
 *
 * Timestamp ของ Firestore เป็น class ที่ JSON.stringify แปลงออกมาเป็น
 * { seconds, nanoseconds } ซึ่งอ่านยากและ import กลับลำบาก จึงแปลงเป็น ISO string
 * ตั้งแต่ตอน export เลย
 */
function toPlainJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) return value.map(toPlainJson);

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // Firestore Timestamp
    if (typeof (obj as { toDate?: unknown }).toDate === 'function') {
      return (obj as { toDate: () => Date }).toDate().toISOString();
    }
    // Timestamp ที่ถูก serialize มาแล้วบางกรณี
    if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') {
      return new Date(obj.seconds * 1000).toISOString();
    }
    // GeoPoint / DocumentReference กันไว้เผื่อมีในอนาคต
    if (typeof (obj as { path?: unknown }).path === 'string' && 'firestore' in obj) {
      return { __ref: (obj as { path: string }).path };
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = toPlainJson(v);
    }
    return out;
  }

  return value;
}

async function exportCollection(db: Firestore, name: CollectionName): Promise<CollectionResult> {
  try {
    const snapshot = await getDocs(collection(db, name));
    const docs: ExportedDoc[] = [];
    snapshot.forEach((d) => {
      docs.push({ __id: d.id, ...(toPlainJson(d.data()) as Record<string, unknown>) });
    });
    return { docs, error: null };
  } catch (err) {
    // ไม่ให้ collection เดียวพังทั้งการ export -- บันทึก error ไว้แล้วไปต่อ
    const message = err instanceof Error ? err.message : String(err);
    return { docs: [], error: message };
  }
}

/** นับข้อมูลที่ฝังอยู่ในเอกสารฟาร์ม ซึ่งจะถูกแตกออกเป็นตารางแยกใน Postgres */
function countNested(farms: ExportedDoc[]) {
  let individualTrees = 0;
  let treeReviews = 0;
  let treeVarieties = 0;
  let certificationDetails = 0;
  let smartTechnologies = 0;

  for (const farm of farms) {
    const trees = Array.isArray(farm.individualTrees) ? farm.individualTrees : [];
    individualTrees += trees.length;

    for (const tree of trees) {
      const reviews = (tree as { reviews?: unknown[] })?.reviews;
      if (Array.isArray(reviews)) treeReviews += reviews.length;
    }

    if (Array.isArray(farm.treeVarieties)) treeVarieties += farm.treeVarieties.length;
    if (Array.isArray(farm.certificationDetails)) certificationDetails += farm.certificationDetails.length;
    if (Array.isArray(farm.smartTechnologies)) smartTechnologies += farm.smartTechnologies.length;
  }

  return { individualTrees, treeReviews, treeVarieties, certificationDetails, smartTechnologies };
}

async function main() {
  console.log('เชื่อมต่อ Firestore...');
  console.log(`  project    : ${firebaseConfig.projectId}`);
  console.log(`  database   : ${firebaseConfig.firestoreDatabaseId}\n`);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  const collections: Record<string, ExportedDoc[]> = {};
  const errors: Record<string, string> = {};
  const counts: Record<string, number> = {};

  for (const name of COLLECTIONS) {
    process.stdout.write(`  อ่าน /${name} ... `);
    const { docs, error } = await exportCollection(db, name);

    if (error) {
      errors[name] = error;
      console.log(`ล้มเหลว (${error})`);
    } else {
      console.log(`${docs.length} เอกสาร`);
    }

    collections[name] = docs;
    counts[name] = docs.length;
  }

  const nested = countNested(collections.farms);

  // ยอดรวมที่ Postgres ควรมีหลัง import -- 3.3 จะเอาตัวเลขชุดนี้ไปเทียบตรง ๆ
  const expectedInPostgres = {
    farms: counts.farms,
    // ต้นไม้มาจาก 2 ที่: ที่ฝังในฟาร์ม + collection /trees (ซึ่งโค้ดไม่เคยเขียน)
    trees: nested.individualTrees + counts.trees,
    // รีวิวมาจาก 2 ที่: ที่ฝังในต้นไม้ + collection /reviews
    reviews: nested.treeReviews + counts.reviews,
    tree_varieties: nested.treeVarieties,
    farm_certifications: nested.certificationDetails,
    farm_smart_technologies: nested.smartTechnologies,
    // users มาจากการรวม /users กับ /accounts เข้าด้วยกัน จำนวนจริงต้อง dedupe ด้วย uid
    // จึงคำนวณแยกด้านล่าง ไม่ใช่แค่บวกกัน
    users: 0,
  };

  // dedupe users: /accounts กับ /users อ้างถึงคนเดียวกันผ่าน uid
  const uids = new Set<string>();
  for (const u of collections.users) {
    if (typeof u.uid === 'string') uids.add(u.uid);
    else uids.add(u.__id);
  }
  for (const a of collections.accounts) {
    if (typeof a.uid === 'string') uids.add(a.uid);
  }
  expectedInPostgres.users = uids.size;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const payload = {
    exportedAt: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    counts,
    nested,
    expectedInPostgres,
    errors: Object.keys(errors).length > 0 ? errors : null,
    collections,
  };

  mkdirSync(BACKUP_DIR, { recursive: true });
  const outFile = resolve(BACKUP_DIR, `firestore-${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');

  // เขียนทับไฟล์ latest ไว้ให้สคริปต์ import/verify หยิบใช้โดยไม่ต้องระบุชื่อไฟล์
  const latestFile = resolve(BACKUP_DIR, 'firestore-latest.json');
  writeFileSync(latestFile, JSON.stringify(payload, null, 2), 'utf8');

  console.log('\n--- ข้อมูลระดับ collection ---');
  for (const name of COLLECTIONS) {
    console.log(`  /${name.padEnd(9)} ${String(counts[name]).padStart(5)}`);
  }

  console.log('\n--- ข้อมูลที่ฝังอยู่ในเอกสารฟาร์ม ---');
  console.log(`  individualTrees      ${String(nested.individualTrees).padStart(5)}`);
  console.log(`  รีวิวในต้นไม้            ${String(nested.treeReviews).padStart(5)}`);
  console.log(`  treeVarieties        ${String(nested.treeVarieties).padStart(5)}`);
  console.log(`  certificationDetails ${String(nested.certificationDetails).padStart(5)}`);
  console.log(`  smartTechnologies    ${String(nested.smartTechnologies).padStart(5)}`);

  console.log('\n--- ยอดที่ Postgres ควรมีหลัง import ---');
  for (const [table, n] of Object.entries(expectedInPostgres)) {
    console.log(`  ${table.padEnd(24)} ${String(n).padStart(5)}`);
  }

  if (Object.keys(errors).length > 0) {
    console.log('\nมี collection ที่อ่านไม่สำเร็จ:');
    for (const [name, msg] of Object.entries(errors)) {
      console.log(`  /${name}: ${msg}`);
    }
  }

  console.log(`\nบันทึกแล้ว:`);
  console.log(`  ${outFile}`);
  console.log(`  ${latestFile}  (ไฟล์ที่ import/verify จะหยิบไปใช้)`);

  // firebase web SDK เปิด connection ค้างไว้ ต้องปิด process เอง
  process.exit(0);
}

main().catch((err) => {
  console.error('\nexport ล้มเหลว:', err);
  process.exit(1);
});
