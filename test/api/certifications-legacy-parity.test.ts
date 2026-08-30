import 'dotenv/config';
import { describe, test, expect, afterAll } from 'vitest';
import { pool } from '../../server/db';

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
