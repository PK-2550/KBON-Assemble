import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * จับคู่คำขอใบรับรองระดับโซนเข้ากับโซนจริง
 *
 * ใบอย่าง GI เป็นของโซนภูมิศาสตร์ ไม่ใช่ของสวนรายตัว ตอนอนุมัติคำขอจึงเขียนลง
 * ตาราง certifications ไม่ได้ 014 เก็บไว้เป็นคำขอค้างแทน แต่คำขอที่ค้างอยู่นั้น
 * ยังไม่มีทางไหนในหน้าเว็บเข้าถึงได้เลย ต้องเปิด psql มาสั่ง SQL เอง
 *
 * ผลคือผู้ใช้กรอกใบ GI ครบ แอดมินกดอนุมัติ ระบบบันทึกคำขอไว้ แล้วก็ไม่มีใคร
 * เห็นมันอีกเลย ตราไม่เคยขึ้น ซึ่งจากมุมผู้ใช้ก็ไม่ต่างจากตอนที่ใบหายเงียบ ๆ
 *
 * ชุดนี้คุมประตูที่เพิ่มเข้ามา ทั้งสิทธิ์เข้าถึง การจับคู่ที่ถูกต้อง
 * และการกันไม่ให้จับคู่ผิดประเภทหรือจัดการคำขอเดิมซ้ำ
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `regcert_owner_${SUFFIX}`;
const OTHER = `regcert_other_${SUFFIX}`;
const ADMIN = `regcert_admin_${SUFFIX}`;
const PASS = 'TestPassword12345';
const FARM_NAME = `สวนทดสอบจับคู่โซน ${SUFFIX}`;

let ownerCookie = '';
let otherCookie = '';
let adminCookie = '';

/** โซน GI ที่มีอยู่จริงในฐาน ใช้เป็นปลายทางของการจับคู่ */
let giZoneId = 0;
let otherZoneId = 0;

/**
 * โซนของใบคนละประเภท ใช้ทดสอบว่าจับคู่ข้ามประเภทไม่ได้
 *
 * สร้างใน beforeAll และลบใน afterAll ไม่ใช่ในตัวเทสต์เอง เพราะถ้าเทสต์ล้ม
 * บรรทัดลบที่อยู่ท้าย test จะไม่ถูกรัน แล้วแถวทดสอบจะค้างอยู่ในฐาน dev
 */
let wrongTypeId = 0;
let wrongTypeZoneId = 0;

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/**
 * ยื่นคำขอที่มีใบ GI แล้วอนุมัติ คืน id ฟาร์มกับ id คำขอระดับโซนที่ค้างอยู่
 *
 * ตั้งใจเดินผ่านเส้นทางจริงทั้งเส้น ไม่ใช่ INSERT ลงตารางตรง ๆ เพราะสิ่งที่
 * ต้องพิสูจน์คือแอดมินจัดการคำขอที่เกิดจากการใช้งานจริงได้ ไม่ใช่แค่จัดการ
 * แถวที่ชุดทดสอบสร้างขึ้นเอง
 */
async function submitGiAndApprove(): Promise<{ farmId: string; requestId: number }> {
  const created = await request(app)
    .post('/api/farm-requests')
    .set('Cookie', ownerCookie)
    .send({
      farmName: FARM_NAME,
      province: 'จันทบุรี',
      farmerFullName: 'นายทดสอบ จับคู่โซน',
      certificationList: [
        { shortCode: 'GAP', certNumber: `GAP-${SUFFIX}`, issuedBy: 'กรมวิชาการเกษตร' },
        { shortCode: 'GI', certNumber: `GI-${SUFFIX}`, issuedBy: 'กรมทรัพย์สินทางปัญญา' },
      ],
    });

  const approved = await request(app)
    .post(`/api/farm-requests/${created.body.request.id}/approve`)
    .set('Cookie', adminCookie)
    .send({});

  const farmId: string = approved.body?.farm?.id;

  const { rows } = await pool.query(
    `SELECT id FROM regional_certification_requests WHERE farm_id = $1 AND status = 'pending'`,
    [farmId]
  );

  return { farmId, requestId: Number(rows[0]?.id) };
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

  const zones = await pool.query(
    `SELECT rc.id FROM regional_certifications rc
       JOIN certification_types ct ON ct.id = rc.certification_type_id
      WHERE ct.code = 'GI' ORDER BY rc.id LIMIT 2`
  );
  giZoneId = Number(zones.rows[0].id);
  otherZoneId = Number(zones.rows[1].id);

  const wrongType = await pool.query(
    `INSERT INTO certification_types (code, tier, name, name_th, sort_order)
     VALUES ($1, 'regional', 'ทดสอบโซน', 'ทดสอบโซน', 99)
     RETURNING id`,
    [`TEST_REGION_${SUFFIX}`]
  );
  wrongTypeId = Number(wrongType.rows[0].id);

  const wrongZone = await pool.query(
    `INSERT INTO regional_certifications (certification_type_id, region_name, province)
     VALUES ($1, $2, 'จันทบุรี') RETURNING id`,
    [wrongTypeId, `โซนทดสอบ ${SUFFIX}`]
  );
  wrongTypeZoneId = Number(wrongZone.rows[0].id);
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
  if (wrongTypeZoneId) {
    await pool.query('DELETE FROM regional_certifications WHERE id = $1', [wrongTypeZoneId]);
  }
  if (wrongTypeId) {
    await pool.query('DELETE FROM certification_types WHERE id = $1', [wrongTypeId]);
  }
  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [OWNER.toLowerCase(), OTHER.toLowerCase(), ADMIN.toLowerCase()],
  ]);
  await pool.end();
});

describe('การตรวจสิทธิ์', () => {
  test('ไม่ได้ล็อกอิน ดูรายการคำขอไม่ได้', async () => {
    const res = await request(app).get('/api/regional-certifications/requests');
    expect(res.status).toBe(401);
  });

  test('ผู้ใช้ทั่วไปดูรายการคำขอไม่ได้', async () => {
    const res = await request(app)
      .get('/api/regional-certifications/requests')
      .set('Cookie', otherCookie);
    expect(res.status).toBe(403);
  });

  test('ผู้ใช้ทั่วไปจับคู่โซนเองไม่ได้', async () => {
    const { requestId } = await submitGiAndApprove();

    const res = await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', otherCookie)
      .send({ regionalCertificationId: giZoneId });

    expect(res.status).toBe(403);

    const { rows } = await pool.query(
      `SELECT status FROM regional_certification_requests WHERE id = $1`,
      [requestId]
    );
    expect(rows[0].status).toBe('pending');
  });

  test('ผู้ใช้ทั่วไปดูรายชื่อโซนไม่ได้', async () => {
    const res = await request(app).get('/api/regional-certifications').set('Cookie', otherCookie);
    expect(res.status).toBe(403);
  });
});

describe('รายชื่อโซนที่จับคู่ได้', () => {
  test('คืนโซนพร้อมข้อมูลที่แอดมินใช้ตัดสินว่าคู่กับโซนไหน', async () => {
    const res = await request(app).get('/api/regional-certifications').set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const zone = res.body.zones.find((z: { id: number }) => z.id === giZoneId);

    expect(zone).toBeDefined();
    expect(zone.regionName).toBeTruthy();
    expect(zone.province).toBeTruthy();
    expect(zone.typeCode).toBe('GI');
    // จำนวนสวนที่ผูกอยู่แล้ว ช่วยให้แอดมินเห็นว่าโซนไหนใช้งานจริง
    expect(typeof zone.linkedFarmCount).toBe('number');
  });
});

describe('รายการคำขอที่รอจับคู่', () => {
  test('คำขอที่ค้างต้องโผล่ในรายการ พร้อมข้อมูลที่ใช้ตัดสินใจ', async () => {
    const { farmId, requestId } = await submitGiAndApprove();

    const res = await request(app)
      .get('/api/regional-certifications/requests')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const found = res.body.requests.find((r: { id: number }) => r.id === requestId);

    expect(found).toBeDefined();
    expect(found.farmId).toBe(farmId);
    expect(found.farmName).toBe(FARM_NAME);
    expect(found.province).toBe('จันทบุรี');
    expect(found.typeCode).toBe('GI');
    expect(found.certNumber).toBe(`GI-${SUFFIX}`);
    expect(found.issuingAuthority).toBe('กรมทรัพย์สินทางปัญญา');
    expect(found.status).toBe('pending');
  });

  test('ค่าตั้งต้นคืนเฉพาะคำขอที่ยังค้าง ไม่ปนคำขอที่จัดการไปแล้ว', async () => {
    const { requestId } = await submitGiAndApprove();
    await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: giZoneId });

    const res = await request(app)
      .get('/api/regional-certifications/requests')
      .set('Cookie', adminCookie);

    const ids = res.body.requests.map((r: { id: number }) => r.id);
    expect(ids).not.toContain(requestId);
  });

  test('ขอดูคำขอที่จัดการไปแล้วได้ ถ้าระบุสถานะมา', async () => {
    const { requestId } = await submitGiAndApprove();
    await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: giZoneId });

    const res = await request(app)
      .get('/api/regional-certifications/requests?status=linked')
      .set('Cookie', adminCookie);

    const ids = res.body.requests.map((r: { id: number }) => r.id);
    expect(ids).toContain(requestId);
  });
});

describe('จับคู่คำขอเข้ากับโซน', () => {
  test('จับคู่แล้วสวนต้องได้ใบของโซนนั้นจริง', async () => {
    const { farmId, requestId } = await submitGiAndApprove();

    const res = await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: giZoneId });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('linked');
    expect(res.body.request.regionalCertificationId).toBe(giZoneId);

    const link = await pool.query(
      `SELECT 1 FROM farm_regional_certifications
        WHERE farm_id = $1 AND regional_certification_id = $2`,
      [farmId, giZoneId]
    );
    expect(link.rowCount).toBe(1);
  });

  test('จับคู่แล้วตรา GI ต้องขึ้นบนหน้าฟาร์ม ไม่ใช่แค่มีแถวในตาราง', async () => {
    // เป้าหมายทั้งหมดของงานนี้คือให้ใบที่ผู้ใช้กรอกมาปรากฏจริง
    // ถ้าตราไม่ขึ้น การจับคู่ก็ไม่ได้แก้ปัญหาอะไรเลย
    const { farmId, requestId } = await submitGiAndApprove();
    await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: giZoneId });

    const farms = await request(app).get('/api/farms');
    const farm = farms.body.farms.find((f: { id: string }) => f.id === farmId);

    const codes = farm.certificationDetails.map((c: { shortCode: string }) => c.shortCode);
    expect(codes).toContain('GI');
  });

  test('บันทึกว่าใครจับคู่และเมื่อไร', async () => {
    const { requestId } = await submitGiAndApprove();
    await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: giZoneId });

    const { rows } = await pool.query(
      `SELECT resolved_by, resolved_at FROM regional_certification_requests WHERE id = $1`,
      [requestId]
    );
    expect(rows[0].resolved_by).toBe(ADMIN);
    expect(rows[0].resolved_at).not.toBeNull();
  });

  test('สวนที่ผูกโซนนั้นอยู่แล้ว จับคู่ซ้ำได้โดยไม่พังและไม่เกิดแถวซ้ำ', async () => {
    const { farmId, requestId } = await submitGiAndApprove();
    await pool.query(
      `INSERT INTO farm_regional_certifications (farm_id, regional_certification_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [farmId, giZoneId]
    );

    const res = await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: giZoneId });

    expect(res.status).toBe(200);

    const link = await pool.query(
      `SELECT count(*)::int AS n FROM farm_regional_certifications
        WHERE farm_id = $1 AND regional_certification_id = $2`,
      [farmId, giZoneId]
    );
    expect(link.rows[0].n).toBe(1);
  });

  test('คำขอที่จัดการไปแล้ว จับคู่ซ้ำไม่ได้', async () => {
    const { requestId } = await submitGiAndApprove();
    await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: giZoneId });

    const again = await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: otherZoneId });

    expect(again.status).toBe(409);

    // และต้องไม่ถูกย้ายไปโซนใหม่ด้วย
    const { rows } = await pool.query(
      `SELECT regional_certification_id FROM regional_certification_requests WHERE id = $1`,
      [requestId]
    );
    expect(Number(rows[0].regional_certification_id)).toBe(giZoneId);
  });

  test('โซนที่ไม่มีอยู่จริง จับคู่ไม่ได้', async () => {
    const { requestId } = await submitGiAndApprove();

    const res = await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: 99999999 });

    expect(res.status).toBe(404);
    // ต้องเป็น 404 ที่มาจากการหาโซนไม่เจอ ไม่ใช่ 404 เพราะเรียก endpoint ผิดเส้น
    expect(res.body.error).toMatch(/โซน/);
  });

  test('ไม่ระบุโซนมา จับคู่ไม่ได้', async () => {
    const { requestId } = await submitGiAndApprove();

    const res = await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({});

    expect(res.status).toBe(400);
  });

  test('โซนที่เป็นใบคนละประเภทกับคำขอ จับคู่ไม่ได้', async () => {
    // คำขอ GI ต้องคู่กับโซน GI เท่านั้น ถ้าปล่อยให้คู่ข้ามประเภทได้
    // สวนจะได้ตราของมาตรฐานที่ไม่เคยยื่นมา
    const { requestId } = await submitGiAndApprove();

    const res = await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: wrongTypeZoneId });

    expect(res.status).toBe(400);
  });
});

describe('ปฏิเสธคำขอ', () => {
  test('ปฏิเสธแล้วต้องไม่มีการผูกโซนใด ๆ และเก็บเหตุผลไว้', async () => {
    const { farmId, requestId } = await submitGiAndApprove();

    const res = await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/reject`)
      .set('Cookie', adminCookie)
      .send({ adminNotes: 'เลขที่ใบไม่ตรงกับทะเบียน GI' });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('rejected');

    const { rows } = await pool.query(
      `SELECT admin_notes, resolved_by, regional_certification_id
         FROM regional_certification_requests WHERE id = $1`,
      [requestId]
    );
    expect(rows[0].admin_notes).toBe('เลขที่ใบไม่ตรงกับทะเบียน GI');
    expect(rows[0].resolved_by).toBe(ADMIN);
    expect(rows[0].regional_certification_id).toBeNull();

    const link = await pool.query(
      `SELECT 1 FROM farm_regional_certifications WHERE farm_id = $1`,
      [farmId]
    );
    expect(link.rowCount).toBe(0);
  });

  test('ปฏิเสธไปแล้วจัดการซ้ำไม่ได้', async () => {
    const { requestId } = await submitGiAndApprove();
    await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/reject`)
      .set('Cookie', adminCookie)
      .send({ adminNotes: 'ไม่ผ่าน' });

    const again = await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: giZoneId });

    expect(again.status).toBe(409);
  });

  test('ปฏิเสธแล้วสวนเดิมยื่นใบเดิมมาใหม่ได้ ไม่ติดคำขอค้างเดิม', async () => {
    // ดัชนีเอกลักษณ์คุมเฉพาะคำขอที่ยังค้าง ถ้าคุมทุกสถานะ สวนที่ถูกปฏิเสธ
    // เพราะกรอกเลขผิดจะยื่นแก้ไม่ได้ตลอดไป
    const { farmId, requestId } = await submitGiAndApprove();
    await request(app)
      .post(`/api/regional-certifications/requests/${requestId}/reject`)
      .set('Cookie', adminCookie)
      .send({ adminNotes: 'เลขผิด' });

    const typeId = await pool.query(`SELECT id FROM certification_types WHERE code = 'GI'`);
    const retry = await pool.query(
      `INSERT INTO regional_certification_requests
         (farm_id, certification_type_id, cert_number, issuing_authority)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (farm_id, certification_type_id) WHERE status = 'pending' DO NOTHING
       RETURNING id`,
      [farmId, typeId.rows[0].id, `GI-RETRY-${SUFFIX}`, 'กรมทรัพย์สินทางปัญญา']
    );

    expect(retry.rowCount).toBe(1);
  });
});
