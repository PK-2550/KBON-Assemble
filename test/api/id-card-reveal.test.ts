import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * endpoint เปิดเผยเลขบัตรและสำเนาบัตรฉบับเต็ม
 *
 * เป็นประตูบานเดียวที่ข้อมูลนี้ออกจากระบบได้ ชุดนี้จึงคุมทั้งสามด่าน
 * คือ การตรวจสิทธิ์ การบันทึกการเข้าถึง และการไม่รั่วออกทางอื่น
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `reveal_owner_${SUFFIX}`;
const OTHER = `reveal_other_${SUFFIX}`;
const ADMIN = `reveal_admin_${SUFFIX}`;
const PASS = 'TestPassword12345';

const ID_CARD = '1229900341828';
const ID_PHOTO = 'data:image/jpeg;base64,UkVWRUFMX1RFU1RfUEhPVE9fREFUQQ==';

let ownerCookie = '';
let otherCookie = '';
let adminCookie = '';
let adminUid = '';
let requestId = '';

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

beforeAll(async () => {
  for (const u of [OWNER, OTHER, ADMIN]) {
    await request(app).post('/api/auth/register').send({ username: u, password: PASS });
  }
  await pool.query("UPDATE users SET role='admin' WHERE username_lower=$1", [ADMIN.toLowerCase()]);

  ownerCookie = cookieOf(await request(app).post('/api/auth/login').send({ username: OWNER, password: PASS }));
  otherCookie = cookieOf(await request(app).post('/api/auth/login').send({ username: OTHER, password: PASS }));

  const adminLogin = await request(app).post('/api/auth/login').send({ username: ADMIN, password: PASS });
  adminCookie = cookieOf(adminLogin);
  adminUid = adminLogin.body?.profile?.uid ?? '';

  const created = await request(app)
    .post('/api/farm-requests')
    .set('Cookie', ownerCookie)
    .send({
      farmName: `สวนทดสอบเปิดเผย ${SUFFIX}`,
      province: 'จันทบุรี',
      farmerFullName: 'นายทดสอบ เปิดเผย',
      farmerIdCardNumber: ID_CARD,
      farmerIdCardPhoto: ID_PHOTO,
      farmerIdCardFileType: 'image',
    });
  requestId = created.body?.request?.id;
});

afterAll(async () => {
  if (requestId) {
    await pool.query('DELETE FROM id_card_access_log WHERE farm_request_id = $1', [requestId]);
    await pool.query('DELETE FROM farm_requests WHERE id = $1', [requestId]);
  }
  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [OWNER.toLowerCase(), OTHER.toLowerCase(), ADMIN.toLowerCase()],
  ]);
  await pool.end();
});

describe('การตรวจสิทธิ์', () => {
  test('ไม่ได้ล็อกอินเลย เข้าไม่ได้', async () => {
    const res = await request(app).get(`/api/farm-requests/${requestId}/id-card`);
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain(ID_CARD);
  });

  test('เจ้าของคำขอเองก็เข้าไม่ได้ ถ้าไม่ใช่แอดมิน', async () => {
    const res = await request(app)
      .get(`/api/farm-requests/${requestId}/id-card`)
      .set('Cookie', ownerCookie);

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain(ID_CARD);
  });

  test('ผู้ใช้คนอื่นเข้าไม่ได้', async () => {
    const res = await request(app)
      .get(`/api/farm-requests/${requestId}/id-card`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain(ID_CARD);
  });
});

describe('แอดมินเปิดดูได้ และได้ข้อมูลถูกต้อง', () => {
  test('ได้เลขเต็มและสำเนาบัตรกลับมาตรงกับที่ยื่นไว้', async () => {
    const res = await request(app)
      .get(`/api/farm-requests/${requestId}/id-card`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.farmerIdCardNumber).toBe(ID_CARD);
    expect(res.body.farmerIdCardPhoto).toBe(ID_PHOTO);
    expect(res.body.farmerIdCardFileType).toBe('image');
  });

  test('ตอบพร้อม Cache-Control: no-store', async () => {
    const res = await request(app)
      .get(`/api/farm-requests/${requestId}/id-card`)
      .set('Cookie', adminCookie);

    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('คำขอที่ไม่มีอยู่จริง ตอบ 404', async () => {
    const res = await request(app)
      .get('/api/farm-requests/req_ไม่มีจริง_zzz/id-card')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(404);
  });
});

describe('บันทึกการเข้าถึง', () => {
  test('บันทึกว่าใคร ดูของใคร เมื่อไหร่ ทุกครั้งที่เปิดดูสำเร็จ', async () => {
    const before = await pool.query(
      'SELECT count(*)::int AS n FROM id_card_access_log WHERE farm_request_id = $1',
      [requestId]
    );

    await request(app).get(`/api/farm-requests/${requestId}/id-card`).set('Cookie', adminCookie);

    const after = await pool.query(
      `SELECT admin_user_id, farm_request_id, outcome, accessed_at, ip
         FROM id_card_access_log
        WHERE farm_request_id = $1
        ORDER BY accessed_at DESC LIMIT 1`,
      [requestId]
    );
    const count = await pool.query(
      'SELECT count(*)::int AS n FROM id_card_access_log WHERE farm_request_id = $1',
      [requestId]
    );

    expect(count.rows[0].n).toBe(before.rows[0].n + 1);
    expect(after.rows[0].admin_user_id).toBe(adminUid);
    expect(after.rows[0].farm_request_id).toBe(requestId);
    expect(after.rows[0].outcome).toBe('success');
    expect(after.rows[0].accessed_at).toBeInstanceOf(Date);
  });

  test('บันทึกความพยายามที่ล้มเหลวด้วย ไม่ใช่เงียบไป', async () => {
    const missingId = `req_ไม่มีจริง_${SUFFIX}`;
    await request(app).get(`/api/farm-requests/${missingId}/id-card`).set('Cookie', adminCookie);

    const row = await pool.query(
      'SELECT outcome, admin_user_id FROM id_card_access_log WHERE farm_request_id = $1',
      [missingId]
    );

    expect(row.rows[0]?.outcome).toBe('not_found');
    expect(row.rows[0]?.admin_user_id).toBe(adminUid);

    await pool.query('DELETE FROM id_card_access_log WHERE farm_request_id = $1', [missingId]);
  });

  test('คนที่ไม่มีสิทธิ์ ถูกบันทึกว่า forbidden ไม่ใช่ success', async () => {
    await request(app).get(`/api/farm-requests/${requestId}/id-card`).set('Cookie', otherCookie);
    await new Promise((r) => setTimeout(r, 300));

    const rows = await pool.query(
      `SELECT outcome, count(*)::int AS n FROM id_card_access_log
        WHERE farm_request_id = $1 AND admin_user_id <> $2
        GROUP BY outcome`,
      [requestId, adminUid]
    );

    // มีบันทึกไว้แน่ ๆ แต่ต้องไม่ใช่ success
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r: { outcome: string }) => r.outcome === 'forbidden')).toBe(true);
  });
});

describe('ทางที่ถอดรหัสไม่ผ่าน', () => {
  test('ciphertext ที่ถูกแก้ ตอบ 500 ข้อความกลาง ๆ และบันทึกว่า decrypt_failed', async () => {
    // ทำให้แถวมี ciphertext ที่พังโดยตั้งใจ เพื่อบังคับให้เดินเส้นทางถอดรหัสล้มเหลว
    await pool.query(
      `UPDATE farm_requests SET farmer_id_card_ciphertext = $2 WHERE id = $1`,
      [requestId, Buffer.from('ก้อนนี้ไม่ใช่ ciphertext ที่ถูกต้องเลยแม้แต่นิดเดียว')]
    );

    const res = await request(app)
      .get(`/api/farm-requests/${requestId}/id-card`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(500);
    // ต้องไม่บอกว่าล้มเพราะอะไร และต้องไม่มีข้อมูลจริงหลุดมา
    expect(JSON.stringify(res.body)).not.toContain(ID_CARD);
    expect(res.body.error).toBe('อ่านข้อมูลบัตรประชาชนไม่สำเร็จ');

    const log = await pool.query(
      `SELECT outcome FROM id_card_access_log
        WHERE farm_request_id = $1 ORDER BY accessed_at DESC LIMIT 1`,
      [requestId]
    );
    expect(log.rows[0]?.outcome).toBe('decrypt_failed');

    // คืนค่าเดิมให้ชุดถัดไปใช้ได้
    await pool.query(`UPDATE farm_requests SET farmer_id_card_ciphertext = NULL WHERE id = $1`, [
      requestId,
    ]);
  });
});

describe('บันทึกความพยายามของคนที่ไม่มีสิทธิ์', () => {
  test('คนที่ไม่ใช่แอดมินถูกบันทึกว่า forbidden', async () => {
    await pool.query(`DELETE FROM id_card_access_log WHERE farm_request_id = $1`, [requestId]);

    const res = await request(app)
      .get(`/api/farm-requests/${requestId}/id-card`)
      .set('Cookie', otherCookie);
    expect(res.status).toBe(403);

    // เขียนแบบไม่รอผล จึงเผื่อเวลาให้เขียนเสร็จก่อนตรวจ
    await new Promise((r) => setTimeout(r, 300));

    const log = await pool.query(
      `SELECT outcome, admin_user_id FROM id_card_access_log WHERE farm_request_id = $1`,
      [requestId]
    );
    expect(log.rows[0]?.outcome).toBe('forbidden');
    expect(log.rows[0]?.admin_user_id).not.toBe(adminUid);
  });
});

describe('ข้อมูลไม่รั่วออกทางอื่น', () => {
  test('รายการคำขอของแอดมินยังปิดบังอยู่ ถึงจะเคยกดเปิดดูแล้วก็ตาม', async () => {
    const res = await request(app).get('/api/farm-requests').set('Cookie', adminCookie);
    const body = JSON.stringify(res.body);

    expect(body).not.toContain(ID_CARD);
    expect(body).not.toContain(ID_PHOTO);
  });
});
