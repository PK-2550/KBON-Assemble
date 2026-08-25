/**
 * ทดสอบ API คำขอขึ้นทะเบียนสวนและระบบอนุมัติ แบบ end-to-end
 *
 *   npm run smoke:farm-requests     (ต้องรัน npm run dev:api ไว้ก่อน)
 *
 * ครอบคลุมทั้งเส้นทางปกติและเรื่องสิทธิ์ที่ระบบเดิมทำไม่ได้
 * ข้อมูลทดสอบทั้งหมดถูกลบทิ้งตอนจบ
 */

import 'dotenv/config';
import { Client } from 'pg';

const BASE = `http://localhost:${process.env.API_PORT ?? 3001}/api`;

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`  [OK  ] ${label}${detail ? '  ' + detail : ''}`); }
  else { failed++; console.log(`  [FAIL] ${label}${detail ? '  ' + detail : ''}`); }
}

/** แต่ละ session เก็บ cookie แยกกัน เพื่อจำลองผู้ใช้หลายคนพร้อมกัน */
class Session {
  cookie = '';
  constructor(readonly name: string) {}

  async call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(init.headers ?? {}),
      },
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  }

  async register(username: string, password: string) {
    await this.call('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
  }
  async login(username: string, password: string) {
    return this.call('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  }
}

const STAMP = Date.now();
const FARMER = `smokefarmer_${STAMP}`;
const OTHER = `smokeother_${STAMP}`;
const ADMIN = `smokeadmin_${STAMP}`;
const PASS = 'durian2026';

const THAI_FARM = 'สวนทุเรียนทดสอบ ลุงมะนาว ๙';
const THAI_STORY = 'สวนอินทรีย์ ๑๐๐% หวานมันกรอบนอกนุ่มใน';

async function main() {
  console.log(`ทดสอบ API คำขอขึ้นทะเบียนสวนที่ ${BASE}\n`);

  const health = await new Session('x').call('/health');
  if (health.status !== 200) {
    console.log('  API ไม่ตอบสนอง -- รัน npm run dev:api ไว้ก่อนหรือยัง');
    process.exit(1);
  }

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  // จดยอดตั้งต้นไว้เทียบตอนจบ แทนการ hardcode ตัวเลข
  // ฐานข้อมูลอาจว่างหรือมีข้อมูลอยู่แล้วก็ได้ แล้วแต่ว่ารันตอนไหน
  const baseline = (
    await db.query(
      `SELECT (SELECT count(*)::int FROM farms) AS farms,
              (SELECT count(*)::int FROM trees) AS trees,
              (SELECT count(*)::int FROM reviews) AS reviews`
    )
  ).rows[0];

  const farmer = new Session('farmer');
  const other = new Session('other');
  const admin = new Session('admin');

  await farmer.register(FARMER, PASS);
  await other.register(OTHER, PASS);
  await admin.register(ADMIN, PASS);
  await db.query("UPDATE users SET role='admin' WHERE username_lower=$1", [ADMIN.toLowerCase()]);

  await farmer.login(FARMER, PASS);
  await other.login(OTHER, PASS);
  const adminLogin = await admin.login(ADMIN, PASS);
  ok('เตรียมบัญชีทดสอบ 3 คน', adminLogin.body?.profile?.role === 'admin');

  // ---------------------------------------------------------------
  console.log('\n--- 1. ยื่นคำขอ ---');
  ok('ยื่นคำขอโดยไม่ล็อกอินไม่ได้',
    (await new Session('anon').call('/farm-requests', {
      method: 'POST', body: JSON.stringify({ farmName: 'x', province: 'จันทบุรี' }),
    })).status === 401);

  ok('ไม่กรอกชื่อสวนถูกปฏิเสธ',
    (await farmer.call('/farm-requests', {
      method: 'POST', body: JSON.stringify({ province: 'จันทบุรี' }),
    })).status === 400);

  const submitted = await farmer.call('/farm-requests', {
    method: 'POST',
    body: JSON.stringify({
      farmName: THAI_FARM,
      province: 'จันทบุรี',
      district: 'ท่าใหม่',
      areaRai: 35,
      totalTreesEstimate: 450,
      topVarieties: ['หมอนทอง', 'ก้านยาว'],
      aboutStory: THAI_STORY,
      gapCertNumber: 'GAP-TH-68-000001',
      certIssuedBy: 'กรมวิชาการเกษตร',
      certValidUntil: '2029',
      farmerIdCardNumber: '1234567890123',
      agreedToCriteria: true,
      hasSmartFarm: true,
      smartTechnologies: [{ id: 'st-1', name: 'ระบบน้ำหยด', subtext: 'IoT', iconEmoji: '💧', active: true }],
      contact: { phoneNumber: '081-000-0000', lineId: '@testfarm' },
      atmospherePhotos: ['https://example.com/a.jpg'],
      coordinates: { lat: 12.7, lng: 101.6 },
    }),
  });
  const reqId = submitted.body?.request?.id;
  ok('ยื่นคำขอสำเร็จ', submitted.status === 201 && !!reqId, reqId);
  ok('ชื่อสวนภาษาไทยตรงเป๊ะ', submitted.body?.request?.farmName === THAI_FARM);
  ok('ข้อมูลซ้อน (contact/smartTech/coordinates) ถูกเก็บครบ',
    submitted.body?.request?.contact?.lineId === '@testfarm' &&
    submitted.body?.request?.smartTechnologies?.length === 1 &&
    submitted.body?.request?.coordinates?.lat === 12.7);
  ok('สถานะเริ่มต้นเป็น pending', submitted.body?.request?.status === 'pending');

  const dbRow = await db.query('SELECT farm_name, about_story, user_id FROM farm_requests WHERE id=$1', [reqId]);
  ok('ค่าใน Postgres จริงตรงเป๊ะ',
    dbRow.rows[0]?.farm_name === THAI_FARM && dbRow.rows[0]?.about_story === THAI_STORY);

  const farmerProfile = await farmer.call('/auth/me');
  ok('user_id มาจาก token ไม่ใช่ body',
    dbRow.rows[0]?.user_id === farmerProfile.body?.profile?.uid);

  // ---------------------------------------------------------------
  console.log('\n--- 2. สิทธิ์การมองเห็นคำขอ ---');
  const otherList = await other.call('/farm-requests');
  ok('ผู้ใช้คนอื่นมองไม่เห็นคำขอนี้',
    !JSON.stringify(otherList.body?.requests ?? []).includes(reqId),
    '(ของเดิมใครก็อ่านเลขบัตรประชาชนคนอื่นได้)');

  const ownList = await farmer.call('/farm-requests/mine');
  ok('เจ้าของเห็นคำขอตัวเอง',
    (ownList.body?.requests ?? []).some((r: any) => r.id === reqId));

  const adminList = await admin.call('/farm-requests');
  ok('แอดมินเห็นคำขอทั้งหมด',
    (adminList.body?.requests ?? []).some((r: any) => r.id === reqId));

  // ---------------------------------------------------------------
  console.log('\n--- 3. ตีกลับให้แก้ไข แล้วส่งใหม่ ---');
  ok('ผู้ใช้ทั่วไปตีกลับคำขอไม่ได้',
    (await other.call(`/farm-requests/${reqId}/reject`, {
      method: 'POST', body: JSON.stringify({ adminNotes: 'x', needsRevision: true }),
    })).status === 403);

  const rejected = await admin.call(`/farm-requests/${reqId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ adminNotes: 'กรุณาแนบรูปใบรับรองเพิ่ม', needsRevision: true }),
  });
  ok('แอดมินตีกลับได้', rejected.body?.request?.status === 'needs_revision');
  ok('หมายเหตุแอดมินภาษาไทยถูกบันทึก',
    rejected.body?.request?.adminNotes === 'กรุณาแนบรูปใบรับรองเพิ่ม');

  const resubmitted = await farmer.call('/farm-requests', {
    method: 'POST',
    body: JSON.stringify({
      id: reqId, farmName: THAI_FARM, province: 'จันทบุรี',
      gapCertNumber: 'GAP-TH-68-000001', certDocumentPhoto: 'data:image/jpeg;base64,AAAA',
    }),
  });
  ok('ส่งใหม่แล้วกลับเป็น pending', resubmitted.body?.request?.status === 'pending');
  ok('เก็บหมายเหตุเดิมของแอดมินไว้ดูย้อนหลัง',
    resubmitted.body?.request?.previousAdminNotes === 'กรุณาแนบรูปใบรับรองเพิ่ม');

  // ---------------------------------------------------------------
  console.log('\n--- 4. อนุมัติ (ต้องเป็น transaction เดียว) ---');
  ok('ผู้ใช้ทั่วไปอนุมัติไม่ได้',
    (await other.call(`/farm-requests/${reqId}/approve`, { method: 'POST', body: '{}' })).status === 403);

  const approved = await admin.call(`/farm-requests/${reqId}/approve`, { method: 'POST', body: '{}' });
  const newFarmId = approved.body?.farm?.id;
  ok('แอดมินอนุมัติได้', approved.status === 200 && !!newFarmId, newFarmId);
  ok('คำขอเปลี่ยนเป็น approved', approved.body?.request?.status === 'approved');
  ok('ฟาร์มถูกสร้างพร้อมชื่อไทยที่ถูกต้อง', approved.body?.farm?.name === THAI_FARM);
  ok('ใบรับรองถูกสร้างจากข้อมูลคำขอ',
    (approved.body?.farm?.certificationDetails ?? []).length > 0);
  ok('SmartFarm ถูกยกมาด้วย',
    (approved.body?.farm?.smartTechnologies ?? []).length === 1);

  const userAfter = await db.query('SELECT role, managed_farm_id FROM users WHERE username_lower=$1', [FARMER.toLowerCase()]);
  ok('ผู้ยื่นถูกเลื่อนเป็น manager', userAfter.rows[0]?.role === 'manager');
  ok('บัญชีถูกผูกกับฟาร์ม', userAfter.rows[0]?.managed_farm_id === newFarmId);

  const farmRow = await db.query('SELECT manager_id FROM farms WHERE id=$1', [newFarmId]);
  ok('ฟาร์มถูกผูกกลับมาที่บัญชี (สองทาง)',
    farmRow.rows[0]?.manager_id === farmerProfile.body?.profile?.uid);

  ok('อนุมัติซ้ำถูกปฏิเสธ',
    (await admin.call(`/farm-requests/${reqId}/approve`, { method: 'POST', body: '{}' })).status === 409);

  // ---------------------------------------------------------------
  console.log('\n--- 5. สิทธิ์แก้ไขฟาร์ม ---');
  // token เดิมของ farmer ยังถือ role 'user' อยู่ ต้องล็อกอินใหม่ให้ได้ role manager
  await farmer.login(FARMER, PASS);
  const meAfter = await farmer.call('/auth/me');
  ok('ล็อกอินใหม่แล้วได้ role manager', meAfter.body?.profile?.role === 'manager');

  const edited = await farmer.call(`/farms/${newFarmId}`, {
    method: 'PUT',
    body: JSON.stringify({ ...approved.body.farm, highlight: 'แก้ไขโดยผู้จัดการสวน' }),
  });
  ok('ผู้จัดการแก้ไขฟาร์มตัวเองได้', edited.body?.farm?.highlight === 'แก้ไขโดยผู้จัดการสวน');

  ok('คนอื่นแก้ไขฟาร์มนี้ไม่ได้',
    (await other.call(`/farms/${newFarmId}`, {
      method: 'PUT', body: JSON.stringify({ name: 'ยึดฟาร์ม' }),
    })).status === 403,
    '(ของเดิมใครก็เขียนทับฟาร์มไหนก็ได้)');

  const stillOwned = await db.query('SELECT manager_id, name FROM farms WHERE id=$1', [newFarmId]);
  ok('เจ้าของฟาร์มไม่ถูกเปลี่ยนจากการแก้ไข',
    stillOwned.rows[0]?.manager_id === farmerProfile.body?.profile?.uid &&
    stillOwned.rows[0]?.name === THAI_FARM);

  ok('ต้นไม้ของฟาร์มเดิมไม่ถูกลบตอนเขียนทับ',
    Number((await db.query('SELECT count(*)::int AS n FROM trees')).rows[0].n) === baseline.trees,
    '(upsertFarm ไม่แตะตาราง trees)');

  // ---------------------------------------------------------------
  console.log('\n--- 6. ลบฟาร์ม ---');
  ok('ผู้จัดการลบฟาร์มไม่ได้',
    (await farmer.call(`/farms/${newFarmId}`, { method: 'DELETE' })).status === 403);
  ok('แอดมินลบได้',
    (await admin.call(`/farms/${newFarmId}`, { method: 'DELETE' })).status === 200);
  ok('ฟาร์มหายจากฐานข้อมูลจริง',
    Number((await db.query('SELECT count(*)::int AS n FROM farms WHERE id=$1', [newFarmId])).rows[0].n) === 0);

  // ---------------------------------------------------------------
  console.log('\n--- ล้างข้อมูลทดสอบ ---');
  await db.query('DELETE FROM farm_requests WHERE id = $1', [reqId]);
  await db.query("DELETE FROM users WHERE username_lower LIKE 'smokefarmer_%' OR username_lower LIKE 'smokeother_%' OR username_lower LIKE 'smokeadmin_%'");
  const leftover = await db.query(
    "SELECT (SELECT count(*) FROM farm_requests)::int AS r, (SELECT count(*) FROM users WHERE username_lower LIKE 'smoke%')::int AS u"
  );
  ok('ข้อมูลทดสอบถูกลบหมด', leftover.rows[0].r === 0 && leftover.rows[0].u === 0);

  const finalCounts = await db.query(
    'SELECT (SELECT count(*)::int FROM farms) AS f, (SELECT count(*)::int FROM trees) AS t, (SELECT count(*)::int FROM reviews) AS rv'
  );
  ok('ยอดข้อมูลกลับมาเท่าตอนเริ่มทดสอบ',
    finalCounts.rows[0].f === baseline.farms && finalCounts.rows[0].t === baseline.trees && finalCounts.rows[0].rv === baseline.reviews,
    `farms=${finalCounts.rows[0].f} trees=${finalCounts.rows[0].t} reviews=${finalCounts.rows[0].rv}`);

  await db.end();

  console.log(`\n--- สรุป: ผ่าน ${passed} / ไม่ผ่าน ${failed} ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nการทดสอบล้มเหลว:', err);
  process.exit(1);
});
