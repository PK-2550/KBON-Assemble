-- ============================================================================
-- 011  ความละเอียดของวันหมดอายุในตารางใบรับรองระดับภูมิภาค
--
-- ตาราง certifications มี expiry_precision กับ legacy_valid_until_raw อยู่แล้ว
-- ตั้งแต่ 005 แต่ regional_certifications ไม่มี ทั้งที่ข้อมูลเดิมของทั้งสองแบบ
-- มาจากคอลัมน์ valid_until ตัวเดียวกันซึ่งเก็บเป็นปีเปล่าอย่าง '2030'
--
-- พอขาอ่านย้ายมาอ่านตารางใหม่ ใบ GI จะแสดงวันหมดอายุเป็น 31 ธ.ค. 2030
-- ทั้งที่ของเดิมแสดงแค่ 2030 คือเติมความแม่นยำที่ไม่เคยมีอยู่จริงให้ผู้ใช้เห็น
--
-- ปลอดภัยกับฐานที่ใช้งานอยู่ เป็นการเพิ่มคอลัมน์ที่มีค่าเริ่มต้น ไม่ลบอะไร
-- ============================================================================

BEGIN;

ALTER TABLE regional_certifications
  ADD COLUMN IF NOT EXISTS expiry_precision text NOT NULL DEFAULT 'day',
  ADD COLUMN IF NOT EXISTS legacy_valid_until_raw text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'regional_certifications_expiry_precision_check'
  ) THEN
    ALTER TABLE regional_certifications
      ADD CONSTRAINT regional_certifications_expiry_precision_check
      CHECK (expiry_precision IN ('day', 'year'));
  END IF;
END $$;

-- เติมค่าให้โซนที่ถูกสร้างไปแล้วโดย 009
--
-- อ้างอิงจากใบเดิมของสวนในจังหวัดนั้น ซึ่งเป็นที่มาของโซนตั้งแต่แรก
-- โซนที่หาต้นทางไม่เจอปล่อยเป็น day ตามค่าเริ่มต้น
UPDATE regional_certifications rc
   SET expiry_precision = 'year'
  FROM (
    SELECT DISTINCT f.province
      FROM farm_certifications fc
      JOIN farms f ON f.id = fc.farm_id
     WHERE fc.short_code = 'GI'
       AND fc.valid_until ~ '^\d{4}$'
  ) src
 WHERE rc.province = src.province
   AND rc.expiry_precision <> 'year';

COMMIT;
