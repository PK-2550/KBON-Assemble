import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * ประเภทใบรับรองที่ผู้ใช้เลือก ต้องถูกบันทึกเป็นประเภทนั้นจริง
 *
 * ตัวแปลงรหัสย่อเป็นประเภทเคยรู้จักแค่ห้ารหัส ที่เหลือตกไปเป็น LEGACY_OTHER
 * ซึ่งแปลว่า อื่น ๆ ย้ายมาจากระบบเดิม ผู้ใช้ที่เลือก Q-Mark หรือ ISO
 * จึงได้ตราที่บอกว่าเป็นข้อมูลเก่าที่ไม่รู้ประเภท ทั้งที่ระบุมาชัดเจน
 *
 * ส่วน GI ถูกข้ามทิ้งเงียบ ๆ เพราะปลายทางเป็นตารางระดับโซน ผู้ใช้กรอกครบ
 * แอดมินกดอนุมัติ แต่ใบไม่ถูกบันทึกที่ไหนเลยและไม่มีใครรู้
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `certtype_owner_${SUFFIX}`;
const ADMIN = `certtype_admin_${SUFFIX}`;
const PASS = 'TestPassword12345';

let ownerCookie = '';
let adminCookie = '';

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/** ยื่นคำขอพร้อมรายการใบรับรอง แล้วอนุมัติ คืน id ของฟาร์มที่ถูกสร้าง */
async function submitAndApprove(certs: Record<string, unknown>[]): Promise<string> {
  const created = await request(app)
    .post('/api/farm-requests')
    .set('Cookie', ownerCookie)
    .send({
      farmName: `สวนทดสอบประเภทใบ ${SUFFIX}`,
      province: 'จันทบุรี',
      farmerFullName: 'นายทดสอบ ประเภทใบ',
      certificationList: certs,
    });

  const approved = await request(app)
    .post(`/api/farm-requests/${created.body.request.id}/approve`)
    .set('Cookie', adminCookie)
    .send({});

  return approved.body?.farm?.id;
}

async function typeCodesOf(farmId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT ct.code FROM certifications c
       JOIN certification_types ct ON ct.id = c.certification_type_id
      WHERE c.farm_id = $1 ORDER BY ct.code`,
    [farmId]
  );
  return rows.map((r) => r.code);
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
});

afterAll(async () => {
  const junk = await pool.query(`SELECT id FROM farms WHERE name LIKE $1`, [
    `สวนทดสอบประเภทใบ ${SUFFIX}%`,
  ]);
  const ids = junk.rows.map((r) => r.id);
  if (ids.length > 0) {
    await pool.query('DELETE FROM certifications WHERE farm_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM farm_regional_certifications WHERE farm_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM farms WHERE id = ANY($1)', [ids]);
  }
  await pool.query('DELETE FROM farm_requests WHERE farm_name LIKE $1', [
    `สวนทดสอบประเภทใบ ${SUFFIX}%`,
  ]);
  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [OWNER.toLowerCase(), ADMIN.toLowerCase()],
  ]);
  await pool.end();
});

describe('ประเภทใบรับรองที่เลือกต้องถูกบันทึกตรงตามที่เลือก', () => {
  test('GMP กับ GACC บันทึกเป็นประเภทของตัวเอง', async () => {
    const farmId = await submitAndApprove([
      { shortCode: 'GMP', certNumber: `GMP-${SUFFIX}`, issuedBy: 'กรมวิชาการเกษตร' },
      { shortCode: 'GACC', certNumber: `GACC-${SUFFIX}`, issuedBy: 'GACC' },
    ]);

    expect(await typeCodesOf(farmId)).toEqual(['GACC', 'GMP']);
  });

  test('Q-Mark กับ ISO ไม่ตกไปเป็น LEGACY_OTHER อีกแล้ว', async () => {
    const farmId = await submitAndApprove([
      { shortCode: 'Q_MARK', certNumber: `Q-${SUFFIX}`, issuedBy: 'มกอช.' },
      { shortCode: 'ISO22000', certNumber: `ISO-${SUFFIX}`, issuedBy: 'สรอ.' },
    ]);

    const codes = await typeCodesOf(farmId);
    expect(codes).toEqual(['ISO22000', 'Q_MARK']);
    expect(codes).not.toContain('LEGACY_OTHER');
  });

  test('รหัสที่ระบบไม่รู้จักจริง ๆ ยังตกไปเป็น LEGACY_OTHER ไม่ใช่หายไป', async () => {
    // ใบที่หายไปเงียบ ๆ แปลว่าฟาร์มเสียใบรับรองโดยไม่มีใครรู้
    const farmId = await submitAndApprove([
      { shortCode: 'มาตรฐานที่ยังไม่มีในระบบ', certNumber: `X-${SUFFIX}`, issuedBy: 'หน่วยงานหนึ่ง' },
    ]);

    expect(await typeCodesOf(farmId)).toEqual(['LEGACY_OTHER']);
  });

  test('เลือก GI แล้วต้องมีร่องรอย ไม่ใช่หายเงียบ ๆ', async () => {
    // GI ไปตารางระดับโซนซึ่งแอดมินต้องจับคู่เอง แต่ต้องรู้ได้ว่ามีคำขอค้างอยู่
    const farmId = await submitAndApprove([
      { shortCode: 'GAP', certNumber: `GAP-GI-${SUFFIX}`, issuedBy: 'กรมวิชาการเกษตร' },
      { shortCode: 'GI', certNumber: `GI-${SUFFIX}`, issuedBy: 'กรมทรัพย์สินทางปัญญา' },
    ]);

    // ใบของสวนยังบันทึกตามปกติ
    expect(await typeCodesOf(farmId)).toEqual(['GAP']);

    // และมีบันทึกไว้ว่ามีคำขอ GI ที่รอแอดมินจับคู่โซน
    const { rows } = await pool.query(
      `SELECT status FROM regional_certification_requests WHERE farm_id = $1`,
      [farmId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
  });
});
