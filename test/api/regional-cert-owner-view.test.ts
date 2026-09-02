import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * เจ้าของสวนดูสถานะใบรับรองระดับโซนของสวนตัวเอง
 *
 * ใบอย่าง GI ไม่ได้ขึ้นตราทันทีที่อนุมัติคำขอสมัคร แต่ไปรอให้แอดมินจับคู่โซนก่อน
 * ถ้าแอดมินปฏิเสธ เหตุผลถูกบันทึกไว้แล้วตั้งแต่ต้น แต่ไม่มีทางไหนที่เจ้าของสวน
 * จะได้อ่านเลย
 *
 * จากมุมเจ้าของสวนคือกรอกใบครบ รอไปเรื่อย ๆ แล้วตราไม่เคยขึ้น โดยไม่รู้ว่า
 * ติดอยู่ที่ขั้นไหนหรือถูกปฏิเสธไปแล้ว
 *
 * ชุดนี้คุมประตูด้วย เพราะเหตุผลที่ปฏิเสธกับข้อมูลใบเป็นเรื่องของสวนนั้น
 * ไม่ใช่ของสาธารณะ หน้าโปรไฟล์สวนใครเปิดดูก็ได้
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `ownerview_owner_${SUFFIX}`;
const OTHER = `ownerview_other_${SUFFIX}`;
const ADMIN = `ownerview_admin_${SUFFIX}`;
const PASS = 'TestPassword12345';
const FARM_NAME = `สวนทดสอบเจ้าของดูสถานะ ${SUFFIX}`;

let ownerCookie = '';
let otherCookie = '';
let adminCookie = '';
let farmId = '';
let requestId = 0;
let giZoneId = 0;

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

  ownerCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: OWNER, password: PASS })
  );
  otherCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: OTHER, password: PASS })
  );
  adminCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: ADMIN, password: PASS })
  );

  const created = await request(app)
    .post('/api/farm-requests')
    .set('Cookie', ownerCookie)
    .send({
      farmName: FARM_NAME,
      province: 'จันทบุรี',
      farmerFullName: 'นายทดสอบ เจ้าของสวน',
      certificationList: [
        { shortCode: 'GI', certNumber: `GI-OWN-${SUFFIX}`, issuedBy: 'กรมทรัพย์สินทางปัญญา' },
      ],
    });

  const approved = await request(app)
    .post(`/api/farm-requests/${created.body.request.id}/approve`)
    .set('Cookie', adminCookie)
    .send({});
  farmId = approved.body.farm.id;

  const pending = await pool.query(
    `SELECT id FROM regional_certification_requests WHERE farm_id = $1`,
    [farmId]
  );
  requestId = Number(pending.rows[0].id);

  const zones = await pool.query(
    `SELECT rc.id FROM regional_certifications rc
       JOIN certification_types ct ON ct.id = rc.certification_type_id
      WHERE ct.code = 'GI' ORDER BY rc.id LIMIT 1`
  );
  giZoneId = Number(zones.rows[0].id);
});

afterAll(async () => {
  const junk = await pool.query(`SELECT id FROM farms WHERE name LIKE $1`, [`${FARM_NAME}%`]);
  const ids = junk.rows.map((r) => r.id);
  if (ids.length > 0) {
    await pool.query('DELETE FROM certifications WHERE farm_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM farm_regional_certifications WHERE farm_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM regional_certification_requests WHERE farm_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM farms WHERE id = ANY($1)', [ids]);
  }
  await pool.query('DELETE FROM farm_requests WHERE farm_name LIKE $1', [`${FARM_NAME}%`]);
  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [OWNER.toLowerCase(), OTHER.toLowerCase(), ADMIN.toLowerCase()],
  ]);
  await pool.end();
});

const url = () => `/api/regional-certifications/requests/by-farm/${farmId}`;

describe('การตรวจสิทธิ์', () => {
  test('ไม่ได้ล็อกอิน ดูไม่ได้', async () => {
    const res = await request(app).get(url());
    expect(res.status).toBe(401);
  });

  test('ผู้ใช้คนอื่นที่ไม่ใช่เจ้าของสวน ดูไม่ได้', async () => {
    // หน้าโปรไฟล์สวนใครเปิดดูก็ได้ ถ้าเส้นทางนี้เปิดตาม เหตุผลที่แอดมินปฏิเสธ
    // จะกลายเป็นข้อมูลสาธารณะไปด้วย
    const res = await request(app).get(url()).set('Cookie', otherCookie);
    expect(res.status).toBe(403);
  });

  test('เจ้าของสวนดูของตัวเองได้', async () => {
    const res = await request(app).get(url()).set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
  });

  test('แอดมินดูของสวนไหนก็ได้', async () => {
    const res = await request(app).get(url()).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
  });

  test('สวนที่ไม่มีอยู่จริง ได้ 404 ไม่ใช่ 403', async () => {
    // แยกให้ออกระหว่างไม่มีสวนนี้ กับมีแต่ไม่ใช่ของคุณ
    const res = await request(app)
      .get('/api/regional-certifications/requests/by-farm/farm-ไม่มีจริง')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(404);
  });
});

describe('ข้อมูลที่เจ้าของสวนได้เห็น', () => {
  test('คำขอที่ยังรอ ต้องบอกได้ว่ารออยู่', async () => {
    const res = await request(app).get(url()).set('Cookie', ownerCookie);

    expect(res.body.requests).toHaveLength(1);
    const r = res.body.requests[0];
    expect(r.status).toBe('pending');
    expect(r.typeCode).toBe('GI');
    expect(r.certNumber).toBe(`GI-OWN-${SUFFIX}`);
  });

  test('ไม่ส่งชื่อบัญชีแอดมินไปให้เจ้าของสวน', async () => {
    // เจ้าของสวนควรรู้ว่าใบถูกตัดสินแล้วและเพราะอะไร ไม่จำเป็นต้องรู้ว่า
    // พนักงานคนไหนเป็นคนกด
    await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/reject`)
      .set('Cookie', adminCookie)
      .send({ adminNotes: 'เลขที่ใบไม่ตรงกับทะเบียน' });

    const res = await request(app).get(url()).set('Cookie', ownerCookie);
    expect(res.body.requests[0].resolvedBy).toBe('');
    expect(JSON.stringify(res.body)).not.toContain(ADMIN);
  });

  test('แอดมินยังเห็นว่าใครเป็นคนตัดสิน', async () => {
    const res = await request(app).get(url()).set('Cookie', adminCookie);
    expect(res.body.requests[0].resolvedBy).toBe(ADMIN);
  });

  test('คำขอที่ถูกปฏิเสธ ต้องเห็นเหตุผลที่แอดมินบันทึกไว้', async () => {
    // นี่คือเหตุผลทั้งหมดของงานนี้ เหตุผลถูกบันทึกไว้ตั้งแต่ต้นแต่ไม่มีใครได้อ่าน
    const res = await request(app).get(url()).set('Cookie', ownerCookie);

    expect(res.body.requests[0].status).toBe('rejected');
    expect(res.body.requests[0].adminNotes).toBe('เลขที่ใบไม่ตรงกับทะเบียน');
  });

  test('คำขอที่จับคู่แล้ว ต้องบอกว่าอยู่โซนไหน', async () => {
    const typeId = await pool.query(`SELECT id FROM certification_types WHERE code = 'GI'`);
    const again = await pool.query(
      `INSERT INTO regional_certification_requests
         (farm_id, certification_type_id, cert_number, issuing_authority)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [farmId, typeId.rows[0].id, `GI-OWN2-${SUFFIX}`, 'กรมทรัพย์สินทางปัญญา']
    );

    await request(app)
      .post(`/api/regional-certifications/requests/${again.rows[0].id}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: giZoneId });

    const res = await request(app).get(url()).set('Cookie', ownerCookie);
    const linked = res.body.requests.find((r: { status: string }) => r.status === 'linked');

    expect(linked).toBeDefined();
    expect(linked.linkedRegionName).toBeTruthy();
  });

  test('คืนทุกสถานะ ไม่ใช่เฉพาะที่ยังค้าง', async () => {
    const res = await request(app).get(url()).set('Cookie', ownerCookie);
    const statuses = res.body.requests.map((r: { status: string }) => r.status).sort();

    expect(statuses).toEqual(['linked', 'rejected']);
  });

  test('สวนที่ไม่เคยยื่นใบระดับโซน ได้รายการว่าง ไม่ใช่ error', async () => {
    const other = await pool.query(`SELECT id FROM farms WHERE id <> $1 LIMIT 1`, [farmId]);

    const res = await request(app)
      .get(`/api/regional-certifications/requests/by-farm/${other.rows[0].id}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.requests)).toBe(true);
  });
});
