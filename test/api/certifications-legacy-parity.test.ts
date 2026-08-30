import 'dotenv/config';
import { describe, test, expect, afterAll } from 'vitest';
import { pool } from '../../server/db';
import { loadFarms } from '../../server/farmsRepo';

/**
 * ใบรับรองทุกใบในตารางเดิมต้องมีคู่ในตารางใหม่
 *
 * 005 สร้างตารางใหม่และย้ายข้อมูลให้ครั้งเดียวตอนรัน แต่โค้ดยังเขียนตารางเก่าอยู่
 * ใบที่อนุมัติหลังจากนั้นจึงไปกองอยู่ตารางเก่าอย่างเดียว และ GI ถูกข้ามไว้
 * โดยตั้งใจตั้งแต่แรก เพราะแถวเดิมไม่มีข้อมูลพอจะรู้ว่าเป็นของโซนไหน
 *
 * ตราบใดที่ยังมีใบที่ไม่มีคู่ 007 จะรันไม่ได้ และแถบตราใบรับรองที่กันที่ไว้
 * ในหน้าฟาร์มก็ดึงข้อมูลจริงมาแสดงไม่ได้ ชุดนี้จึงเป็นด่านกันไม่ให้เกิดใหม่
 *
 * ตรวจที่ฐานข้อมูลตรง ๆ เพราะสิ่งที่ต้องพิสูจน์คือ "เก็บอะไรไว้จริง"
 * ไม่ใช่ "ตอบอะไรกลับไป"
 */

afterAll(async () => {
  await pool.end();
});

describe('ใบรับรองเดิมต้องถูกย้ายไปตารางใหม่ครบ', () => {
  test('ใบที่ไม่ใช่ GI ต้องมีคู่ในตาราง certifications ครบทุกใบ', async () => {
    // เทียบถึงระดับประเภทและเลขที่ใบ ไม่ใช่แค่ว่าฟาร์มนี้มีใบอะไรสักใบในตารางใหม่
    // ฟาร์มที่มีสามใบแล้วย้ายสำเร็จใบเดียว ต้องถูกจับได้
    const { rows } = await pool.query(
      `SELECT fc.farm_id, fc.short_code, fc.cert_number
         FROM farm_certifications fc
        WHERE fc.short_code IS DISTINCT FROM 'GI'
          AND EXISTS (SELECT 1 FROM farms f WHERE f.id = fc.farm_id)
          AND NOT EXISTS (
                SELECT 1
                  FROM certifications c
                  JOIN certification_types ct ON ct.id = c.certification_type_id
                 WHERE c.farm_id = fc.farm_id
                   AND c.cert_number IS NOT DISTINCT FROM fc.cert_number
                   AND ct.code = CASE
                         WHEN fc.short_code ILIKE 'GAP'      THEN 'GAP'
                         WHEN fc.short_code ILIKE 'Organic%' THEN 'ORGANIC_TH'
                         WHEN fc.short_code ILIKE 'GMP'      THEN 'GMP'
                         WHEN fc.short_code ILIKE 'GACC'     THEN 'GACC'
                         ELSE 'LEGACY_OTHER'
                       END
              )`
    );

    expect(rows).toEqual([]);
  });

  test('GI ทุกใบต้องมีโซนในตาราง regional_certifications และผูกกับสวนแล้ว', async () => {
    const { rows } = await pool.query(
      `SELECT fc.farm_id, fc.cert_number
         FROM farm_certifications fc
        WHERE fc.short_code = 'GI'
          AND EXISTS (SELECT 1 FROM farms f WHERE f.id = fc.farm_id)
          AND NOT EXISTS (
                SELECT 1
                  FROM farm_regional_certifications frc
                  JOIN regional_certifications rc ON rc.id = frc.regional_certification_id
                 WHERE frc.farm_id = fc.farm_id
              )`
    );

    expect(rows).toEqual([]);
  });

  test('โซนที่สร้างขึ้นต้องเป็นประเภท GI เท่านั้น', async () => {
    const { rows } = await pool.query(
      `SELECT rc.id, rc.region_name, ct.code
         FROM regional_certifications rc
         JOIN certification_types ct ON ct.id = rc.certification_type_id
        WHERE ct.tier <> 'regional'`
    );

    expect(rows).toEqual([]);
  });

  test('ชื่อโซนต้องแก้ไขได้ ไม่ใช่ค่าที่คำนวณสดทุกครั้ง', async () => {
    // เก็บเป็นคอลัมน์จริงที่ UPDATE ได้ แอดมินจึงเปลี่ยนชื่อโซนทีหลังได้
    // โดยไม่ต้องแก้โค้ด และการเปลี่ยนชื่อต้องไม่ทำให้สวนที่ผูกไว้หลุด
    const { rows } = await pool.query(
      `SELECT column_name, is_updatable
         FROM information_schema.columns
        WHERE table_name = 'regional_certifications'
          AND column_name IN ('region_name', 'issuing_authority', 'cert_number', 'expiry_date')
        ORDER BY column_name`
    );

    expect(rows.map((r) => r.column_name)).toEqual([
      'cert_number',
      'expiry_date',
      'issuing_authority',
      'region_name',
    ]);
    expect(rows.every((r) => r.is_updatable === 'YES')).toBe(true);
  });
});

describe('ขาอ่านต้องให้ผลเท่าเดิมไม่ว่าจะอ่านจากตารางไหน', () => {
  /**
   * ชุดนี้ต้องผ่านทั้งก่อนและหลังสลับขาอ่าน
   *
   * เทียบกับตารางเก่าซึ่งเป็นแหล่งอ้างอิงที่ผู้ใช้เห็นอยู่จริงก่อนสลับ
   * ถ้าสลับขาอ่านแล้วมีใบไหนหาย เลขที่ใบเพี้ยน หรือวันหมดอายุเปลี่ยนรูป
   * ชุดนี้จะจับได้ทันที
   *
   * ตรวจแบบครอบคลุม ไม่ใช่เท่ากันเป๊ะ คือทุกใบที่เคยมีในตารางเก่าต้องยังอยู่
   * แต่มีใบเกินมาได้ เพราะหลังตัดการเขียนตารางเก่าแล้ว ใบที่อนุมัติใหม่
   * จะอยู่ในตารางใหม่ที่เดียว ตารางเก่ากลายเป็นข้อมูลแช่แข็งจนกว่า 007 จะลบ
   *
   * ไม่เทียบชื่อที่เอาไว้แสดงผล เพราะตารางใหม่ตั้งใจให้ชื่อมาจาก
   * certification_types ที่เดียว แทนที่จะเป็นข้อความอิสระของแต่ละแถว
   */
  const key = (c: Record<string, unknown>) =>
    [c.shortCode, c.certNumber, c.issuedBy, c.validUntil, c.verified].join('|');

  test('ใบรับรองของทุกฟาร์มตรงกับตารางเก่าทุกใบ', async () => {
    const farms = await loadFarms({});

    const legacy = await pool.query(
      `SELECT farm_id, short_code, cert_number, issued_by, valid_until, verified
         FROM farm_certifications
        WHERE EXISTS (SELECT 1 FROM farms f WHERE f.id = farm_id)`
    );

    const expected = new Map<string, string[]>();
    for (const r of legacy.rows) {
      const list = expected.get(r.farm_id) ?? [];
      list.push(
        [r.short_code, r.cert_number, r.issued_by, r.valid_until, r.verified].join('|')
      );
      expected.set(r.farm_id, list);
    }

    for (const farm of farms) {
      const want = expected.get(farm.id);
      if (!want) continue;

      const actual = new Set((farm.certificationDetails as Record<string, unknown>[]).map(key));
      const missing = want.filter((w) => !actual.has(w));
      expect({ farm: farm.id, missing }).toEqual({ farm: farm.id, missing: [] });
    }
  });

  test('ฟาร์มที่มีทั้ง GAP และ GI ต้องได้ครบสองใบ ไม่ใช่ใบเดียว', async () => {
    // GI อยู่คนละตารางกับ GAP หลังย้าย ถ้าขาอ่านลืม join ตารางระดับภูมิภาค
    // ใบ GI จะหายจากหน้าเว็บโดยที่จำนวนใบอื่นยังถูกต้อง ซึ่งสังเกตยาก
    const farms = await loadFarms({});
    const withBoth = farms.filter((f) => {
      const codes = (f.certificationDetails as Record<string, unknown>[]).map((c) => c.shortCode);
      return codes.includes('GAP') && codes.includes('GI');
    });

    expect(withBoth.length).toBeGreaterThan(0);
  });

  test('รูปใบรับรองมาเฉพาะตอนที่ขอ ไม่ติดมากับหน้ารายชื่อ', async () => {
    // รูปเป็น base64 รวมเกือบ 1 MB หน้ารายชื่อไม่ได้ใช้
    const listed = await loadFarms({});
    const hasPhotoField = listed.some((f) =>
      (f.certificationDetails as Record<string, unknown>[]).some((c) => 'documentPhoto' in c)
    );
    expect(hasPhotoField).toBe(false);

    const detailed = await loadFarms({ includeCertificatePhotos: true });
    const anyWithPhoto = detailed.some((f) =>
      (f.certificationDetails as Record<string, unknown>[]).some((c) => 'documentPhoto' in c)
    );
    expect(anyWithPhoto).toBe(true);
  });
});
