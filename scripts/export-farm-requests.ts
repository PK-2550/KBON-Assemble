/**
 * ดูด collection farm_requests ออกจาก Firestore มาเก็บเป็น JSON
 *
 *   npm run export:farm-requests
 *
 * ทำไมต้องมีสคริปต์แยก:
 *   ตอน export รอบแรกเราไม่รู้ว่ามี collection นี้อยู่ เพราะมันไม่ได้อยู่ใน
 *   firebase-blueprint.json เวอร์ชันที่ branch นี้มี และไม่มีโค้ดตัวไหนอ้างถึง
 *   มันถูกเพิ่มเข้ามาพร้อมฟีเจอร์สมัครฟาร์มบน branch main (commit 87ec731)
 *   ซึ่ง branch นี้ยังไม่ได้ merge เข้ามา
 *
 * ใช้ Firestore REST API แทน firebase SDK เพราะเราถอด dependency นั้นออกไปแล้ว
 * REST API ถูกบังคับด้วย security rules ชุดเดียวกับ client SDK
 * ดังนั้นจะอ่านได้ก็ต่อเมื่อ rules เปิด read ให้ farm_requests อยู่
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = resolve(__dirname, '..', 'backup');

// ค่าเหล่านี้เคยอยู่ใน firebase-applet-config.json ที่ถูกลบไปแล้ว
// apiKey ของ Firebase ฝั่งเว็บถูกออกแบบมาให้เปิดเผยได้ ไม่ใช่ความลับ
// ตัวที่กันการเข้าถึงจริงคือ security rules
const PROJECT_ID = 'kbon-pop-db';
const DATABASE_ID = 'ai-studio-durianfarmdirect-ac813d77-de78-4108-a4a7-9d20564544b8';
const API_KEY = 'AIzaSyCfri_M-vt4m_bzngY4XizU5YZDOgquZHc';

const COLLECTION = 'farm_requests';

/**
 * Firestore REST API คืนค่ามาในรูปแบบที่ระบุชนิดกำกับไว้ทุกฟิลด์
 * เช่น { "stringValue": "x" } หรือ { "integerValue": "5" }
 * ฟังก์ชันนี้แปลงกลับเป็น JSON ธรรมดา
 */
function decodeValue(v: Record<string, any>): unknown {
  if (v === null || v === undefined) return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('referenceValue' in v) return { __ref: v.referenceValue };
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  return null;
}

function decodeFields(fields: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

async function main() {
  const base =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/${DATABASE_ID}/documents/${COLLECTION}`;

  console.log(`อ่าน /${COLLECTION} จาก Firestore ผ่าน REST API...`);
  console.log(`  project  : ${PROJECT_ID}`);
  console.log(`  database : ${DATABASE_ID}\n`);

  const docs: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  let page = 0;

  do {
    const url = new URL(base);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url);
    const body = await res.json().catch(() => null) as any;

    if (!res.ok) {
      const reason = body?.error?.message ?? `HTTP ${res.status}`;
      console.error(`\nอ่านไม่สำเร็จ: ${reason}\n`);
      if (res.status === 403 || /permission/i.test(String(reason))) {
        console.error('แปลว่า security rules ยังไม่เปิด read ให้ farm_requests');
        console.error('ตรวจว่ากด Publish ในหน้า Firestore > Security แล้วหรือยัง');
      }
      process.exit(1);
    }

    for (const d of body.documents ?? []) {
      docs.push({
        __id: String(d.name).split('/').pop(),
        __createTime: d.createTime,
        __updateTime: d.updateTime,
        ...decodeFields(d.fields ?? {}),
      });
    }

    pageToken = body.nextPageToken;
    page++;
  } while (pageToken);

  const payload = {
    exportedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    collection: COLLECTION,
    count: docs.length,
    documents: docs,
  };

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = resolve(BACKUP_DIR, `farm-requests-${stamp}.json`);
  const latest = resolve(BACKUP_DIR, 'farm-requests-latest.json');
  writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
  writeFileSync(latest, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`อ่านสำเร็จ ${docs.length} เอกสาร (${page} หน้า)\n`);

  if (docs.length > 0) {
    const keys = new Set<string>();
    for (const d of docs) Object.keys(d).forEach((k) => keys.add(k));
    console.log('ฟิลด์ที่พบ:', [...keys].join(', '));

    const statuses = new Map<string, number>();
    for (const d of docs) {
      const s = String(d.status ?? '(ไม่ระบุ)');
      statuses.set(s, (statuses.get(s) ?? 0) + 1);
    }
    console.log('\nแยกตามสถานะ:');
    for (const [s, n] of statuses) console.log(`  ${s.padEnd(14)} ${n}`);
  }

  console.log(`\nบันทึกแล้ว:\n  ${outFile}\n  ${latest}`);
}

main().catch((err) => {
  console.error('ล้มเหลว:', err);
  process.exit(1);
});
