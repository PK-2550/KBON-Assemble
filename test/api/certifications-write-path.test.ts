import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * ใบรับรองต้องถูกเขียนลงตาราง certifications ใหม่ และแก้ได้ผ่านการอนุมัติเท่านั้น
 *
 * 005 สร้างตารางใหม่ไว้แล้วแต่ไม่มีใครเขียนลงไปเลย โค้ดยังเขียน
 * farm_certifications เดิมอย่างเดียว ใบที่อนุมัติหลัง 005 จึงไม่มีคู่ในตารางใหม่
 * ซึ่งทำให้ 007 รันไม่ได้ และแถบตราใบรับรองดึงข้อมูลจริงมาแสดงไม่ได้
 *
 * อีกเรื่องคือ upsertFarm ลบใบรับรองของฟาร์มทิ้งทั้งหมดแล้วเขียนใหม่ทุกครั้ง
 * ถ้าย้ายมาทำแบบนี้กับตารางใหม่ สถานะการตรวจ ผู้ตรวจ และหมายเหตุของแอดมิน
 * จะถูกล้างทุกครั้งที่ผู้จัดการสวนกดบันทึกอะไรก็ตามในหน้าฟาร์ม
 * ตราจึงจะไม่มีความหมายว่าผ่านการตรวจแล้ว
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `certw_owner_${SUFFIX}`;
const ADMIN = `certw_admin_${SUFFIX}`;
const PASS = 'TestPassword12345';

let ownerCookie = '';
let adminCookie = '';
let farmId = '';

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/** ใบรับรองของฟาร์มในตารางใหม่ พร้อมรหัสประเภทที่อ่านออก */
async function newCertsOf(id: string) {
  const { rows } = await pool.query(
    `SELECT ct.code, c.cert_number, c.approval_status, c.admin_notes, c.issuing_authority
       FROM certifications c
       JOIN certification_types ct ON ct.id = c.certification_type_id
      WHERE c.farm_id = $1
      ORDER BY ct.code`,
    [id]
  );
  return rows;
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
      farmName: `สวนทดสอบใบรับรอง ${SUFFIX}`,
      province: 'จันทบุรี',
      farmerFullName: 'นายทดสอบ ใบรับรอง',
      gapCertNumber: `GAP-${SUFFIX}`,
      certIssuedBy: 'กรมวิชาการเกษตร',
      certValidUntil: '2029',
    });

  const approved = await request(app)
    .post(`/api/farm-requests/${created.body.request.id}/approve`)
    .set('Cookie', adminCookie)
    .send({ adminNotes: 'อนุมัติในเทสต์' });

  farmId = approved.body?.farm?.id;
});

afterAll(async () => {
  // ลบตามชื่อ ไม่ใช่ตาม farmId ตัวเดียว
  //
  // คำขอชนิดสร้างฟาร์มใหม่จะสร้างฟาร์มใหม่ทุกครั้ง ถ้าเทสต์ล้มกลางทาง
  // หรือมีการเพิ่มเคสที่ยื่นคำขอใหม่ ฟาร์มส่วนเกินจะค้างอยู่ในฐาน dev
  // แล้วไปโผล่เป็นข้อมูลที่ยังไม่ถูกย้ายในชุดทดสอบเรื่องการย้ายตาราง
  const junk = await pool.query(`SELECT id FROM farms WHERE name LIKE $1`, [
    `สวนทดสอบใบรับรอง ${SUFFIX}%`,
  ]);
  const junkIds = junk.rows.map((r) => r.id);
  if (junkIds.length > 0) {
    await pool.query('DELETE FROM certifications WHERE farm_id = ANY($1)', [junkIds]);
    await pool.query('DELETE FROM farms WHERE id = ANY($1)', [junkIds]);
  }
  await pool.query('DELETE FROM farm_requests WHERE farm_name LIKE $1', [`สวนทดสอบใบรับรอง ${SUFFIX}%`]);
  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [OWNER.toLowerCase(), ADMIN.toLowerCase()],
  ]);
  await pool.end();
});

describe('การอนุมัติคำขอเขียนใบรับรองลงตารางใหม่', () => {
  test('อนุมัติแล้วต้องมีแถวในตาราง certifications', async () => {
    expect(farmId).toBeTruthy();

    const certs = await newCertsOf(farmId);
    expect(certs).toHaveLength(1);
    expect(certs[0].code).toBe('GAP');
    expect(certs[0].cert_number).toBe(`GAP-${SUFFIX}`);
    expect(certs[0].approval_status).toBe('approved');
  });
});

describe('ผู้จัดการสวนแก้ใบรับรองตรง ๆ ไม่ได้', () => {
  test('ส่ง certificationDetails มากับการบันทึกฟาร์ม ต้องไม่เปลี่ยนใบรับรอง', async () => {
    const before = await newCertsOf(farmId);

    const res = await request(app)
      .put(`/api/farms/${farmId}`)
      .set('Cookie', ownerCookie)
      .send({
        name: `สวนทดสอบใบรับรอง ${SUFFIX}`,
        province: 'จันทบุรี',
        certificationDetails: [
          {
            name: 'GAP (Good Agricultural Practice)',
            shortCode: 'GAP',
            certNumber: 'ปลอม-999',
            issuedBy: 'หน่วยงานปลอม',
            validUntil: '2099',
            verified: true,
          },
        ],
      });

    expect(res.status).toBe(200);

    const after = await newCertsOf(farmId);
    expect(after).toEqual(before);
  });

  test('เพิ่มใบรับรองใบใหม่ผ่านการบันทึกฟาร์มก็ไม่ได้', async () => {
    const before = await newCertsOf(farmId);

    await request(app)
      .put(`/api/farms/${farmId}`)
      .set('Cookie', ownerCookie)
      .send({
        name: `สวนทดสอบใบรับรอง ${SUFFIX}`,
        province: 'จันทบุรี',
        certificationDetails: [
          ...before.map((c) => ({ shortCode: c.code, certNumber: c.cert_number })),
          { name: 'GMP', shortCode: 'GMP', certNumber: 'แอบเพิ่ม-1', verified: true },
        ],
      });

    const after = await newCertsOf(farmId);
    expect(after).toEqual(before);
    expect(after.some((c) => c.code === 'GMP')).toBe(false);
  });

  test('แอดมินบันทึกฟาร์มก็เปลี่ยนใบรับรองไม่ได้เหมือนกัน', async () => {
    // ตราต้องแปลว่าผ่านการตรวจแล้วจริง ไม่ใช่ว่าใครก็ตั้งค่าให้ตัวเองได้
    // ทางเดียวที่แก้ได้คือผ่านการอนุมัติคำขอ
    const before = await newCertsOf(farmId);

    await request(app)
      .put(`/api/farms/${farmId}`)
      .set('Cookie', adminCookie)
      .send({
        name: `สวนทดสอบใบรับรอง ${SUFFIX}`,
        province: 'จันทบุรี',
        certificationDetails: [],
      });

    const after = await newCertsOf(farmId);
    expect(after).toEqual(before);
    expect(after.length).toBeGreaterThan(0);
  });
});

describe('ร่องรอยการตรวจของแอดมินต้องไม่ถูกล้าง', () => {
  test('บันทึกฟาร์มซ้ำแล้ว approval_status กับ admin_notes ยังอยู่ครบ', async () => {
    await pool.query(
      `UPDATE certifications SET admin_notes = 'ตรวจเอกสารครบแล้ว', reviewed_by = 'ผู้ตรวจทดสอบ'
        WHERE farm_id = $1`,
      [farmId]
    );

    await request(app)
      .put(`/api/farms/${farmId}`)
      .set('Cookie', ownerCookie)
      .send({ name: `สวนทดสอบใบรับรอง ${SUFFIX}`, province: 'จันทบุรี', highlight: 'แก้ข้อความ' });

    const after = await newCertsOf(farmId);
    expect(after[0].approval_status).toBe('approved');
    expect(after[0].admin_notes).toBe('ตรวจเอกสารครบแล้ว');
  });

  test('อนุมัติคำขอแก้ไขรอบสองต้องทับใบเดิม ไม่ใช่เพิ่มใบซ้ำ', async () => {
    const second = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        requestType: 'update_farm',
        targetFarmId: farmId,
        farmName: `สวนทดสอบใบรับรอง ${SUFFIX}`,
        province: 'จันทบุรี',
        farmerFullName: 'นายทดสอบ ใบรับรอง',
        gapCertNumber: `GAP-${SUFFIX}-B`,
        certIssuedBy: 'กรมวิชาการเกษตร',
        certValidUntil: '2031',
      });

    await request(app)
      .post(`/api/farm-requests/${second.body.request.id}/approve`)
      .set('Cookie', adminCookie)
      .send({});

    const certs = await newCertsOf(farmId);
    const gap = certs.filter((c) => c.code === 'GAP');
    expect(gap).toHaveLength(1);
    expect(gap[0].cert_number).toBe(`GAP-${SUFFIX}-B`);
  });
});

describe('GI ต้องไม่ถูกเขียนลงตาราง certifications', () => {
  test('ใบ GI ที่ติดมากับคำขอ ต้องถูกข้าม ไม่ทำให้การอนุมัติล้ม', async () => {
    // certifications มี trigger ที่โยน exception ถ้าประเภทเป็น tier regional
    // ใบระดับภูมิภาคต้องอยู่ใน regional_certifications และผูกผ่าน join table
    // ซึ่งแอดมินเป็นคนจับคู่ ไม่ใช่เกิดขึ้นเองตอนอนุมัติ
    const third = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        requestType: 'update_farm',
        targetFarmId: farmId,
        farmName: `สวนทดสอบใบรับรอง ${SUFFIX}`,
        province: 'จันทบุรี',
        farmerFullName: 'นายทดสอบ ใบรับรอง',
        gapCertNumber: `GAP-${SUFFIX}-C`,
        certIssuedBy: 'กรมวิชาการเกษตร',
        certValidUntil: '2032',
        certificationList: [
          { name: 'GAP', shortCode: 'GAP', certNumber: `GAP-${SUFFIX}-C` },
          { name: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์', shortCode: 'GI', certNumber: `GI-${SUFFIX}` },
        ],
      });

    const res = await request(app)
      .post(`/api/farm-requests/${third.body.request.id}/approve`)
      .set('Cookie', adminCookie)
      .send({});

    expect(res.status).toBe(200);

    const certs = await newCertsOf(farmId);
    expect(certs.some((c) => c.code === 'GI')).toBe(false);
    expect(certs.some((c) => c.code === 'GAP')).toBe(true);
  });
});
