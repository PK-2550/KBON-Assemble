/**
 * ทดสอบ API ทั้งชุดแบบ end-to-end
 *
 *   npm run smoke:api        (ต้องรัน npm run dev:api ไว้ก่อน)
 *
 * เขียนด้วย fetch ใน Node ไม่ใช้ curl เพราะการส่งภาษาไทยผ่าน shell บน Windows
 * ทำให้ byte เพี้ยนตั้งแต่ก่อนออกจากเครื่อง จนแยกไม่ออกว่าเป็นบั๊กของ API หรือของเชลล์
 *
 * ข้อมูลทดสอบทั้งหมดถูกลบทิ้งตอนจบ
 */

import 'dotenv/config';

const BASE = `http://localhost:${process.env.API_PORT ?? 3001}/api`;

let passed = 0;
let failed = 0;
let cookie = '';

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`  [OK  ] ${label}${detail ? '  ' + detail : ''}`); }
  else { failed++; console.log(`  [FAIL] ${label}${detail ? '  ' + detail : ''}`); }
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, setCookie };
}

const TEST_USER = `smoketest_${Date.now()}`;
const TEST_PASS = 'durian2026';
const STAMP = Date.now();
const FIXTURE_FARM = 'farm-fixture-smoke';
const FIXTURE_FARM_NAME = 'สวนทุเรียนทดสอบระบบ ภูเขาไฟ';
const FIXTURE_TREE = 'FX-MT-001';
const TEST_FARM = `farm-smoke-${Date.now()}`;

// ข้อความไทยที่มีสระบน สระล่าง วรรณยุกต์ และวรรณยุกต์ซ้อน -- ถ้า encoding เพี้ยนจะจับได้
const THAI_NAME = 'สวนทุเรียนภูเขาไฟ ลุงดำ (ทดสอบ)';
const THAI_HIGHLIGHT = 'หวานมันกรอบนอกนุ่มใน เม็ดลีบ ๑๒๓ ๙๙%';

async function main() {
  console.log(`ทดสอบ API ที่ ${BASE}\n`);

  // ---------------------------------------------------------------
  console.log('--- 1. พื้นฐาน ---');
  const health = await api('/health');
  ok('GET /health', health.status === 200 && health.body?.ok === true);
  if (health.status !== 200) {
    console.log('\n  API ไม่ตอบสนอง -- รัน npm run dev:api ไว้ก่อนหรือยัง');
    process.exit(1);
  }
  const notFound = await api('/ไม่มีจริง');
  ok('endpoint ที่ไม่มีตอบ 404 เป็น JSON', notFound.status === 404 && !!notFound.body?.error);

  // ---------------------------------------------------------------
  // สร้างข้อมูลทดสอบเอง ไม่พึ่งข้อมูลที่ย้ายมาจาก Firestore
  // เพราะข้อมูลชุดนั้นถูกลบทิ้งไปแล้ว และฐานข้อมูลอาจว่างเปล่าตอนรัน
  // ---------------------------------------------------------------
  const fx = await import('pg').then(async ({ default: pg }) => {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    return c;
  });

  await fx.query('DELETE FROM farms WHERE id = $1', [FIXTURE_FARM]);
  await fx.query(
    `INSERT INTO farms (id, rank, name, province, district, top_varieties, total_trees,
                        harvested_fruits, rating, review_count, contact_line_id, varieties_count)
     VALUES ($1, 1, $2, 'ศรีสะเกษ', 'อ.กันทรลักษ์', ARRAY['หมอนทอง','ก้านยาว'], 120, 4500, 9.8, 42, '@fixture', 2)`,
    [FIXTURE_FARM, FIXTURE_FARM_NAME]
  );
  await fx.query(
    `INSERT INTO farm_certifications (farm_id, name, short_code, cert_number, verified, document_photo)
     VALUES ($1, 'GAP (Good Agricultural Practice)', 'GAP', 'GAP-TEST-0001', true,
             'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/')`,
    [FIXTURE_FARM]
  );
  await fx.query(
    `INSERT INTO trees (id, farm_id, code, name, variety, age_years, yield_fruit_count,
                        rating, health_status, sweetness_brix)
     VALUES ($1, $2, $3, $4, 'หมอนทอง', 16, 84, 9.9, 'excellent', 34)`,
    [`tree-${FIXTURE_TREE}`, FIXTURE_FARM, FIXTURE_TREE, 'หมอนทองภูเขาไฟ ต้นแม่พันธุ์ทดสอบ']
  );
  await fx.query(
    `INSERT INTO reviews (tree_id, tree_code, farm_id, author_name, rating, comment, tasting_notes, source_id)
     VALUES ($1, $2, $3, 'คุณ ว.', 5, 'หวานมันกรอบนอกนุ่มใน เม็ดลีบมาก', ARRAY['34 Brix'], $4)`,
    [`tree-${FIXTURE_TREE}`, FIXTURE_TREE, FIXTURE_FARM, `fixture:${STAMP}`]
  );

  console.log('\n--- 2. อ่านข้อมูลฟาร์ม ---');
  const farms = await api('/farms');
  const list = farms.body?.farms ?? [];
  ok('GET /farms ได้ข้อมูล', farms.status === 200 && list.length > 0, `${list.length} ฟาร์ม`);

  const fixture = list.find((f: any) => f.id === FIXTURE_FARM);
  ok('อ่านฟาร์มที่สร้างไว้ได้ ชื่อภาษาไทยถูกต้อง', fixture?.name === FIXTURE_FARM_NAME, fixture?.name);
  ok('รูปร่างซ้อนเหมือนเดิม (individualTrees)', Array.isArray(fixture?.individualTrees) && fixture.individualTrees.length === 1);
  ok('รีวิวซ้อนอยู่ในต้นไม้', fixture?.individualTrees?.some((t: any) => (t.reviews?.length ?? 0) > 0));
  ok('ตัวเลขเป็น number ไม่ใช่ string', typeof fixture?.rating === 'number' && typeof fixture?.totalTrees === 'number');
  ok('contact ถูกประกอบกลับเป็น object', typeof fixture?.contact?.lineId === 'string');
  ok('หน้า list ไม่แนบรูป base64 มาด้วย', !JSON.stringify(list).includes('documentPhoto'));

  const detail = await api(`/farms/${FIXTURE_FARM}`);
  const hasPhoto = detail.body?.farm?.certificationDetails?.some((c: any) => typeof c.documentPhoto === 'string' && c.documentPhoto.startsWith('data:image'));
  ok('GET /farms/:id แนบรูปใบรับรองมาด้วย', hasPhoto === true);
  ok('GET /farms/:id ที่ไม่มีจริงตอบ 404', (await api('/farms/ไม่มีฟาร์มนี้')).status === 404);

  // ---------------------------------------------------------------
  console.log('\n--- 3. ต้นไม้และรีวิว ---');
  const tree = await api(`/trees/${FIXTURE_TREE}`);
  ok('GET /trees/:code ค้นด้วยรหัส NFC ได้', tree.status === 200 && tree.body?.tree?.code === FIXTURE_TREE);
  const treeReviews = await api(`/trees/${FIXTURE_TREE}/reviews`);
  ok('GET /trees/:code/reviews', treeReviews.status === 200 && Array.isArray(treeReviews.body?.reviews),
    `${treeReviews.body?.reviews?.length ?? 0} รีวิว`);
  const firstReview = treeReviews.body?.reviews?.[0];
  ok('ข้อความรีวิวภาษาไทยอ่านได้ปกติ', typeof firstReview?.comment === 'string' && /[฀-๿]/.test(firstReview.comment));

  // ---------------------------------------------------------------
  console.log('\n--- 4. สมัคร / เข้าสู่ระบบ ---');
  ok('สมัครด้วยรหัสสั้นเกินไปถูกปฏิเสธ',
    (await api('/auth/register', { method: 'POST', body: JSON.stringify({ username: TEST_USER, password: '123' }) })).status === 400);
  ok('สมัครด้วยชื่อสั้นเกินไปถูกปฏิเสธ',
    (await api('/auth/register', { method: 'POST', body: JSON.stringify({ username: 'ab', password: TEST_PASS }) })).status === 400);

  const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ username: TEST_USER, password: TEST_PASS }) });
  ok('สมัครสำเร็จ', reg.status === 201 && reg.body?.profile?.username === TEST_USER);
  ok('สมัครแล้วยังไม่ได้ล็อกอินอัตโนมัติ', !reg.setCookie);
  ok('บทบาทเริ่มต้นเป็น user ไม่ใช่ admin', reg.body?.profile?.role === 'user');
  ok('response ไม่มี password_hash หลุดออกมา', !JSON.stringify(reg.body).toLowerCase().includes('password'));

  ok('สมัครซ้ำชื่อเดิม (ต่างตัวพิมพ์) ถูกปฏิเสธ',
    (await api('/auth/register', { method: 'POST', body: JSON.stringify({ username: TEST_USER.toUpperCase(), password: TEST_PASS }) })).status === 409);

  ok('/auth/me ก่อนล็อกอินตอบ 401', (await api('/auth/me')).status === 401);

  const badLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: TEST_USER, password: 'wrongpassword' }) });
  const ghostLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'ghost_no_such_user', password: 'wrongpassword' }) });
  ok('รหัสผ่านผิดตอบ 401', badLogin.status === 401);
  ok('ข้อความ error เหมือนกันทั้งกรณีรหัสผิดและไม่มีผู้ใช้',
    badLogin.body?.error === ghostLogin.body?.error, '(ไม่เปิดเผยว่ามี username ไหนอยู่จริง)');

  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: TEST_USER, password: TEST_PASS }) });
  ok('ล็อกอินสำเร็จ', login.status === 200 && login.body?.profile?.username === TEST_USER);
  ok('token ถูกส่งมาเป็น HttpOnly cookie', /HttpOnly/i.test(login.setCookie ?? ''));
  ok('token ไม่ถูกส่งมาใน response body', !JSON.stringify(login.body).includes('eyJ'));
  ok('/auth/me หลังล็อกอินใช้ได้', (await api('/auth/me')).body?.profile?.username === TEST_USER);

  // ---------------------------------------------------------------
  console.log('\n--- 5. สิทธิ์การเข้าถึง ---');
  const newFarmBody = JSON.stringify({
    id: TEST_FARM, name: THAI_NAME, province: 'ศรีสะเกษ',
    totalTrees: 42, topVarieties: ['หมอนทอง', 'ก้านยาว'], highlight: THAI_HIGHLIGHT,
  });
  ok('ผู้ใช้ทั่วไปเพิ่มฟาร์มไม่ได้ (403)',
    (await api('/farms', { method: 'POST', body: newFarmBody })).status === 403);

  // เลื่อนเป็นแอดมินผ่าน DB โดยตรง (เหมือน npm run make:admin)
  const { Client } = await import('pg');
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });
  await dbClient.connect();
  await dbClient.query("UPDATE users SET role='admin' WHERE username_lower=$1", [TEST_USER.toLowerCase()]);

  ok('token เดิมยังไม่ได้สิทธิ์แอดมินทันที',
    (await api('/farms', { method: 'POST', body: newFarmBody })).status === 403,
    '(role อยู่ใน token ต้องล็อกอินใหม่)');

  await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: TEST_USER, password: TEST_PASS }) });
  const created = await api('/farms', { method: 'POST', body: newFarmBody });
  ok('แอดมินเพิ่มฟาร์มได้', created.status === 201, created.body?.farm?.id);

  // ---------------------------------------------------------------
  console.log('\n--- 6. ภาษาไทยไป-กลับครบทุกตัวอักษร ---');
  const readBack = await api(`/farms/${TEST_FARM}`);
  const rf = readBack.body?.farm;
  ok('ชื่อฟาร์มตรงเป๊ะ', rf?.name === THAI_NAME, rf?.name);
  ok('ข้อความจุดเด่นตรงเป๊ะ (มีเลขไทย ๑๒๓ และ %)', rf?.highlight === THAI_HIGHLIGHT, rf?.highlight);
  ok('array ภาษาไทยตรงเป๊ะ', rf?.topVarieties?.[0] === 'หมอนทอง' && rf?.topVarieties?.[1] === 'ก้านยาว');

  const dbRow = await dbClient.query('SELECT name, highlight FROM farms WHERE id=$1', [TEST_FARM]);
  ok('ค่าที่เก็บใน Postgres จริงก็ตรงเป๊ะ', dbRow.rows[0]?.name === THAI_NAME && dbRow.rows[0]?.highlight === THAI_HIGHLIGHT);

  const patched = await api(`/farms/${TEST_FARM}`, { method: 'PATCH', body: JSON.stringify({ totalTrees: 99, highlight: 'แก้ไขข้อความแล้ว' }) });
  ok('PATCH แก้ไขได้และภาษาไทยยังถูกต้อง',
    patched.body?.farm?.totalTrees === 99 && patched.body?.farm?.highlight === 'แก้ไขข้อความแล้ว');
  ok('PATCH ไม่แตะฟิลด์ที่ไม่ได้ส่งมา', patched.body?.farm?.name === THAI_NAME);

  // ---------------------------------------------------------------
  console.log('\n--- 7. เขียนรีวิวใหม่ (ของเดิมทำไม่ได้เลย) ---');
  const beforeCount = (await api(`/trees/${FIXTURE_TREE}/reviews`)).body?.reviews?.length ?? 0;
  const REVIEW_TEXT = 'เนื้อเหลืองทองแห้งเนียน หวานมัน ๓๔ บริกซ์ เม็ดลีบมาก';
  const newReview = await api(`/trees/${FIXTURE_TREE}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating: 5, comment: REVIEW_TEXT, tastingNotes: ['หวานมัน', 'เม็ดลีบ'], verifiedNfc: true }),
  });
  ok('เขียนรีวิวได้', newReview.status === 201, newReview.body?.review?.id);
  ok('ข้อความรีวิวภาษาไทยตรงเป๊ะ', newReview.body?.review?.comment === REVIEW_TEXT);
  ok('ชื่อผู้เขียนมาจาก token ไม่ใช่จาก body', newReview.body?.review?.authorName === TEST_USER);

  const afterCount = (await api(`/trees/${FIXTURE_TREE}/reviews`)).body?.reviews?.length ?? 0;
  ok('รีวิวใหม่ถูกบันทึกจริง', afterCount === beforeCount + 1, `${beforeCount} -> ${afterCount}`);

  ok('รีวิวต้นไม้ที่ไม่มีจริงตอบ 404',
    (await api('/trees/NO-SUCH-TREE/reviews', { method: 'POST', body: JSON.stringify({ rating: 5, comment: 'x' }) })).status === 404);
  ok('คะแนนนอกช่วงถูกปฏิเสธ',
    (await api(`/trees/${FIXTURE_TREE}/reviews`, { method: 'POST', body: JSON.stringify({ rating: 99, comment: 'x' }) })).status === 400);

  // ---------------------------------------------------------------
  console.log('\n--- 8. ออกจากระบบ ---');
  const logout = await api('/auth/logout', { method: 'POST' });
  ok('ออกจากระบบสำเร็จ', logout.status === 200);
  cookie = '';
  ok('หลังออกจากระบบ /auth/me ตอบ 401', (await api('/auth/me')).status === 401);

  // ---------------------------------------------------------------
  console.log('\n--- ล้างข้อมูลทดสอบ ---');
  await dbClient.query('DELETE FROM reviews WHERE source_id LIKE $1', ['api:%']);
  await dbClient.query('DELETE FROM farms WHERE id = $1', [FIXTURE_FARM]);
  await fx.end();
  await dbClient.query('DELETE FROM farms WHERE id LIKE $1', ['farm-smoke-%']);
  await dbClient.query('DELETE FROM farms WHERE id LIKE $1', ['farm-e2e-%']);
  await dbClient.query('DELETE FROM users WHERE username_lower LIKE $1', ['smoketest_%']);
  const leftover = await dbClient.query(
    "SELECT (SELECT count(*) FROM farms WHERE id LIKE 'farm-smoke-%' OR id LIKE 'farm-e2e-%')::int AS f, (SELECT count(*) FROM users WHERE username_lower LIKE 'smoketest_%')::int AS u"
  );
  ok('ข้อมูลทดสอบถูกลบหมด', leftover.rows[0].f === 0 && leftover.rows[0].u === 0);
  await dbClient.end();

  console.log(`\n--- สรุป: ผ่าน ${passed} / ไม่ผ่าน ${failed} ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nการทดสอบล้มเหลว:', err);
  process.exit(1);
});
