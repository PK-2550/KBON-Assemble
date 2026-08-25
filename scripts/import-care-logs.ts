/**
 * นำประวัติการดูแลจากไฟล์เข้าสู่ระบบ
 *
 *   npm run import:care-logs -- ไฟล์.json
 *   npm run import:care-logs -- ไฟล์.csv
 *   npm run import:care-logs -- --demo        สร้างข้อมูลตัวอย่างให้ต้นไม้ demo
 *
 * ใช้ endpoint เดียวกับที่ระบบของสวนจะเรียก (POST /api/care-logs/import)
 * จึงเป็นการทดสอบเส้นทางข้อมูลจริงไปในตัว ไม่ได้เขียนลงฐานข้อมูลตรง ๆ
 *
 * รูปแบบ JSON
 *   [ { "treeCode": "VK-001", "activityType": "watering",
 *       "performedAt": "2026-08-16", "notes": "...",
 *       "externalId": "farm-sys-001",
 *       "photos": ["https://...", { "photo": "data:image/jpeg;base64,...", "caption": "..." }] } ]
 *
 * รูปแบบ CSV -- บรรทัดแรกเป็นหัวคอลัมน์
 *   treeCode,activityType,performedAt,notes,externalId,photos
 *   VK-001,watering,2026-08-16,รดน้ำเช้า,farm-sys-001,https://a.jpg|https://b.jpg
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';

const BASE = `http://localhost:${process.env.API_PORT ?? 3001}/api`;

interface CareLogInput {
  treeCode: string;
  activityType: string;
  activityLabel?: string;
  performedAt: string;
  notes?: string;
  externalId?: string;
  source?: string;
  photos?: (string | { photo: string; caption?: string })[];
}

/** อ่าน CSV แบบง่าย -- รองรับค่าที่ครอบด้วยเครื่องหมายคำพูดและมีจุลภาคข้างใน */
function parseCsv(text: string): CareLogInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const splitRow = (row: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        // สองอัญประกาศติดกันในค่าที่ครอบอยู่ หมายถึงอัญประกาศตัวจริงหนึ่งตัว
        if (quoted && row[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (c === ',' && !quoted) {
        out.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headers = splitRow(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return {
      treeCode: row.treeCode,
      activityType: row.activityType || 'other',
      activityLabel: row.activityLabel || undefined,
      performedAt: row.performedAt,
      notes: row.notes || undefined,
      externalId: row.externalId || undefined,
      source: row.source || undefined,
      // หลายรูปคั่นด้วย | เพราะจุลภาคถูกใช้เป็นตัวคั่นคอลัมน์อยู่แล้ว
      photos: row.photos ? row.photos.split('|').map((s) => s.trim()).filter(Boolean) : undefined,
    };
  });
}

const DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800&auto=format&fit=crop&q=80',
];

const DEMO_ACTIVITIES: {
  type: string;
  notes: string;
  photos: number;
}[] = [
  { type: 'watering', notes: 'รดน้ำระบบมินิสปริงเกลอร์ ควบคุมความชื้นดินที่ 65%', photos: 1 },
  { type: 'fertilizing', notes: 'ใส่ปุ๋ยอินทรีย์มูลค้างคาวผสมฮิวมัส บำรุงระบบรากและใบสะสมอาหาร', photos: 2 },
  { type: 'pruning', notes: 'แต่งกิ่งกระโดงและกิ่งน้ำค้าง เปิดทรงพุ่มให้แสงส่องถึงกลางต้น', photos: 2 },
  { type: 'spraying', notes: 'พ่นสารชีวภัณฑ์ป้องกันเชื้อไฟทอปธอรา รอบโคนต้นและใต้ใบ', photos: 1 },
  { type: 'inspection', notes: 'ตรวจความสมบูรณ์ของผลและติดแท็ก NFC ที่ขั้วผลตามมาตรฐาน GI', photos: 3 },
  { type: 'harvesting', notes: 'ตัดผลชุดแรกของฤดู วัดค่าความหวานเฉลี่ย 33 บริกซ์', photos: 2 },
];

/** สร้างข้อมูลตัวอย่างให้ต้นไม้ที่มาจาก seed:demo */
async function buildDemoLogs(): Promise<CareLogInput[]> {
  const res = await fetch(`${BASE}/farms`);
  if (!res.ok) throw new Error('ดึงรายชื่อฟาร์มไม่สำเร็จ -- รัน npm run dev:api ไว้หรือยัง');
  const { farms } = (await res.json()) as { farms: { id: string; individualTrees?: { code: string }[] }[] };

  const demoTrees = farms
    .filter((f) => f.id.startsWith('demo-'))
    .flatMap((f) => (f.individualTrees ?? []).map((t) => t.code));

  if (demoTrees.length === 0) {
    throw new Error('ไม่พบต้นไม้ที่มาจาก seed:demo -- รัน npm run seed:demo ก่อน');
  }

  const logs: CareLogInput[] = [];
  for (const code of demoTrees) {
    // ให้แต่ละต้นมีประวัติย้อนหลังไม่เท่ากัน จะได้เห็นว่าเรียงตามวันที่จริง
    const count = 3 + (code.charCodeAt(code.length - 1) % 4);
    for (let i = 0; i < count; i++) {
      const act = DEMO_ACTIVITIES[i % DEMO_ACTIVITIES.length];
      const d = new Date(2026, 7, 20 - i * 9);
      logs.push({
        treeCode: code,
        activityType: act.type,
        performedAt: d.toISOString().slice(0, 10),
        notes: act.notes,
        source: 'import',
        externalId: `demo:${code}:${i}`,
        photos: DEMO_PHOTOS.slice(0, act.photos),
      });
    }
  }
  return logs;
}

async function main() {
  const args = process.argv.slice(2);
  const apiKey = process.env.CARE_LOG_API_KEY;
  if (!apiKey) {
    console.error('ไม่พบ CARE_LOG_API_KEY ในไฟล์ .env');
    process.exit(1);
  }

  let logs: CareLogInput[];

  if (args.includes('--demo')) {
    console.log('สร้างข้อมูลตัวอย่างจากต้นไม้ที่มาจาก seed:demo\n');
    logs = await buildDemoLogs();
  } else {
    const file = args.find((a) => !a.startsWith('--'));
    if (!file) {
      console.error('ระบุไฟล์ที่จะนำเข้า หรือใช้ --demo เพื่อสร้างข้อมูลตัวอย่าง');
      console.error('  npm run import:care-logs -- ไฟล์.json');
      console.error('  npm run import:care-logs -- --demo');
      process.exit(1);
    }
    const raw = readFileSync(file, 'utf8');
    logs = file.toLowerCase().endsWith('.csv') ? parseCsv(raw) : JSON.parse(raw);
    if (!Array.isArray(logs)) {
      console.error('ไฟล์ JSON ต้องเป็น array ของรายการ');
      process.exit(1);
    }
    console.log(`อ่าน ${logs.length} รายการจาก ${file}\n`);
  }

  // ส่งเป็นชุดละ 200 รายการ กันไม่ให้ body ใหญ่เกินไปเมื่อมีรูป base64
  const BATCH = 200;
  let inserted = 0;
  let updated = 0;
  let photos = 0;

  for (let i = 0; i < logs.length; i += BATCH) {
    const chunk = logs.slice(i, i + BATCH);
    const res = await fetch(`${BASE}/care-logs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ logs: chunk }),
    });
    const body = (await res.json().catch(() => null)) as any;

    if (!res.ok) {
      console.error(`\nชุดที่ ${Math.floor(i / BATCH) + 1} ล้มเหลว: ${body?.error ?? res.status}`);
      process.exit(1);
    }

    inserted += body.inserted;
    updated += body.updated;
    photos += body.photos;
    process.stdout.write(`  ส่งแล้ว ${Math.min(i + BATCH, logs.length)}/${logs.length}\r`);
  }

  console.log(`\n\nนำเข้าสำเร็จ`);
  console.log(`  เพิ่มใหม่   ${inserted}`);
  console.log(`  อัปเดตทับ  ${updated}`);
  console.log(`  รูปแนบ     ${photos}`);
  console.log('\nรันซ้ำได้ รายการที่มี externalId เดิมจะถูกอัปเดตทับ ไม่เพิ่มซ้ำ');
}

main().catch((err) => {
  console.error('\nล้มเหลว:', err instanceof Error ? err.message : err);
  process.exit(1);
});
