import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * แอดมินสร้างและแก้ไขโซนใบรับรองระดับภูมิภาคจากหน้าเว็บ
 *
 * หน้าจับคู่ที่ทำไว้ก่อนหน้านี้จับคู่ได้เฉพาะโซนที่มีอยู่แล้ว ถ้าใบที่สวนยื่นมา
 * ไม่ตรงโซนไหนเลย แอดมินทำได้แค่ปฏิเสธ ทั้งที่ใบนั้นอาจถูกต้องทุกอย่าง
 * แค่ระบบยังไม่เคยรู้จักโซนนั้น และชื่อโซนที่ 009 เติมให้เป็นชื่อจังหวัดล้วน
 * ซึ่งไม่ใช่ชื่อจริงของทะเบียน GI แก้ได้ทาง SQL ทางเดียว
 *
 * โซนซ้ำเป็นความเสี่ยงหลักของงานนี้ เพราะมันไม่พังแบบเห็นชัด แต่ทำให้สวน
 * ในพื้นที่เดียวกันกระจายไปคนละโซน พอใบต่ออายุ แอดมินแก้โซนหนึ่งแล้วอีกโซน
 * ค้างของเก่า สวนสองกลุ่มจะแสดงข้อมูลใบเดียวกันไม่ตรงกัน
 */

const SUFFIX = Date.now().toString(36);
const OTHER = `zoneadmin_other_${SUFFIX}`;
const ADMIN = `zoneadmin_admin_${SUFFIX}`;
const OWNER = `zoneadmin_owner_${SUFFIX}`;
const PASS = 'TestPassword12345';

/** จังหวัดที่ยังไม่มีโซนในฐาน ใช้สร้างโซนใหม่โดยไม่ชนของเดิม */
const FRESH_PROVINCE = 'ตราด';
const FARM_NAME = `สวนทดสอบจัดการโซน ${SUFFIX}`;

let adminCookie = '';
let otherCookie = '';
let ownerCookie = '';

/** โซนของจังหวัดศรีสะเกษที่ 009 สร้างไว้ ใช้เป็นคู่ชนของด่านกันซ้ำ */
let existingZoneId = 0;
let existingZoneName = '';
let existingCertNumber = '';

/**
 * ร่องรอยผู้ตรวจของโซนเดิมก่อนชุดนี้เริ่ม
 *
 * เทสต์เปลี่ยนชื่อจะเขียน reviewed_by ทับ ถ้าคืนแค่ชื่อ ฐาน dev จะเหลือชื่อ
 * บัญชีทดสอบค้างอยู่ในคอลัมน์ผู้ตรวจของโซนจริง
 */
let existingReviewedBy: string | null = null;
let existingReviewedAt: Date | null = null;

/** เก็บ id ทุกโซนที่ชุดนี้สร้าง เพื่อลบทิ้งให้หมดใน afterAll */
const createdZoneIds: number[] = [];

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/** สร้างโซนผ่าน API แล้วจำ id ไว้ให้ afterAll ลบ */
async function createZone(body: Record<string, unknown>) {
  const res = await request(app)
    .post('/api/regional-certifications')
    .set('Cookie', adminCookie)
    .send(body);
  if (res.status === 201) createdZoneIds.push(res.body.zone.id);
  return res;
}

/**
 * ข้อความที่ตอบผู้ใช้ต้องเป็นภาษาคน ไม่ใช่ข้อความดิบจากฐานข้อมูล
 *
 * ถ้าปล่อย error ของ Postgres ออกไปตรง ๆ แอดมินจะเห็นชื่อ constraint
 * กับคำว่า duplicate key ซึ่งไม่บอกเลยว่าต้องทำอะไรต่อ
 */
function expectHumanReadable(message: unknown) {
  expect(typeof message).toBe('string');
  const text = String(message);
  expect(text.length).toBeGreaterThan(0);
  for (const leak of ['duplicate key', 'constraint', 'violates', 'ERROR:', 'regexp_replace', 'pg_']) {
    expect(text).not.toContain(leak);
  }
}

beforeAll(async () => {
  for (const u of [OTHER, ADMIN, OWNER]) {
    await request(app).post('/api/auth/register').send({ username: u, password: PASS });
  }
  await pool.query("UPDATE users SET role='admin' WHERE username_lower=$1", [ADMIN.toLowerCase()]);

  adminCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: ADMIN, password: PASS })
  );
  otherCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: OTHER, password: PASS })
  );
  ownerCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: OWNER, password: PASS })
  );

  const { rows } = await pool.query(
    `SELECT rc.id, rc.region_name, rc.cert_number, rc.reviewed_by, rc.reviewed_at
       FROM regional_certifications rc
       JOIN certification_types ct ON ct.id = rc.certification_type_id
      WHERE ct.code = 'GI' ORDER BY rc.id LIMIT 1`
  );
  existingZoneId = Number(rows[0].id);
  existingZoneName = rows[0].region_name;
  existingCertNumber = rows[0].cert_number;
  existingReviewedBy = rows[0].reviewed_by;
  existingReviewedAt = rows[0].reviewed_at;
});

afterAll(async () => {
  const junk = await pool.query(`SELECT id FROM farms WHERE name LIKE $1`, [`${FARM_NAME}%`]);
  const farmIds = junk.rows.map((r) => r.id);
  if (farmIds.length > 0) {
    await pool.query('DELETE FROM certifications WHERE farm_id = ANY($1)', [farmIds]);
    await pool.query('DELETE FROM farm_regional_certifications WHERE farm_id = ANY($1)', [farmIds]);
    await pool.query('DELETE FROM regional_certification_requests WHERE farm_id = ANY($1)', [farmIds]);
    await pool.query('DELETE FROM farms WHERE id = ANY($1)', [farmIds]);
  }
  await pool.query('DELETE FROM farm_requests WHERE farm_name LIKE $1', [`${FARM_NAME}%`]);

  if (createdZoneIds.length > 0) {
    await pool.query('DELETE FROM farm_regional_certifications WHERE regional_certification_id = ANY($1)', [
      createdZoneIds,
    ]);
    await pool.query('DELETE FROM regional_certifications WHERE id = ANY($1)', [createdZoneIds]);
  }

  // คืนโซนเดิมกลับให้เหมือนก่อนเริ่ม ทั้งชื่อและร่องรอยผู้ตรวจ
  await pool.query(
    `UPDATE regional_certifications
        SET region_name = $2, reviewed_by = $3, reviewed_at = $4
      WHERE id = $1`,
    [existingZoneId, existingZoneName, existingReviewedBy, existingReviewedAt]
  );

  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [OTHER.toLowerCase(), ADMIN.toLowerCase(), OWNER.toLowerCase()],
  ]);
  await pool.end();
});

describe('การตรวจสิทธิ์', () => {
  test('ไม่ได้ล็อกอิน สร้างโซนไม่ได้', async () => {
    const res = await request(app)
      .post('/api/regional-certifications')
      .send({ certificationTypeCode: 'GI', regionName: `แอบสร้าง ${SUFFIX}`, province: FRESH_PROVINCE });

    expect(res.status).toBe(401);
  });

  test('ผู้ใช้ทั่วไปสร้างโซนไม่ได้', async () => {
    // การสร้างโซนคือการสร้างตราที่ผู้บริโภคใช้ตัดสินใจซื้อ ไม่ใช่สิ่งที่
    // เจ้าของสวนสร้างให้ตัวเองได้
    const res = await request(app)
      .post('/api/regional-certifications')
      .set('Cookie', otherCookie)
      .send({ certificationTypeCode: 'GI', regionName: `แอบสร้าง ${SUFFIX}`, province: FRESH_PROVINCE });

    expect(res.status).toBe(403);

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM regional_certifications WHERE region_name LIKE $1',
      [`แอบสร้าง%`]
    );
    expect(rows[0].n).toBe(0);
  });

  test('ไม่ได้ล็อกอิน แก้ไขโซนไม่ได้', async () => {
    const res = await request(app)
      .patch(`/api/regional-certifications/${existingZoneId}`)
      .send({ regionName: 'ชื่อที่ไม่ควรถูกเขียน' });

    expect(res.status).toBe(401);
  });

  test('ผู้ใช้ทั่วไปแก้ไขโซนไม่ได้ และชื่อเดิมต้องไม่ถูกแตะ', async () => {
    const res = await request(app)
      .patch(`/api/regional-certifications/${existingZoneId}`)
      .set('Cookie', otherCookie)
      .send({ regionName: 'ชื่อที่ไม่ควรถูกเขียน' });

    expect(res.status).toBe(403);

    const { rows } = await pool.query(
      'SELECT region_name FROM regional_certifications WHERE id = $1',
      [existingZoneId]
    );
    expect(rows[0].region_name).toBe(existingZoneName);
  });
});

describe('สร้างโซนใหม่', () => {
  test('สร้างสำเร็จ คืนโซนพร้อมข้อมูลครบ', async () => {
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: `ทุเรียนทดสอบตราด ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-NEW-${SUFFIX}`,
      issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
      validUntil: '2573',
    });

    expect(res.status).toBe(201);
    expect(res.body.zone.regionName).toBe(`ทุเรียนทดสอบตราด ${SUFFIX}`);
    expect(res.body.zone.province).toBe(FRESH_PROVINCE);
    expect(res.body.zone.typeCode).toBe('GI');
    expect(res.body.zone.certNumber).toBe(`GI-NEW-${SUFFIX}`);
    expect(res.body.zone.linkedFarmCount).toBe(0);
  });

  test('โซนที่แอดมินสร้างต้องพร้อมใช้ทันที ไม่ค้างรออนุมัติ', async () => {
    // ขาอ่านหน้ารายชื่อฟาร์มกรองเฉพาะใบที่ approved ถ้าโซนใหม่เป็น pending
    // แอดมินจะสร้างโซน จับคู่สวน แล้วตราไม่ขึ้นโดยไม่มีอะไรบอกเลย
    // ในระบบนี้แอดมินคือผู้ตรวจ ไม่มีชั้นอนุมัติซ้อน
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนพร้อมใช้ ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-READY-${SUFFIX}`,
      confirmDuplicate: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.zone.approvalStatus).toBe('approved');

    const { rows } = await pool.query(
      'SELECT reviewed_by, reviewed_at FROM regional_certifications WHERE id = $1',
      [res.body.zone.id]
    );
    expect(rows[0].reviewed_by).toBe(ADMIN);
    expect(rows[0].reviewed_at).not.toBeNull();
  });

  test('ปีเปล่าเก็บเป็นความละเอียดระดับปี ไม่เติมวันที่ที่ไม่เคยมีจริง', async () => {
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนปีเปล่า ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-YEAR-${SUFFIX}`,
      validUntil: '2573',
      confirmDuplicate: true,
    });

    expect(res.status).toBe(201);
    const { rows } = await pool.query(
      'SELECT expiry_precision, to_char(expiry_date, $2) AS d FROM regional_certifications WHERE id = $1',
      [res.body.zone.id, 'YYYY-MM-DD']
    );
    expect(rows[0].expiry_precision).toBe('year');
    expect(rows[0].d).toBe('2573-12-31');
    // และตอนอ่านกลับต้องคืนเป็นปีเปล่าเหมือนที่กรอกมา
    expect(res.body.zone.validUntil).toBe('2573');
  });

  test('ตัดช่องว่างหัวท้ายก่อนเก็บ', async () => {
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: `   โซนมีช่องว่าง ${SUFFIX}   `,
      province: `  ${FRESH_PROVINCE}  `,
      certNumber: `  GI-TRIM-${SUFFIX}  `,
      confirmDuplicate: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.zone.regionName).toBe(`โซนมีช่องว่าง ${SUFFIX}`);
    expect(res.body.zone.province).toBe(FRESH_PROVINCE);
    expect(res.body.zone.certNumber).toBe(`GI-TRIM-${SUFFIX}`);
  });

  test('ชื่อว่างเปล่า สร้างไม่ได้', async () => {
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: '    ',
      province: FRESH_PROVINCE,
    });

    expect(res.status).toBe(400);
    expectHumanReadable(res.body.error);
  });

  test('ไม่ระบุจังหวัด สร้างไม่ได้', async () => {
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนไม่มีจังหวัด ${SUFFIX}`,
    });

    expect(res.status).toBe(400);
    expectHumanReadable(res.body.error);
  });

  test('ประเภทที่ไม่ใช่ระดับโซน สร้างไม่ได้', async () => {
    // GAP เป็นใบของสวนรายแปลง ถ้าหลุดเข้ามาได้ trigger ที่ฐานจะโยน exception
    // ซึ่งกลายเป็น 500 แทนที่จะเป็นข้อความบอกเหตุผล
    const res = await createZone({
      certificationTypeCode: 'GAP',
      regionName: `โซนของ GAP ${SUFFIX}`,
      province: FRESH_PROVINCE,
    });

    expect(res.status).toBe(400);
    expectHumanReadable(res.body.error);
  });

  test('ประเภทที่ไม่มีในฐาน สร้างไม่ได้', async () => {
    const res = await createZone({
      certificationTypeCode: 'MADE_UP_CODE',
      regionName: `โซนประเภทมั่ว ${SUFFIX}`,
      province: FRESH_PROVINCE,
    });

    expect(res.status).toBe(400);
    expectHumanReadable(res.body.error);
  });
});

describe('กันชื่อโซนซ้ำ', () => {
  test('ชื่อซ้ำเป๊ะ ถูกปฏิเสธพร้อมข้อความที่อ่านรู้เรื่อง', async () => {
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: existingZoneName,
      province: FRESH_PROVINCE,
      confirmDuplicate: true,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
    expectHumanReadable(res.body.error);
    expect(res.body.error).toContain(existingZoneName);
  });

  test('ชื่อที่ต่างกันแค่ช่องว่าง ถูกปฏิเสธที่ชั้นเซิร์ฟเวอร์', async () => {
    // ต้องถูกจับก่อนถึงฐาน ไม่งั้นผู้ใช้จะเจอ error ดิบของ Postgres
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: `  ${existingZoneName} `,
      province: FRESH_PROVINCE,
      confirmDuplicate: true,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
    expectHumanReadable(res.body.error);
  });

  test('ชื่อที่มีอักขระล่องหนคั่น ถูกปฏิเสธ', async () => {
    // NBSP กับ ZWSP มองไม่เห็นบนหน้าจอ ถ้าปล่อยผ่านจะได้โซนซ้ำที่ดูเหมือนกันเป๊ะ
    for (const invisible of ['\u00A0', '\u200B']) {
      const res = await createZone({
        certificationTypeCode: 'GI',
        regionName: `${existingZoneName}${invisible}`,
        province: FRESH_PROVINCE,
        confirmDuplicate: true,
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_NAME');
    }
  });

  test('เลขทะเบียนใบซ้ำ ถูกปฏิเสธพร้อมข้อความที่อ่านรู้เรื่อง', async () => {
    // ใบ GI หนึ่งใบมีเลขทะเบียนเดียว ถ้าสองโซนถือเลขเดียวกันแปลว่าซ้ำแน่นอน
    // ไม่ว่าจะตั้งชื่อต่างกันแค่ไหน
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: `ชื่อไม่ซ้ำแต่เลขซ้ำ ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: existingCertNumber,
      confirmDuplicate: true,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_CERT_NUMBER');
    expectHumanReadable(res.body.error);
    expect(res.body.error).toContain(existingCertNumber);
  });

  test('หลายโซนที่ยังไม่กรอกเลขที่ใบ ต้องสร้างได้ทั้งหมด', async () => {
    // ถ้าด่านเลขที่ใบคลุมค่าว่างด้วย โซนที่สองที่ยังไม่รู้เลขจะสร้างไม่ได้เลย
    const a = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนยังไม่มีเลข ก ${SUFFIX}`,
      province: FRESH_PROVINCE,
      confirmDuplicate: true,
    });
    const b = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนยังไม่มีเลข ข ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: '',
      confirmDuplicate: true,
    });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });
});

describe('เตือนโซนใกล้เคียงในจังหวัดเดียวกัน', () => {
  test('จังหวัดที่มีโซนอยู่แล้ว ต้องเตือนก่อน พร้อมบอกว่ามีโซนอะไรอยู่', async () => {
    // ห้ามบล็อกตาย เพราะจังหวัดหนึ่งขึ้นทะเบียน GI ได้มากกว่าหนึ่งใบจริง ๆ
    // แต่ต้องให้คนเห็นก่อนว่ามีอะไรอยู่แล้ว ไม่ใช่สร้างซ้ำโดยไม่รู้ตัว
    const { rows } = await pool.query(
      `SELECT rc.province FROM regional_certifications rc
         JOIN certification_types ct ON ct.id = rc.certification_type_id
        WHERE ct.code = 'GI' AND rc.id = $1`,
      [existingZoneId]
    );
    const busyProvince = rows[0].province;

    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: `ทุเรียนสายพันธุ์ที่สอง ${SUFFIX}`,
      province: busyProvince,
      certNumber: `GI-SECOND-${SUFFIX}`,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SIMILAR_ZONE_EXISTS');
    expectHumanReadable(res.body.error);

    // ต้องส่งโซนที่มีอยู่กลับไปให้หน้าจอแสดงได้ ไม่ใช่บอกลอย ๆ ว่ามีอยู่แล้ว
    const names = res.body.zones.map((z: { regionName: string }) => z.regionName);
    expect(names).toContain(existingZoneName);
  });

  test('ยืนยันว่าเป็นคนละโซนแล้ว สร้างได้', async () => {
    const { rows } = await pool.query(
      'SELECT province FROM regional_certifications WHERE id = $1',
      [existingZoneId]
    );

    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: `ทุเรียนสายพันธุ์ที่สาม ${SUFFIX}`,
      province: rows[0].province,
      certNumber: `GI-THIRD-${SUFFIX}`,
      confirmDuplicate: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.zone.province).toBe(rows[0].province);
  });

  test('การยืนยันไม่ทำให้ชื่อที่ซ้ำจริงผ่านไปได้', async () => {
    // คำเตือนเรื่องจังหวัดเป็นด่านอ่อนที่คนข้ามได้ ส่วนชื่อซ้ำเป็นด่านแข็ง
    // ที่ข้ามไม่ได้ไม่ว่าจะยืนยันมาแค่ไหน
    const res = await createZone({
      certificationTypeCode: 'GI',
      regionName: existingZoneName,
      province: FRESH_PROVINCE,
      confirmDuplicate: true,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
  });
});

describe('แก้ไขโซน', () => {
  test('เปลี่ยนชื่อโซนแล้วสวนที่ผูกไว้ต้องไม่หลุด', async () => {
    // เหตุผลทั้งหมดที่แก้ชื่อได้อย่างปลอดภัยคือ join ใช้ id ไม่ใช่ชื่อ
    // ถ้าวันหนึ่งมีคนเปลี่ยนไปผูกด้วยชื่อ เทสต์นี้จะจับได้ทันที
    const before = await pool.query(
      'SELECT farm_id FROM farm_regional_certifications WHERE regional_certification_id = $1 ORDER BY farm_id',
      [existingZoneId]
    );
    expect(before.rowCount).toBeGreaterThan(0);

    const newName = `ทุเรียนภูเขาไฟทดสอบ ${SUFFIX}`;
    const res = await request(app)
      .patch(`/api/regional-certifications/${existingZoneId}`)
      .set('Cookie', adminCookie)
      .send({ regionName: newName });

    expect(res.status).toBe(200);
    expect(res.body.zone.regionName).toBe(newName);

    const after = await pool.query(
      'SELECT farm_id FROM farm_regional_certifications WHERE regional_certification_id = $1 ORDER BY farm_id',
      [existingZoneId]
    );
    expect(after.rows).toEqual(before.rows);

    // และตราบนหน้าฟาร์มต้องยังขึ้นเหมือนเดิม
    const farms = await request(app).get('/api/farms');
    const farm = farms.body.farms.find((f: { id: string }) => f.id === before.rows[0].farm_id);
    const codes = farm.certificationDetails.map((c: { shortCode: string }) => c.shortCode);
    expect(codes).toContain('GI');

    // คืนชื่อเดิมกลับ ไม่ให้เทสต์ตัวถัดไปเจอชื่อที่เปลี่ยนไปแล้ว
    await request(app)
      .patch(`/api/regional-certifications/${existingZoneId}`)
      .set('Cookie', adminCookie)
      .send({ regionName: existingZoneName });
  });

  test('แก้ข้อมูลใบตัวแทนของโซนได้', async () => {
    const created = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนรอแก้ ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-EDIT-${SUFFIX}`,
      confirmDuplicate: true,
    });

    const res = await request(app)
      .patch(`/api/regional-certifications/${created.body.zone.id}`)
      .set('Cookie', adminCookie)
      .send({ issuingAuthority: 'กรมทรัพย์สินทางปัญญา', validUntil: '2575' });

    expect(res.status).toBe(200);
    expect(res.body.zone.issuingAuthority).toBe('กรมทรัพย์สินทางปัญญา');
    expect(res.body.zone.validUntil).toBe('2575');
  });

  test('เปลี่ยนชื่อไปชนโซนอื่น ถูกปฏิเสธ', async () => {
    const created = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนจะไปชนคนอื่น ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-CLASH-${SUFFIX}`,
      confirmDuplicate: true,
    });

    const res = await request(app)
      .patch(`/api/regional-certifications/${created.body.zone.id}`)
      .set('Cookie', adminCookie)
      .send({ regionName: existingZoneName });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_NAME');
    expectHumanReadable(res.body.error);
  });

  test('เปลี่ยนเลขที่ใบไปชนโซนอื่น ถูกปฏิเสธ', async () => {
    const created = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนจะไปชนเลขคนอื่น ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-CLASH2-${SUFFIX}`,
      confirmDuplicate: true,
    });

    const res = await request(app)
      .patch(`/api/regional-certifications/${created.body.zone.id}`)
      .set('Cookie', adminCookie)
      .send({ certNumber: existingCertNumber });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_CERT_NUMBER');
    expectHumanReadable(res.body.error);
  });

  test('ตั้งชื่อเดิมของตัวเองซ้ำ ต้องไม่ถูกมองว่าชนตัวเอง', async () => {
    const created = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนแก้ชื่อตัวเอง ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-SELF-${SUFFIX}`,
      confirmDuplicate: true,
    });

    const res = await request(app)
      .patch(`/api/regional-certifications/${created.body.zone.id}`)
      .set('Cookie', adminCookie)
      .send({
        regionName: `โซนแก้ชื่อตัวเอง ${SUFFIX}`,
        certNumber: `GI-SELF-${SUFFIX}`,
        issuingAuthority: 'หน่วยงานใหม่',
      });

    expect(res.status).toBe(200);
    expect(res.body.zone.issuingAuthority).toBe('หน่วยงานใหม่');
  });

  test('เปลี่ยนประเภทใบของโซนไม่ได้', async () => {
    // ประเภทเปลี่ยนแล้วสวนทุกแห่งที่ผูกอยู่จะเปลี่ยนชนิดตราไปพร้อมกันเงียบ ๆ
    const created = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนห้ามเปลี่ยนประเภท ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-TYPE-${SUFFIX}`,
      confirmDuplicate: true,
    });

    await request(app)
      .patch(`/api/regional-certifications/${created.body.zone.id}`)
      .set('Cookie', adminCookie)
      .send({ certificationTypeCode: 'GAP', regionName: `โซนห้ามเปลี่ยนประเภท ${SUFFIX}` });

    const { rows } = await pool.query(
      `SELECT ct.code FROM regional_certifications rc
         JOIN certification_types ct ON ct.id = rc.certification_type_id
        WHERE rc.id = $1`,
      [created.body.zone.id]
    );
    expect(rows[0].code).toBe('GI');
  });

  test('แก้โซนที่ไม่มีอยู่จริง ได้ 404', async () => {
    const res = await request(app)
      .patch('/api/regional-certifications/99999999')
      .set('Cookie', adminCookie)
      .send({ regionName: 'ชื่ออะไรก็ได้' });

    expect(res.status).toBe(404);
    expectHumanReadable(res.body.error);
    // ต้องเป็น 404 ที่มาจากการหาโซนไม่เจอ ไม่ใช่ 404 เพราะเรียก endpoint ผิดเส้น
    expect(res.body.error).toMatch(/โซน/);
  });

  test('บันทึกว่าใครแก้และเมื่อไร', async () => {
    const created = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนดูร่องรอย ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-TRAIL-${SUFFIX}`,
      confirmDuplicate: true,
    });

    await request(app)
      .patch(`/api/regional-certifications/${created.body.zone.id}`)
      .set('Cookie', adminCookie)
      .send({ regionName: `โซนดูร่องรอยแก้แล้ว ${SUFFIX}` });

    const { rows } = await pool.query(
      'SELECT reviewed_by, reviewed_at FROM regional_certifications WHERE id = $1',
      [created.body.zone.id]
    );
    expect(rows[0].reviewed_by).toBe(ADMIN);
    expect(rows[0].reviewed_at).not.toBeNull();
  });
});

describe('โซนที่เพิ่งสร้างต้องใช้งานได้จริง', () => {
  test('เอาไปจับคู่คำขอได้ทันที และตราขึ้นบนหน้าฟาร์ม', async () => {
    // ถ้าสร้างโซนได้แต่จับคู่ไม่ได้ หรือจับคู่ได้แต่ตราไม่ขึ้น
    // งานทั้งหมดนี้ก็ไม่ได้แก้ปัญหาอะไรเลย
    const zone = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนใช้งานจริง ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-USE-${SUFFIX}`,
      confirmDuplicate: true,
    });
    expect(zone.status).toBe(201);

    const created = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        farmName: FARM_NAME,
        province: FRESH_PROVINCE,
        farmerFullName: 'นายทดสอบ จัดการโซน',
        certificationList: [
          { shortCode: 'GI', certNumber: `GI-REQ-${SUFFIX}`, issuedBy: 'กรมทรัพย์สินทางปัญญา' },
        ],
      });

    const approved = await request(app)
      .post(`/api/farm-requests/${created.body.request.id}/approve`)
      .set('Cookie', adminCookie)
      .send({});
    const farmId = approved.body.farm.id;

    const pending = await pool.query(
      `SELECT id FROM regional_certification_requests WHERE farm_id = $1 AND status = 'pending'`,
      [farmId]
    );

    const linked = await request(app)
      .post(`/api/regional-certifications/requests/${pending.rows[0].id}/link`)
      .set('Cookie', adminCookie)
      .send({ regionalCertificationId: zone.body.zone.id });

    expect(linked.status).toBe(200);

    const farms = await request(app).get('/api/farms');
    const farm = farms.body.farms.find((f: { id: string }) => f.id === farmId);
    const codes = farm.certificationDetails.map((c: { shortCode: string }) => c.shortCode);
    expect(codes).toContain('GI');
  });

  test('โซนใหม่โผล่ในรายชื่อโซนที่หน้าจับคู่ใช้', async () => {
    const zone = await createZone({
      certificationTypeCode: 'GI',
      regionName: `โซนต้องโผล่ในรายการ ${SUFFIX}`,
      province: FRESH_PROVINCE,
      certNumber: `GI-LIST-${SUFFIX}`,
      confirmDuplicate: true,
    });

    const res = await request(app).get('/api/regional-certifications').set('Cookie', adminCookie);
    const ids = res.body.zones.map((z: { id: number }) => z.id);

    expect(ids).toContain(zone.body.zone.id);
  });
});
