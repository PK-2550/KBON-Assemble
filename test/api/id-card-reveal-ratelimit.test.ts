import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * เพดานการเปิดดูข้อมูลบัตรประชาชน
 *
 * แยกเป็นไฟล์ของตัวเองเพราะการทดสอบต้องยิงจนชนเพดาน ซึ่งจะกินโควตา
 * ของบัญชีแอดมินที่ใช้ไปทั้งหมด ถ้าอยู่ไฟล์เดียวกับชุดอื่นจะไปทำให้ชุดอื่นล้ม
 *
 * สถานะของตัวจำกัดอัตราเก็บในหน่วยความจำของ process จึงเริ่มนับใหม่ทุกไฟล์ทดสอบ
 */

const SUFFIX = Date.now().toString(36);
const ADMIN = `ratelimit_admin_${SUFFIX}`;
const OWNER = `ratelimit_owner_${SUFFIX}`;
const PASS = 'TestPassword12345';

/** ต้องตรงกับ limit ของ idCardRevealLimiter ใน server/middleware/rateLimit.ts */
const LIMIT = 30;

let adminCookie = '';
let adminUid = '';
let ownerCookie = '';
let requestId = '';

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

beforeAll(async () => {
  for (const u of [ADMIN, OWNER]) {
    await request(app).post('/api/auth/register').send({ username: u, password: PASS });
  }
  await pool.query("UPDATE users SET role='admin' WHERE username_lower=$1", [ADMIN.toLowerCase()]);

  const adminLogin = await request(app).post('/api/auth/login').send({ username: ADMIN, password: PASS });
  adminCookie = cookieOf(adminLogin);
  adminUid = adminLogin.body?.profile?.uid ?? '';
  ownerCookie = cookieOf(await request(app).post('/api/auth/login').send({ username: OWNER, password: PASS }));

  const created = await request(app)
    .post('/api/farm-requests')
    .set('Cookie', ownerCookie)
    .send({
      farmName: `สวนทดสอบเพดาน ${SUFFIX}`,
      province: 'ระยอง',
      farmerIdCardNumber: '3210400192848',
      farmerIdCardPhoto: 'data:image/jpeg;base64,UkFURV9MSU1JVF9URVNU',
    });
  requestId = created.body?.request?.id;
});

afterAll(async () => {
  if (requestId) {
    await pool.query('DELETE FROM id_card_access_log WHERE farm_request_id = $1', [requestId]);
    await pool.query('DELETE FROM farm_requests WHERE id = $1', [requestId]);
  }
  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [ADMIN.toLowerCase(), OWNER.toLowerCase()],
  ]);
  await pool.end();
});

describe('เพดานการเปิดดูข้อมูลบัตร', () => {
  test(`เรียกครบ ${LIMIT} ครั้งได้ตามปกติ แล้วครั้งถัดไปถูกปฏิเสธด้วย 429`, async () => {
    const statuses: number[] = [];

    for (let i = 0; i < LIMIT; i += 1) {
      const res = await request(app)
        .get(`/api/farm-requests/${requestId}/id-card`)
        .set('Cookie', adminCookie);
      statuses.push(res.status);
    }

    expect(statuses.every((s) => s === 200)).toBe(true);

    const blocked = await request(app)
      .get(`/api/farm-requests/${requestId}/id-card`)
      .set('Cookie', adminCookie);

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toContain('ถี่เกินไป');
    // ตอนถูกปฏิเสธต้องไม่มีข้อมูลบัตรหลุดออกมาด้วย
    expect(JSON.stringify(blocked.body)).not.toContain('3210400192848');
  }, 60_000);

  test('การชนเพดานถูกบันทึกไว้ว่า rate_limited', async () => {
    await new Promise((r) => setTimeout(r, 300));
    const rows = await pool.query(
      `SELECT count(*)::int AS n FROM id_card_access_log
        WHERE farm_request_id = $1 AND outcome = 'rate_limited'`,
      [requestId]
    );
    expect(rows.rows[0].n).toBeGreaterThan(0);
  });

  test('เพดานแยกตามบัญชีแอดมิน ไม่ใช่ถังเดียวรวมกันทุกคน', async () => {
    // แอดมินคนแรกใช้โควตาหมดไปแล้วจากเทสต์ก่อนหน้า
    const second = `ratelimit_admin2_${SUFFIX}`;
    await request(app).post('/api/auth/register').send({ username: second, password: PASS });
    await pool.query("UPDATE users SET role='admin' WHERE username_lower=$1", [second.toLowerCase()]);
    const cookie = cookieOf(
      await request(app).post('/api/auth/login').send({ username: second, password: PASS })
    );

    const res = await request(app)
      .get(`/api/farm-requests/${requestId}/id-card`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    await pool.query('DELETE FROM users WHERE username_lower = $1', [second.toLowerCase()]);
  });

  test('ตอนโดนปฏิเสธเพราะเพดาน ไม่ถูกบันทึกว่าเปิดดูสำเร็จ', async () => {
    // นับแยกตามบัญชี เพราะเทสต์เรื่องการแยกถังข้างบนใช้แอดมินอีกคนยิงเพิ่มไปแล้วหนึ่งครั้ง
    const rows = await pool.query(
      `SELECT count(*)::int AS n FROM id_card_access_log
        WHERE farm_request_id = $1 AND outcome = 'success' AND admin_user_id = $2`,
      [requestId, adminUid]
    );

    // บันทึกได้เท่าจำนวนครั้งที่ผ่านเพดานเข้าไปจริง ไม่นับครั้งที่ถูกปฏิเสธ
    expect(rows.rows[0].n).toBe(LIMIT);
  });
});
