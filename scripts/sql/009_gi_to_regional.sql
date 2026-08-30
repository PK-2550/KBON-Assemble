-- ============================================================================
-- 009  ย้ายใบ GI จาก farm_certifications ไปตาราง regional_certifications
--
-- 005 ตั้งใจไม่ย้าย GI อัตโนมัติ เพราะแถวเดิมเก็บใบซ้ำเป็นแถวต่อสวน
-- ไม่มีข้อมูลบอกว่าสวนไหนอยู่โซนเดียวกัน ไฟล์นี้ใช้จังหวัดของสวนเป็นตัวจับกลุ่ม
-- ซึ่งเป็นข้อมูลเดียวที่มีอยู่จริง ไม่ใช่การเดาชื่อโซนขึ้นมาเอง
--
-- ชื่อโซนที่เติมให้คือชื่อจังหวัดตรง ๆ เก็บเป็นคอลัมน์ธรรมดาที่ UPDATE ได้
-- แอดมินจึงเปลี่ยนเป็นชื่อจริงอย่าง 'ทุเรียนภูเขาไฟศรีสะเกษ' ทีหลังได้
-- โดยไม่ต้องแก้โค้ดและไม่ทำให้สวนที่ผูกไว้หลุด เพราะ join ใช้ id ไม่ใช่ชื่อ
--
-- ไฟล์นี้อยู่นอกโฟลเดอร์ migrations ด้วยเหตุผลเดียวกับ 007
-- docker-compose ผูก ./migrations ไว้กับ /docker-entrypoint-initdb.d ซึ่งรัน
-- ตอนสร้าง volume ครั้งแรกเท่านั้น ตอนนั้นยังไม่มีข้อมูลให้ย้าย และข้อมูลตัวอย่าง
-- ถูก seed เข้ามาทีหลัง ไฟล์นี้จึงต้องรันด้วยมือหลัง seed
--
--   docker exec -i duritrack-postgres psql -U duritrack -d duritrack \
--     -f /dev/stdin < scripts/sql/009_gi_to_regional.sql
--
-- รันซ้ำได้ ไม่เกิดข้อมูลซ้ำ และไม่ทำลายข้อมูลเดิม ตาราง farm_certifications
-- ไม่ถูกแตะเลยในไฟล์นี้ การลบอยู่ใน 007
-- ============================================================================

BEGIN;

DO $$
DECLARE
  n_no_province integer;
  n_no_type     integer;
BEGIN
  -- ยาม 1  จังหวัดคือกุญแจจับกลุ่ม ถ้าสวนไหนไม่มีจังหวัดจะจับกลุ่มไม่ได้
  -- ปล่อยผ่านไม่ได้ เพราะแถวนั้นจะเงียบหายไปโดยไม่มีใครรู้
  SELECT count(*) INTO n_no_province
    FROM farm_certifications fc
    JOIN farms f ON f.id = fc.farm_id
   WHERE fc.short_code = 'GI'
     AND (f.province IS NULL OR btrim(f.province) = '');

  IF n_no_province > 0 THEN
    RAISE EXCEPTION 'หยุด: มีใบ GI % แถวที่สวนไม่มีจังหวัด จับกลุ่มโซนไม่ได้', n_no_province;
  END IF;

  -- ยาม 2  ต้องมีประเภท GI ในตารางค้นหาก่อน ไม่งั้น trigger จะปฏิเสธทุกแถว
  SELECT count(*) INTO n_no_type
    FROM certification_types WHERE code = 'GI' AND tier = 'regional';

  IF n_no_type = 0 THEN
    RAISE EXCEPTION 'หยุด: ไม่พบประเภท GI ที่ tier = regional รัน 005 ก่อน';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- สร้างโซนหนึ่งแถวต่อหนึ่งจังหวัด
--
-- ข้อมูลตัวแทนของโซน (หน่วยงานที่ออก เลขที่ใบ วันหมดอายุ) เอาจากแถวเดิมที่ id
-- น้อยที่สุดในกลุ่ม คือใบที่บันทึกเข้าระบบก่อนเพื่อน ไม่ได้เลือกแบบสุ่ม
-- ถ้าในกลุ่มมีเลขที่ใบต่างกัน แอดมินแก้ให้ถูกทีหลังได้
--
-- valid_until เดิมเก็บเป็นปีเปล่าอย่าง '2030' ตารางนี้ไม่มีคอลัมน์บอกความละเอียด
-- แบบ certifications จึงปัดเป็น 31 ธ.ค. ของปีนั้น ปีที่อ่านไม่ออกปล่อยเป็น NULL
-- ----------------------------------------------------------------------------
WITH gi_rows AS (
  SELECT
    fc.id,
    f.province,
    fc.issued_by,
    fc.cert_number,
    fc.valid_until,
    fc.verified,
    row_number() OVER (PARTITION BY f.province ORDER BY fc.id) AS pick
  FROM farm_certifications fc
  JOIN farms f ON f.id = fc.farm_id
  WHERE fc.short_code = 'GI'
)
INSERT INTO regional_certifications (
  certification_type_id, region_name, province,
  issuing_authority, cert_number, expiry_date, approval_status
)
SELECT
  (SELECT id FROM certification_types WHERE code = 'GI'),
  g.province,          -- ชื่อโซนตั้งต้น แอดมินเปลี่ยนได้
  g.province,
  g.issued_by,
  g.cert_number,
  CASE WHEN g.valid_until ~ '^\d{4}$' THEN make_date(g.valid_until::int, 12, 31) END,
  CASE WHEN g.verified THEN 'approved' ELSE 'pending' END
FROM gi_rows g
WHERE g.pick = 1
  -- กันข้อมูลซ้ำด้วยจังหวัด ไม่ใช่ด้วยชื่อโซน
  --
  -- UNIQUE ของตารางอยู่ที่ (ประเภท, ชื่อโซน) ซึ่งใช้เป็นกุญแจกันซ้ำที่นี่ไม่ได้
  -- เพราะชื่อโซนตั้งใจให้แอดมินแก้ได้ พอแก้แล้วรันซ้ำ ON CONFLICT จะไม่ชนอะไร
  -- แล้วสร้างโซนของจังหวัดเดิมขึ้นมาใหม่ทับซ้อนกับของเก่า
  AND NOT EXISTS (
        SELECT 1
          FROM regional_certifications rc
         WHERE rc.certification_type_id = (SELECT id FROM certification_types WHERE code = 'GI')
           AND rc.province = g.province
      );

-- ----------------------------------------------------------------------------
-- ผูกสวนเข้ากับโซนของจังหวัดตัวเอง
--
-- จับคู่ผ่านจังหวัด ไม่ได้จับผ่านชื่อโซน เพราะแอดมินอาจเปลี่ยนชื่อโซนไปแล้ว
-- ตอนรันซ้ำ ซึ่งไม่ควรทำให้การผูกพัง
-- ----------------------------------------------------------------------------
INSERT INTO farm_regional_certifications (farm_id, regional_certification_id)
SELECT DISTINCT
       fc.farm_id,
       -- จังหวัดหนึ่งอาจมีโซนมากกว่าหนึ่งในอนาคต เลือกโซนที่สร้างก่อนเสมอ
       -- ไม่งั้นการรันซ้ำจะผูกสวนเดียวกันเข้ากับทุกโซนในจังหวัดนั้น
       (SELECT rc.id
          FROM regional_certifications rc
         WHERE rc.certification_type_id = (SELECT id FROM certification_types WHERE code = 'GI')
           AND rc.province = f.province
         ORDER BY rc.id
         LIMIT 1)
  FROM farm_certifications fc
  JOIN farms f ON f.id = fc.farm_id
 WHERE fc.short_code = 'GI'
   AND EXISTS (
         SELECT 1 FROM regional_certifications rc
          WHERE rc.certification_type_id = (SELECT id FROM certification_types WHERE code = 'GI')
            AND rc.province = f.province
       )
ON CONFLICT (farm_id, regional_certification_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- ยามท้ายสุด  ทุกใบ GI ต้องผูกกับโซนแล้วจริง ไม่งั้น rollback ทั้งก้อน
-- ----------------------------------------------------------------------------
DO $$
DECLARE n_left integer;
BEGIN
  SELECT count(*) INTO n_left
    FROM farm_certifications fc
   WHERE fc.short_code = 'GI'
     AND EXISTS (SELECT 1 FROM farms f WHERE f.id = fc.farm_id)
     AND NOT EXISTS (
           SELECT 1 FROM farm_regional_certifications frc
            WHERE frc.farm_id = fc.farm_id
         );

  IF n_left > 0 THEN
    RAISE EXCEPTION 'หยุด: ย้ายไม่ครบ ยังเหลือใบ GI % แถวที่ไม่ได้ผูกกับโซน', n_left;
  END IF;
END $$;

COMMIT;
