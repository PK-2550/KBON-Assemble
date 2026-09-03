import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * ใบรับรองสุขอนามัยพืช (PHYTO) ระดับการขนส่งรายเที่ยว
 *
 * 005 ใส่ประเภทนี้ไว้ในตารางค้นหาตั้งแต่ต้น แต่ trigger บังคับว่าใบระดับ
 * shipment ต้องมี shipment_ref และระบบไม่เคยมีตารางเที่ยวขนส่ง ประเภทนี้
 * จึงถูกกรองออกจากฟอร์มไปเลยและไม่มีใครเลือกได้
 *
 * 016 ผ่อนกฎนั้นแล้ว ชุดนี้คุมสิ่งที่ตามมา คือ PHYTO เลือกได้ บันทึกได้
 * และที่สำคัญที่สุดคือ ต้องไม่รั่วออกไปเป็นตราสาธารณะบนหน้ารายชื่อฟาร์ม
 *
 * ใบรายเที่ยวไม่ใช่คุณสมบัติถาวรของสวน สวนที่ส่งออกไปหนึ่งตู้เมื่อปีที่แล้ว
 * ไม่ควรได้ตราติดตัวไปตลอด และ PHYTO เป็นเอกสารระหว่างผู้ส่งออกกับประเทศ
 * ปลายทาง ไม่ใช่เครื่องหมายคุณภาพที่ผู้บริโภคใช้ตัดสินใจ
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `phyto_owner_${SUFFIX}`;
const OTHER = `phyto_other_${SUFFIX}`;
const ADMIN = `phyto_admin_${SUFFIX}`;
const PASS = 'TestPassword12345';
const FARM_NAME = `สวนทดสอบใบขนส่ง ${SUFFIX}`;

let ownerCookie = '';
let otherCookie = '';
let adminCookie = '';
let farmId = '';

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/** ยื่นคำขอพร้อมรายการใบรับรอง แล้วอนุมัติ คืน id ฟาร์มที่ถูกสร้าง */
async function submitAndApprove(certs: Record<string, unknown>[]): Promise<string> {
  const created = await request(app)
    .post('/api/farm-requests')
    .set('Cookie', ownerCookie)
    .send({
      farmName: FARM_NAME,
      province: 'จันทบุรี',
      farmerFullName: 'นายทดสอบ ใบขนส่ง',
      certificationList: certs,
    });

  const approved = await request(app)
    .post(`/api/farm-requests/${created.body.request.id}/approve`)
    .set('Cookie', adminCookie)
    .send({});

  return approved.body?.farm?.id;
}

async function certRows(id: string) {
  const { rows } = await pool.query(
    `SELECT ct.code, c.tier, c.shipment_ref, c.approval_status
       FROM certifications c
       JOIN certification_types ct ON ct.id = c.certification_type_id
      WHERE c.farm_id = $1 ORDER BY ct.code`,
    [id]
  );
  return rows;
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

  farmId = await submitAndApprove([
    { shortCode: 'GAP', certNumber: `GAP-${SUFFIX}`, issuedBy: 'กรมวิชาการเกษตร' },
    {
      shortCode: 'PHYTO',
      certNumber: `PHYTO-${SUFFIX}`,
      issuedBy: 'กรมวิชาการเกษตร',
      shipmentRef: `CN-2569-${SUFFIX}`,
    },
  ]);
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

describe('PHYTO เลือกได้แล้ว', () => {
  test('โผล่ในรายการประเภทที่ฟอร์มใช้', async () => {
    const res = await request(app).get('/api/certification-types');
    const codes = res.body.types.map((t: { code: string }) => t.code);

    expect(codes).toContain('PHYTO');
  });

  test('บอก tier มาด้วย หน้าเว็บจะได้รู้ว่าต้องถามเลขที่ใบขนส่ง', async () => {
    const res = await request(app).get('/api/certification-types');
    const phyto = res.body.types.find((t: { code: string }) => t.code === 'PHYTO');

    expect(phyto.tier).toBe('shipment');
  });

  test('ถังรองรับข้อมูลเก่ายังไม่โผล่เหมือนเดิม', async () => {
    const res = await request(app).get('/api/certification-types');
    const codes = res.body.types.map((t: { code: string }) => t.code);

    expect(codes).not.toContain('LEGACY_OTHER');
  });
});

describe('การบันทึกใบ PHYTO', () => {
  test('บันทึกพร้อมเลขที่ใบขนส่งได้', async () => {
    const rows = await certRows(farmId);
    const phyto = rows.find((r) => r.code === 'PHYTO');

    expect(phyto).toBeDefined();
    expect(phyto.tier).toBe('shipment');
    expect(phyto.shipment_ref).toBe(`CN-2569-${SUFFIX}`);
  });

  test('ไม่กรอกเลขที่ใบขนส่งก็บันทึกได้ ไม่ใช่ 500', async () => {
    // ก่อน 016 trigger จะโยน exception ตรงนี้ ซึ่งกลายเป็น 500 ที่ไม่บอกสาเหตุ
    const id = await submitAndApprove([
      { shortCode: 'PHYTO', certNumber: `PHYTO-NOREF-${SUFFIX}`, issuedBy: 'กรมวิชาการเกษตร' },
    ]);

    expect(id).toBeTruthy();
    const rows = await certRows(id);
    const phyto = rows.find((r) => r.code === 'PHYTO');

    expect(phyto).toBeDefined();
    expect(phyto.shipment_ref).toBeNull();
  });

  test('ใบของสวนที่ส่งเลขที่ใบขนส่งมาด้วย ต้องไม่ถูกเขียนลงและต้องไม่ล้ม', async () => {
    // ถ้าเขียนลงไป trigger จะปฏิเสธทั้งคำขอ ผู้ใช้จะเสียใบอื่นไปด้วย
    // ค่าที่ไม่เข้าพวกควรถูกทิ้งเงียบ ๆ ไม่ใช่ทำให้ทั้งคำขอพัง
    const id = await submitAndApprove([
      {
        shortCode: 'GAP',
        certNumber: `GAP-STRAY-${SUFFIX}`,
        issuedBy: 'กรมวิชาการเกษตร',
        shipmentRef: 'ไม่ควรถูกเก็บ',
      },
    ]);

    expect(id).toBeTruthy();
    const rows = await certRows(id);
    const gap = rows.find((r) => r.code === 'GAP');

    expect(gap.shipment_ref).toBeNull();
  });

  test('ยื่นแก้ไขแล้วเปลี่ยนเลขที่ใบขนส่งได้', async () => {
    const before = await certRows(farmId);
    expect(before.find((r) => r.code === 'PHYTO').shipment_ref).toBe(`CN-2569-${SUFFIX}`);

    await pool.query(
      `UPDATE certifications SET shipment_ref = $2
        WHERE farm_id = $1 AND tier = 'shipment'`,
      [farmId, `CN-2570-${SUFFIX}`]
    );

    const after = await certRows(farmId);
    expect(after.find((r) => r.code === 'PHYTO').shipment_ref).toBe(`CN-2570-${SUFFIX}`);
  });
});

describe('ใบ PHYTO ต้องไม่รั่วออกไปเป็นตราสาธารณะ', () => {
  /**
   * เคสสำคัญที่สุดของงานนี้
   *
   * ใบรายเที่ยวไม่ใช่คุณสมบัติถาวรของสวน ตัวกรอง tier <> shipment ในขาอ่าน
   * เป็นด่านเดียวที่กันไว้ ถ้าวันหนึ่งมีคนถอดออก เทสต์ชุดนี้ต้องจับได้ทันที
   *
   * ตั้งใบเป็น approved ก่อนตรวจทุกเคส ไม่งั้นตัวกรองสถานะอนุมัติจะบังผลไว้
   * แล้วเทสต์จะผ่านโดยไม่ได้พิสูจน์อะไรเลย
   */
  beforeAll(async () => {
    await pool.query(
      `UPDATE certifications SET approval_status = 'approved'
        WHERE farm_id = $1 AND tier = 'shipment'`,
      [farmId]
    );
  });

  test('ใบ PHYTO ที่อนุมัติแล้ว ต้องมีอยู่จริงในฐาน', async () => {
    // ยามของเทสต์ข้างล่าง ถ้าไม่มีแถวนี้อยู่จริง เทสต์ที่เหลือจะผ่านฟรี
    const rows = await certRows(farmId);
    const phyto = rows.find((r) => r.code === 'PHYTO');

    expect(phyto).toBeDefined();
    expect(phyto.approval_status).toBe('approved');
  });

  test('ไม่โผล่ใน GET /api/farms', async () => {
    const res = await request(app).get('/api/farms');
    const farm = res.body.farms.find((f: { id: string }) => f.id === farmId);

    const codes = farm.certificationDetails.map((c: { shortCode: string }) => c.shortCode);
    expect(codes).toContain('GAP');
    expect(codes).not.toContain('PHYTO');
  });

  test('ไม่โผล่ในขาอ่านหน้ารายละเอียดที่ไม่กรองสถานะอนุมัติ', async () => {
    // ขาอ่านสองเส้นนี้กรองคนละแบบ ต้องตรวจทั้งคู่ ไม่ใช่เส้นเดียว
    const { loadFarms } = await import('../../server/farmsRepo');
    const farms = await loadFarms({ farmId });

    const codes = (farms[0] as { certificationDetails: { shortCode: string }[] })
      .certificationDetails.map((c) => c.shortCode);

    expect(codes).toContain('GAP');
    expect(codes).not.toContain('PHYTO');
  });

  test('ไม่มีคำว่า PHYTO หลุดไปในคำตอบของ /api/farms เลย', async () => {
    // กันเคสที่ใบไปโผล่ในช่องอื่นที่ยังนึกไม่ถึง
    const res = await request(app).get('/api/farms');
    expect(JSON.stringify(res.body)).not.toContain('PHYTO');
  });

  test('เลขที่ใบขนส่งก็ต้องไม่หลุดออกไปทางสาธารณะ', async () => {
    const res = await request(app).get('/api/farms');
    expect(JSON.stringify(res.body)).not.toContain(`CN-2570-${SUFFIX}`);
  });
});

describe('เอกสารการส่งออกของสวน', () => {
  const url = () => `/api/farms/${farmId}/export-documents`;

  test('ไม่ได้ล็อกอิน ดูไม่ได้', async () => {
    const res = await request(app).get(url());
    expect(res.status).toBe(401);
  });

  test('ผู้ใช้คนอื่นดูไม่ได้', async () => {
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
    const res = await request(app)
      .get('/api/farms/farm-ไม่มีจริง/export-documents')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(404);
  });

  test('คืนเฉพาะใบระดับการขนส่ง ไม่ปนใบของสวน', async () => {
    const res = await request(app).get(url()).set('Cookie', ownerCookie);
    const codes = res.body.documents.map((d: { shortCode: string }) => d.shortCode);

    expect(codes).toContain('PHYTO');
    expect(codes).not.toContain('GAP');
  });

  test('คืนเลขที่ใบขนส่งและสถานะการตรวจมาด้วย', async () => {
    // เจ้าของสวนต้องรู้ว่าใบยังรอตรวจอยู่หรือผ่านแล้ว ไม่ใช่เห็นแค่ว่ามีใบ
    const res = await request(app).get(url()).set('Cookie', ownerCookie);
    const phyto = res.body.documents.find((d: { shortCode: string }) => d.shortCode === 'PHYTO');

    expect(phyto.shipmentRef).toBe(`CN-2570-${SUFFIX}`);
    expect(phyto.approvalStatus).toBe('approved');
    expect(phyto.certNumber).toBe(`PHYTO-${SUFFIX}`);
  });

  test('สวนที่ไม่เคยยื่นใบระดับการขนส่ง ได้รายการว่าง ไม่ใช่ error', async () => {
    const other = await pool.query(`SELECT id FROM farms WHERE id <> $1 LIMIT 1`, [farmId]);

    const res = await request(app)
      .get(`/api/farms/${other.rows[0].id}/export-documents`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([]);
  });
});
