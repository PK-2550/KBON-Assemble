import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * ปิด SmartFarm ผ่านคำขอแก้ไข ต้องล้างอุปกรณ์เดิมออกจริง
 *
 * ก่อนแก้ การอนุมัติคำขอที่ผู้ใช้ปิด SmartFarm (hasSmartFarm=false, ส่ง [] มา)
 * ไม่ได้ลบแถวใน farm_smart_technologies เลย เพราะสองจุดพลาดพร้อมกัน
 *
 *   1. ตอนสร้าง payload ใช้เกณฑ์ smartTechnologies.length > 0 ทำให้ [] ถูกมองว่า
 *      "ไม่ได้ส่งมา" แล้ว payload || EXCLUDED.payload ฝั่ง SQL คงชุดเก่าไว้
 *   2. ตอนอนุมัติ เมื่อ hasSmartFarm=false โค้ด fallback ไปใช้ของเดิมของฟาร์ม
 *      (existing.smartTechnologies) แทนที่จะล้าง
 *
 * อาการคือ has_smart_farm=false แต่การ์ด SmartFarm กับแถวอุปกรณ์ยังอยู่ครบ
 * เป็นบั๊กข้อมูลจริง ไม่ใช่แค่การแสดงผล
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `smartf_owner_${SUFFIX}`;
const ADMIN = `smartf_admin_${SUFFIX}`;
const PASS = 'TestPassword12345';
const FARM_NAME = `สวนทดสอบสมาร์ทฟาร์ม ${SUFFIX}`;

let ownerCookie = '';
let adminCookie = '';
let farmId = '';

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

async function smartTechOf(id: string) {
  const { rows } = await pool.query(
    `SELECT name, active FROM farm_smart_technologies WHERE farm_id = $1 ORDER BY sort_order`,
    [id]
  );
  return rows as { name: string; active: boolean }[];
}

async function hasSmartFarmFlag(id: string): Promise<boolean | null> {
  const { rows } = await pool.query(
    `SELECT has_smart_farm FROM farm_requests
      WHERE farm_name = $1 ORDER BY updated_at DESC LIMIT 1`,
    [FARM_NAME]
  );
  void id;
  return rows[0]?.has_smart_farm ?? null;
}

const TECHS = [
  { id: 'st-d1', name: 'ระบบให้น้ำอัตโนมัติ', subtext: 'ตั้งเวลารดน้ำ', iconEmoji: '💧', active: true },
  { id: 'st-d3', name: 'โดรนพ่นยา', subtext: 'พ่นสารชีวภัณฑ์', iconEmoji: '🚁', active: true },
];

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
      farmName: FARM_NAME,
      province: 'จันทบุรี',
      farmerFullName: 'นายทดสอบ สมาร์ทฟาร์ม',
      gapCertNumber: `GAP-${SUFFIX}`,
      certIssuedBy: 'กรมวิชาการเกษตร',
      certValidUntil: '2029',
      hasSmartFarm: true,
      smartTechnologies: TECHS,
    });

  const approved = await request(app)
    .post(`/api/farm-requests/${created.body.request.id}/approve`)
    .set('Cookie', adminCookie)
    .send({ adminNotes: 'อนุมัติในเทสต์' });

  farmId = approved.body?.farm?.id;
});

afterAll(async () => {
  const junk = await pool.query(`SELECT id FROM farms WHERE name LIKE $1`, [`${FARM_NAME}%`]);
  const junkIds = junk.rows.map((r) => r.id);
  if (junkIds.length > 0) {
    await pool.query('DELETE FROM farm_smart_technologies WHERE farm_id = ANY($1)', [junkIds]);
    await pool.query('DELETE FROM certifications WHERE farm_id = ANY($1)', [junkIds]);
    await pool.query('DELETE FROM farms WHERE id = ANY($1)', [junkIds]);
  }
  await pool.query('DELETE FROM farm_requests WHERE farm_name LIKE $1', [`${FARM_NAME}%`]);
  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [OWNER.toLowerCase(), ADMIN.toLowerCase()],
  ]);
  await pool.end();
});

describe('อนุมัติคำขอที่เปิด SmartFarm', () => {
  test('อุปกรณ์ที่ยื่นมาต้องถูกเขียนลง farm_smart_technologies', async () => {
    expect(farmId).toBeTruthy();

    const techs = await smartTechOf(farmId);
    expect(techs).toHaveLength(2);
    expect(techs.map((t) => t.name)).toEqual(['ระบบให้น้ำอัตโนมัติ', 'โดรนพ่นยา']);
  });
});

describe('ปิด SmartFarm ผ่านคำขอแก้ไข', () => {
  test('อนุมัติแล้วต้องไม่เหลือแถวอุปกรณ์เดิมค้างอยู่', async () => {
    const disable = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        requestType: 'update_farm',
        targetFarmId: farmId,
        farmName: FARM_NAME,
        province: 'จันทบุรี',
        farmerFullName: 'นายทดสอบ สมาร์ทฟาร์ม',
        hasSmartFarm: false,
        smartTechnologies: [],
      });

    // payload ต้องบันทึกการปิดตามจริง ไม่คงชุดเก่าไว้เพราะเห็นว่าเป็น []
    expect(await hasSmartFarmFlag(farmId)).toBe(false);

    const res = await request(app)
      .post(`/api/farm-requests/${disable.body.request.id}/approve`)
      .set('Cookie', adminCookie)
      .send({});

    expect(res.status).toBe(200);

    const techs = await smartTechOf(farmId);
    expect(techs).toHaveLength(0);
  });
});

describe('คำขอแก้ไขที่ไม่แตะ SmartFarm', () => {
  test('เปิดใหม่พร้อมอุปกรณ์ แล้วแก้เรื่องอื่นโดยส่งอุปกรณ์เดิมมา ต้องไม่หาย', async () => {
    // เปิด SmartFarm กลับมาก่อน
    const reenable = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        requestType: 'update_farm',
        targetFarmId: farmId,
        farmName: FARM_NAME,
        province: 'จันทบุรี',
        farmerFullName: 'นายทดสอบ สมาร์ทฟาร์ม',
        hasSmartFarm: true,
        smartTechnologies: [TECHS[0]],
      });
    await request(app)
      .post(`/api/farm-requests/${reenable.body.request.id}/approve`)
      .set('Cookie', adminCookie)
      .send({});

    expect(await smartTechOf(farmId)).toHaveLength(1);

    // แก้เรื่องอื่น (ผู้ใช้ยัง SmartFarm อยู่ ไคลเอนต์จึงส่งอุปกรณ์ชุดเดิมมาด้วย)
    const other = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        requestType: 'update_farm',
        targetFarmId: farmId,
        farmName: FARM_NAME,
        province: 'ระยอง',
        farmerFullName: 'นายทดสอบ สมาร์ทฟาร์ม',
        hasSmartFarm: true,
        smartTechnologies: [TECHS[0]],
      });
    await request(app)
      .post(`/api/farm-requests/${other.body.request.id}/approve`)
      .set('Cookie', adminCookie)
      .send({});

    const techs = await smartTechOf(farmId);
    expect(techs).toHaveLength(1);
    expect(techs[0].name).toBe('ระบบให้น้ำอัตโนมัติ');
  });
});
