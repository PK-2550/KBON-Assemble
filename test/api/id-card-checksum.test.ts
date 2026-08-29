import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * เลขบัตรที่หลักตรวจสอบไม่ผ่าน ต้องถูกปฏิเสธตั้งแต่ที่เซิร์ฟเวอร์
 *
 * ตัวตรวจ isValidThaiNationalId มีมาตั้งแต่ก้อนแรกของงานนี้ พร้อมชุดทดสอบ 20 ข้อ
 * แต่ไม่เคยถูกเรียกใช้ที่ไหนเลย ข้อมูลที่หลักตรวจสอบผิดจึงเข้าฐานได้ตามปกติ
 *
 * ตรวจที่เซิร์ฟเวอร์ ไม่ใช่แค่ที่ฟอร์ม เพราะการตรวจฝั่งหน้าจอเป็นเรื่องความสะดวก
 * ของผู้ใช้ ไม่ใช่การบังคับ ใครยิง API ตรงก็ข้ามไปได้
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `checksum_owner_${SUFFIX}`;
const PASS = 'TestPassword12345';

const VALID_ID = '1229900341828';
/** หลักสุดท้ายผิดไปหนึ่ง ที่เหลือเหมือนเลขที่ถูกต้องทุกประการ */
const INVALID_ID = '1229900341829';

let ownerCookie = '';
const createdIds: string[] = [];

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

beforeAll(async () => {
  await request(app).post('/api/auth/register').send({ username: OWNER, password: PASS });
  ownerCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: OWNER, password: PASS })
  );
});

afterAll(async () => {
  if (createdIds.length) {
    await pool.query('DELETE FROM farm_requests WHERE id = ANY($1)', [createdIds]);
  }
  await pool.query('DELETE FROM users WHERE username_lower = $1', [OWNER.toLowerCase()]);
  await pool.end();
});

const submit = (body: Record<string, unknown>) =>
  request(app).post('/api/farm-requests').set('Cookie', ownerCookie).send({
    farmName: `สวนทดสอบ checksum ${SUFFIX}`,
    province: 'จันทบุรี',
    ...body,
  });

describe('เซิร์ฟเวอร์ปฏิเสธเลขบัตรที่หลักตรวจสอบไม่ผ่าน', () => {
  test('เลขที่หลักตรวจสอบผิด ตอบ 400 พร้อมบอกสาเหตุ', async () => {
    const res = await submit({ farmerIdCardNumber: INVALID_ID });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/เลขประจำตัวประชาชน/);
    // ต้องบอกว่าเลขไม่ถูกต้อง ไม่ใช่ข้อความกลาง ๆ ที่ผู้ใช้เดาไม่ถูกว่าผิดตรงไหน
    expect(res.body.error).toMatch(/ไม่ถูกต้อง|ตรวจสอบ/);
  });

  test('ถูกปฏิเสธแล้วต้องไม่มีแถวไหนถูกสร้างขึ้น', async () => {
    const before = await pool.query(
      `SELECT count(*)::int AS n FROM farm_requests WHERE farm_name = $1`,
      [`สวนทดสอบ checksum ${SUFFIX} ไม่ควรถูกสร้าง`]
    );

    await submit({
      farmName: `สวนทดสอบ checksum ${SUFFIX} ไม่ควรถูกสร้าง`,
      farmerIdCardNumber: INVALID_ID,
    });

    const after = await pool.query(
      `SELECT count(*)::int AS n FROM farm_requests WHERE farm_name = $1`,
      [`สวนทดสอบ checksum ${SUFFIX} ไม่ควรถูกสร้าง`]
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  test('เลขที่ยาวไม่ครบ 13 หลัก ก็ถูกปฏิเสธเหมือนกัน', async () => {
    const res = await submit({ farmerIdCardNumber: '12299003418' });
    expect(res.status).toBe(400);
  });

  test('เลขที่ขึ้นต้นด้วยศูนย์ถูกปฏิเสธ เพราะไม่มีอยู่จริงในระบบทะเบียนราษฎร', async () => {
    const res = await submit({ farmerIdCardNumber: '0123456789012' });
    expect(res.status).toBe(400);
  });

  test('เลขที่ถูกต้องยังยื่นได้ตามปกติ', async () => {
    const res = await submit({ farmerIdCardNumber: VALID_ID });

    expect(res.status).toBe(201);
    createdIds.push(res.body.request.id);
    expect(res.body.request.farmerIdCardMasked).toBe('X-XXXX-XXXXX-XX-8');
  });

  test('คำขอที่ไม่ได้ส่งเลขบัตรมาเลย ยังยื่นได้ เพราะเป็นช่องไม่บังคับ', async () => {
    const res = await submit({ farmName: `สวนไม่มีเลขบัตร ${SUFFIX}` });

    expect(res.status).toBe(201);
    createdIds.push(res.body.request.id);
  });

  test('ผู้ใช้พิมพ์ขีดคั่นมาด้วย ก็ยังผ่านถ้าเลขถูกต้อง', async () => {
    const res = await submit({
      farmName: `สวนมีขีดคั่น ${SUFFIX}`,
      farmerIdCardNumber: '1-2299-00341-82-8',
    });

    expect(res.status).toBe(201);
    createdIds.push(res.body.request.id);
  });
});
