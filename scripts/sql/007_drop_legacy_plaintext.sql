-- ============================================================================
-- 007  ลบข้อมูลรูปแบบเดิมทิ้ง -- ทำลายข้อมูล ย้อนกลับไม่ได้
--
-- ไฟล์นี้อยู่นอกโฟลเดอร์ migrations โดยตั้งใจ
--
-- docker-compose ผูก ./migrations ไว้กับ /docker-entrypoint-initdb.d ซึ่ง Postgres
-- จะไล่รันทุกไฟล์ตามลำดับชื่อ "ตอนสร้าง volume ครั้งแรก" ถ้าไฟล์นี้ไปอยู่ในนั้น
-- คนที่สร้างฐานข้อมูลใหม่จะได้ schema ที่ลบคอลัมน์และตารางเดิมไปแล้ว
-- ทั้งที่โค้ดเซิร์ฟเวอร์ที่รันอยู่ยังอ่านของเดิมอยู่ แอปจะพังทันทีตั้งแต่ยังไม่เริ่ม
--
-- รันด้วยมือเท่านั้น และรันได้ต่อเมื่อครบทุกข้อนี้แล้ว
--
--   1. รัน 006 แล้ว
--   2. รันสคริปต์เข้ารหัสข้อมูลเดิมแล้ว และตรวจแล้วว่าครบทุกแถว
--   3. ตรวจข้อมูลที่ย้ายเข้า certifications จาก 005 แล้วว่าถูกต้อง
--      รวมถึงรัน 009 (ย้ายใบ GI) และ 010 (เก็บตกใบที่ค้าง) แล้ว
--   4. โค้ดฝั่งเซิร์ฟเวอร์เลิกอ่าน farmer_id_card_number, farmer_id_card_photo
--      และตาราง farm_certifications แล้ว
--
--   psql -U duritrack -d duritrack -f scripts/sql/007_drop_legacy_plaintext.sql
--
-- ยามข้างล่างจะหยุดการทำงานทั้งหมดถ้ายังมีข้อมูลที่ยังไม่ถูกเข้ารหัส
-- รันผิดจังหวะจะไม่ทำให้ข้อมูลหาย แต่จะขึ้น exception แล้ว rollback ทั้งก้อน
-- ============================================================================

BEGIN;

DO $$
DECLARE
  n_id_plain    integer;
  n_photo_plain integer;
  n_cert_left   integer;
  n_gi_left     integer;
BEGIN
  -- ยาม 1  ยังมีเลขบัตรที่เป็นข้อความธรรมดาแต่ยังไม่มีฉบับเข้ารหัสหรือไม่
  SELECT count(*) INTO n_id_plain
    FROM farm_requests
   WHERE farmer_id_card_number IS NOT NULL
     AND btrim(farmer_id_card_number) <> ''
     AND farmer_id_card_ciphertext IS NULL;

  IF n_id_plain > 0 THEN
    RAISE EXCEPTION 'หยุด: ยังมี % แถวที่เลขบัตรยังไม่ถูกเข้ารหัส รันสคริปต์เข้ารหัสให้ครบก่อน', n_id_plain;
  END IF;

  -- ยาม 2  รูปบัตรก็เช่นกัน
  SELECT count(*) INTO n_photo_plain
    FROM farm_requests
   WHERE farmer_id_card_photo IS NOT NULL
     AND btrim(farmer_id_card_photo) <> ''
     AND farmer_id_card_photo_ciphertext IS NULL;

  IF n_photo_plain > 0 THEN
    RAISE EXCEPTION 'หยุด: ยังมี % แถวที่รูปบัตรยังไม่ถูกเข้ารหัส', n_photo_plain;
  END IF;

  -- ยาม 3  ใบรับรองเดิมถูกย้ายเข้าตารางใหม่ครบหรือยัง
  --
  -- เทียบถึงระดับประเภทและเลขที่ใบ ไม่ใช่แค่ว่าฟาร์มนี้มีใบอะไรสักใบในตารางใหม่
  -- ยามรุ่นแรกเช็คแค่ว่ามีอย่างน้อยหนึ่งใบ ซึ่งปล่อยผ่านฟาร์มที่มีสามใบ
  -- แล้วย้ายสำเร็จใบเดียว อีกสองใบจะหายไปพร้อมกับการลบตารางในไฟล์นี้
  --
  -- ใช้เกณฑ์จับคู่ประเภทชุดเดียวกับ 005 กับ 010 และชุดทดสอบ
  -- certifications-legacy-parity
  SELECT count(*) INTO n_cert_left
    FROM farm_certifications fc
    JOIN certification_types ct
      ON ct.code = CASE
           WHEN fc.short_code ILIKE 'GAP'      THEN 'GAP'
           WHEN fc.short_code ILIKE 'Organic%' THEN 'ORGANIC_TH'
           WHEN fc.short_code ILIKE 'GMP'      THEN 'GMP'
           WHEN fc.short_code ILIKE 'GACC'     THEN 'GACC'
           ELSE 'LEGACY_OTHER'
         END
   WHERE fc.short_code IS DISTINCT FROM 'GI'
     AND EXISTS (SELECT 1 FROM farms f WHERE f.id = fc.farm_id)
     AND NOT EXISTS (
           SELECT 1 FROM certifications c
            WHERE c.farm_id = fc.farm_id
              AND c.certification_type_id = ct.id
              AND c.cert_number IS NOT DISTINCT FROM fc.cert_number
         );

  IF n_cert_left > 0 THEN
    RAISE EXCEPTION 'หยุด: ยังมีใบรับรองเดิม % แถวที่ไม่พบคู่ในตาราง certifications', n_cert_left;
  END IF;

  -- ยาม 4  ใบ GI ถูกผูกกับโซนภูมิศาสตร์ครบหรือยัง
  --
  -- ยามรุ่นแรกยกเว้น GI ทั้งหมดเพราะตอนนั้นยังไม่มีที่ให้ย้ายไป
  -- ตอนนี้ 009 ย้ายเข้า regional_certifications แล้ว ถ้าไม่ตรวจ
  -- การลบตารางในไฟล์นี้จะทำให้ใบ GI ที่ยังไม่ถูกผูกหายไปเงียบ ๆ
  SELECT count(*) INTO n_gi_left
    FROM farm_certifications fc
   WHERE fc.short_code = 'GI'
     AND EXISTS (SELECT 1 FROM farms f WHERE f.id = fc.farm_id)
     AND NOT EXISTS (
           SELECT 1 FROM farm_regional_certifications frc
            WHERE frc.farm_id = fc.farm_id
         );

  IF n_gi_left > 0 THEN
    RAISE EXCEPTION 'หยุด: ยังมีใบ GI % แถวที่ไม่ได้ผูกกับโซนภูมิศาสตร์ รัน 009 ก่อน', n_gi_left;
  END IF;
END $$;

-- ล้างค่าจริงก่อนลบคอลัมน์
--
-- DROP COLUMN อย่างเดียวไม่ได้ลบข้อมูลออกจากดิสก์ Postgres แค่เลิกแสดงคอลัมน์นั้น
-- ส่วน tuple เดิมที่มีข้อความจริงยังนอนเป็นพื้นที่ตายอยู่จนกว่าจะถูก vacuum
UPDATE farm_requests
   SET farmer_id_card_number = NULL,
       farmer_id_card_photo  = NULL
 WHERE farmer_id_card_number IS NOT NULL
    OR farmer_id_card_photo IS NOT NULL;

ALTER TABLE farm_requests DROP COLUMN IF EXISTS farmer_id_card_number;
ALTER TABLE farm_requests DROP COLUMN IF EXISTS farmer_id_card_photo;

DROP TABLE IF EXISTS farm_certifications;

COMMIT;

-- ----------------------------------------------------------------------------
-- ต้องทำต่อนอก transaction นี้ (VACUUM รันใน BEGIN/COMMIT ไม่ได้)
--
--   VACUUM FULL farm_requests;
--
-- และยังต้องจัดการนอกฐานข้อมูลอีกสองอย่าง ซึ่ง SQL ทำให้ไม่ได้
--
--   ไฟล์สำรองและ WAL ที่ถูกสร้างไว้ก่อนหน้านี้ยังมีข้อความจริงอยู่ครบ
--   ถ้ามี read replica หรือ logical replication ปลายทางก็ยังมีจนกว่าจะ replay ตาม
--
-- สองข้อนี้ต้องมีคนรับผิดชอบชัดเจน ไม่ใช่งานที่จบในไฟล์นี้
-- ----------------------------------------------------------------------------
