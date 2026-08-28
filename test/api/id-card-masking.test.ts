import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * เลขบัตรและรูปถ่ายบัตรต้องไม่หลุดออกทาง API ไม่ว่าผู้เรียกจะเป็นใคร
 *
 * เดิมมีเทสต์คุมเฉพาะเส้นทางของผู้ใช้ที่ไม่ใช่เจ้าของคำขอ (ใน smoke-farm-requests)
 * แต่ไม่มีอะไรคุมเส้นทางแอดมินเลย ทั้งที่ตอนนั้นแอดมินได้เลขเต็มกับรูปเต็ม
 * ทุกครั้งที่เรียกดูรายการคำขอ ชุดนี้จึงคุมทั้งสามมุมมอง
 * คือ เจ้าของคำขอ ผู้ใช้คนอื่น และแอดมิน
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `masktest_owner_${SUFFIX}`;
const ADMIN = `masktest_admin_${SUFFIX}`;
const PASS = 'TestPassword12345';

const ID_CARD = '1229900341828';
const ID_PHOTO = 'data:image/jpeg;base64,VEVTVF9JRF9DQVJEX1BIT1RPX0RBVEE=';

let ownerCookie = '';
let adminCookie = '';
let requestId = '';

/** ดึง cookie ของ session ออกจาก response */
function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

beforeAll(async () => {
  await request(app).post('/api/auth/register').send({ username: OWNER, password: PASS });
  await request(app).post('/api/auth/register').send({ username: ADMIN, password: PASS });
  await pool.query("UPDATE users SET role='admin' WHERE username_lower=$1", [ADMIN.toLowerCase()]);

  ownerCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: OWNER, password: PASS })
  );
  adminCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: ADMIN, password: PASS })
  );

  const created = await request(app)
    .post('/api/farm-requests')
    .set('Cookie', ownerCookie)
    .send({
      farmName: `สวนทดสอบการปิดบัง ${SUFFIX}`,
      province: 'จันทบุรี',
      farmerFullName: 'นายทดสอบ ปิดบัง',
      farmerIdCardNumber: ID_CARD,
      farmerIdCardPhoto: ID_PHOTO,
      farmerIdCardFileType: 'image',
    });

  requestId = created.body?.request?.id;
});

afterAll(async () => {
  if (requestId) {
    await pool.query('DELETE FROM farm_requests WHERE id = $1', [requestId]);
  }
  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [OWNER.toLowerCase(), ADMIN.toLowerCase()],
  ]);
  await pool.end();
});

describe('เลขบัตรและรูปถ่ายบัตรไม่หลุดออกทาง API', () => {
  test('คำขอถูกสร้างและเลขจริงถูกเก็บลงฐานข้อมูล', async () => {
    expect(requestId).toBeTruthy();
    const row = await pool.query(
      'SELECT farmer_id_card_number FROM farm_requests WHERE id = $1',
      [requestId]
    );
    expect(row.rows[0]?.farmer_id_card_number).toBe(ID_CARD);
  });

  test('คำตอบตอนสร้างคำขอ ไม่ส่งเลขเต็มหรือรูปกลับมา', async () => {
    const res = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        id: requestId,
        farmName: `สวนทดสอบการปิดบัง ${SUFFIX}`,
        province: 'จันทบุรี',
        updateNotes: 'แก้ไขเอง',
      });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain(ID_CARD);
    expect(body).not.toContain(ID_PHOTO);
    expect(res.body.request.farmerIdCardNumber).toBeUndefined();
    expect(res.body.request.farmerIdCardPhoto).toBeUndefined();
    expect(res.body.request.farmerIdCardMasked).toBe('X-XXXX-XXXXX-XX-8');
  });

  test('เจ้าของคำขอเรียก /mine ก็ไม่ได้เลขเต็มหรือรูป', async () => {
    const res = await request(app).get('/api/farm-requests/mine').set('Cookie', ownerCookie);

    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(ID_CARD);
    expect(body).not.toContain(ID_PHOTO);

    const mine = res.body.requests.find((r: { id: string }) => r.id === requestId);
    expect(mine).toBeTruthy();
    expect(mine.farmerIdCardMasked).toBe('X-XXXX-XXXXX-XX-8');
    expect(mine.hasIdCardPhoto).toBe(true);
  });

  // นี่คือเส้นทางที่เมื่อก่อนไม่มีอะไรคุมเลย
  test('แอดมินเรียกรายการคำขอ ก็ไม่ได้เลขเต็มหรือรูป', async () => {
    const res = await request(app).get('/api/farm-requests').set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(ID_CARD);
    expect(body).not.toContain(ID_PHOTO);

    const found = res.body.requests.find((r: { id: string }) => r.id === requestId);
    expect(found).toBeTruthy();
    expect(found.farmerIdCardNumber).toBeUndefined();
    expect(found.farmerIdCardPhoto).toBeUndefined();
    expect(found.farmerIdCardMasked).toBe('X-XXXX-XXXXX-XX-8');
    expect(found.hasIdCardPhoto).toBe(true);
  });

  test('ค่าที่ปิดบังเปิดเผยแค่หลักเดียว ไม่ใช่สี่หลักท้าย', async () => {
    const res = await request(app).get('/api/farm-requests').set('Cookie', adminCookie);
    const found = res.body.requests.find((r: { id: string }) => r.id === requestId);

    const digitsShown = String(found.farmerIdCardMasked).replace(/[^0-9]/g, '');
    expect(digitsShown).toHaveLength(1);
    expect(digitsShown).toBe(ID_CARD.slice(-1));
    // สามหลักก่อนหน้าของกลุ่มสี่หลักท้ายต้องไม่โผล่ออกมา
    expect(String(found.farmerIdCardMasked)).not.toContain(ID_CARD.slice(9, 12));
  });
});
