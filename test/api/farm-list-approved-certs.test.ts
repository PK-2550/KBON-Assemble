import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { loadFarms } from '../../server/farmsRepo';
import { pool } from '../../server/db';

/**
 * หน้ารายชื่อฟาร์มต้องได้เฉพาะใบรับรองที่ผ่านการตรวจแล้ว
 *
 * ตราบนหน้ารายชื่อคือสิ่งที่ผู้ซื้อเห็นก่อนตัดสินใจกดเข้าไปดูสวน ถ้าใบที่ยัง
 * รอตรวจติดมาด้วย สวนที่ยังไม่ผ่านการตรวจจะดูเหมือนผ่านแล้วตั้งแต่หน้าแรก
 *
 * ส่วนหน้ารายละเอียดยังต้องได้ใบครบทุกสถานะ เพราะแท็บใบรับรองแสดงสถานะจริง
 * ของแต่ละใบให้เจ้าของสวนเห็นว่าใบไหนติดอยู่ขั้นไหน
 *
 * 005 สร้าง certifications_farm_approved_idx ไว้รองรับการอ่านแบบนี้โดยเฉพาะ
 * เป็น covering index ที่ตอบได้โดยไม่ต้องเปิดแถวจริง ชุดนี้จึงตรวจด้วยว่า
 * query ที่ใช้จริงเข้า index ตัวนั้น ไม่ใช่ไล่สแกนทั้งตาราง
 */

const SUFFIX = Date.now().toString(36);
const FARM_ID = `certbadge_farm_${SUFFIX}`;

async function addCert(code: string, status: string) {
  await pool.query(
    `INSERT INTO certifications
       (certification_type_id, tier, farm_id, cert_number, approval_status)
     SELECT ct.id, ct.tier, $1, $2, $3 FROM certification_types ct WHERE ct.code = $4`,
    [FARM_ID, `${code}-${SUFFIX}`, status, code]
  );
}

beforeAll(async () => {
  await pool.query(
    `INSERT INTO farms (id, rank, name, province, top_varieties, total_trees,
                        harvested_fruits, rating, review_count, varieties_count)
     VALUES ($1, 99, $2, 'จันทบุรี', ARRAY['หมอนทอง'], 10, 20, 9, 1, 1)`,
    [FARM_ID, `สวนทดสอบตรา ${SUFFIX}`]
  );

  await addCert('GAP', 'approved');
  await addCert('GMP', 'pending');
  await addCert('GACC', 'rejected');
});

afterAll(async () => {
  await pool.query('DELETE FROM certifications WHERE farm_id = $1', [FARM_ID]);
  await pool.query('DELETE FROM farms WHERE id = $1', [FARM_ID]);
  await pool.end();
});

const codesOf = (farm: Record<string, unknown> | undefined) =>
  ((farm?.certificationDetails ?? []) as { shortCode: string }[]).map((c) => c.shortCode).sort();

describe('ใบรับรองที่ส่งไปหน้ารายชื่อฟาร์ม', () => {
  test('หน้ารายชื่อได้เฉพาะใบที่อนุมัติแล้ว', async () => {
    const farms = await loadFarms({ approvedCertsOnly: true });
    const farm = farms.find((f) => f.id === FARM_ID);

    expect(codesOf(farm)).toEqual(['GAP']);
  });

  test('หน้ารายละเอียดยังได้ใบครบทุกสถานะ', async () => {
    const farms = await loadFarms({ farmId: FARM_ID, includeCertificatePhotos: true });

    expect(codesOf(farms[0])).toEqual(['GACC', 'GAP', 'GMP']);
  });

  test('ค่าตั้งต้นคือได้ครบทุกสถานะ ไม่ใช่กรองทิ้งเงียบ ๆ', async () => {
    const farms = await loadFarms({});
    const farm = farms.find((f) => f.id === FARM_ID);

    expect(codesOf(farm)).toEqual(['GACC', 'GAP', 'GMP']);
  });

  test('covering index ที่ 005 สร้างไว้ ตอบ query ของหน้ารายชื่อได้โดยไม่ต้องเปิดแถวจริง', async () => {
    // ปิด seq scan ชั่วคราวก่อนดูแผน
    //
    // ฐาน dev มีใบรับรองแค่หลักสิบแถว Postgres จึงเลือกไล่สแกนทั้งตารางซึ่งถูกแล้ว
    // ถ้าไปยืนยันว่า planner ต้องเลือก index เท่ากับทดสอบปริมาณข้อมูล ไม่ใช่ทดสอบโค้ด
    //
    // สิ่งที่ต้องพิสูจน์คือ index ครอบ query นี้ได้จริง คือได้ Index Only Scan
    // ไม่ใช่ Index Scan ที่ยังต้องวิ่งไปเปิดแถว ซึ่งเป็นคุณสมบัติของ index เอง
    // ไม่ขึ้นกับว่ามีข้อมูลกี่แถว พอข้อมูลโตขึ้น planner จะเลือกเองโดยไม่ต้องแก้อะไร
    const client = await pool.connect();
    try {
      // SET LOCAL มีผลเฉพาะใน transaction ถ้าเรียกลอย ๆ จะไม่ทำอะไรเลย
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query(
        `EXPLAIN (COSTS OFF)
         SELECT c.farm_id, c.certification_type_id
           FROM certifications c
          WHERE c.approval_status = 'approved'
            AND c.tier IN ('farm', 'packing_house')`
      );
      const plan = rows.map((r) => r['QUERY PLAN']).join('\n');

      expect(plan).toContain('certifications_farm_approved_idx');
      expect(plan).toContain('Index Only Scan');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });
});
