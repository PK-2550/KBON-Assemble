-- ============================================================================
-- 004  เลขทะเบียนสวน และชื่อบัญชีธนาคาร
--
-- ปลอดภัยกับฐานข้อมูลที่ใช้งานอยู่ เพิ่มอย่างเดียว ไม่ลบไม่แก้ของเดิม
-- รันซ้ำได้ ทุกคำสั่งมี IF NOT EXISTS หรือ OR REPLACE กำกับ
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- เลขทะเบียนสวน  DT-2026-00042
--
-- ใช้ SEQUENCE จริงเพราะ nextval() เป็น atomic ระดับ Postgres
-- ต่อให้แอดมินสองคนกดอนุมัติพร้อมกัน เลขก็ไม่มีทางซ้ำ
-- ต่างจากการคำนวณ MAX+1 ฝั่งแอปที่ชนกันได้
--
-- เลขอาจขาดเป็นช่วงถ้า transaction ถูก rollback ซึ่งยอมรับได้
-- สิ่งที่ยอมไม่ได้คือเลขซ้ำหรือเลขถูกนำกลับมาใช้ใหม่
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS farm_serial_seq START 1;

ALTER TABLE farms ADD COLUMN IF NOT EXISTS farm_serial       text;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS bank_account_name text;

-- ชื่อบัญชีธนาคารรับมาตั้งแต่ตอนยื่นคำขอได้ เป็นช่องเสริมไม่บังคับ
ALTER TABLE farm_requests ADD COLUMN IF NOT EXISTS bank_account_name text;

-- ----------------------------------------------------------------------------
-- ออกเลขให้ตอนสร้างแถวฟาร์มเท่านั้น
--
-- ทั้งเส้นทางอนุมัติคำขอและเส้นทางที่แอดมินสร้างฟาร์มเองไม่ได้ส่งสองคอลัมน์นี้
-- มาในคำสั่ง INSERT trigger จึงเป็นคนเติมให้ และเพราะเป็น BEFORE INSERT
-- การ UPSERT ที่ไปเข้าสาขา ON CONFLICT DO UPDATE (คือตอนอนุมัติคำขอแก้ไขข้อมูล
-- ของฟาร์มเดิม) จะไม่ทำให้เลขถูกออกใหม่หรือถูกแตะเลย
--
-- ชื่อบัญชีธนาคารเติมเลขทะเบียนให้ต่อเมื่อผู้ยื่นเว้นว่างไว้จริง ๆ
-- ถ้ากรอกมาแล้วจะไม่ถูกทับ
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_farm_serial_and_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.farm_serial IS NULL THEN
    NEW.farm_serial := 'DT-' || to_char(now(), 'YYYY') || '-'
                       || lpad(nextval('farm_serial_seq')::text, 5, '0');
  END IF;

  IF NEW.bank_account_name IS NULL OR btrim(NEW.bank_account_name) = '' THEN
    NEW.bank_account_name := NEW.farm_serial;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS farms_set_serial_and_defaults ON farms;
CREATE TRIGGER farms_set_serial_and_defaults
  BEFORE INSERT ON farms
  FOR EACH ROW EXECUTE FUNCTION set_farm_serial_and_defaults();

-- ----------------------------------------------------------------------------
-- เลขทะเบียนห้ามเปลี่ยนหลังออกแล้ว
--
-- กันสองชั้น ชั้นแรกคือไม่เปิดช่องแก้ไว้ใน whitelist ของ PATCH /api/farms/:id
-- ชั้นนี้กันกรณีที่มีคนเขียน UPDATE ตรงเข้าฐานข้อมูล หรือโค้ดใหม่ในอนาคต
-- เผลอส่งคอลัมน์นี้มาใน UPSERT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_farm_serial_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.farm_serial IS NOT NULL AND NEW.farm_serial IS DISTINCT FROM OLD.farm_serial THEN
    RAISE EXCEPTION 'farm_serial แก้ไขไม่ได้ (farm % เดิม % ใหม่ %)',
      OLD.id, OLD.farm_serial, NEW.farm_serial;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS farms_prevent_serial_change ON farms;
CREATE TRIGGER farms_prevent_serial_change
  BEFORE UPDATE ON farms
  FOR EACH ROW EXECUTE FUNCTION prevent_farm_serial_change();

-- ----------------------------------------------------------------------------
-- ฟาร์มที่มีอยู่ก่อนแล้ว
--
-- trigger ข้างบนเป็น BEFORE INSERT จึงไม่ทำงานกับแถวเดิม ต้องเติมเอง
-- เรียงตาม created_at เพื่อให้ลำดับเลขสะท้อนลำดับการขึ้นทะเบียนจริง
-- และใช้ปีที่ฟาร์มถูกสร้างจริง ไม่ใช่ปีที่รัน migration นี้
-- ----------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, created_at FROM farms WHERE farm_serial IS NULL ORDER BY created_at ASC, id ASC
  LOOP
    UPDATE farms
       SET farm_serial = 'DT-' || to_char(r.created_at, 'YYYY') || '-'
                          || lpad(nextval('farm_serial_seq')::text, 5, '0')
     WHERE id = r.id;
  END LOOP;

  UPDATE farms
     SET bank_account_name = farm_serial
   WHERE bank_account_name IS NULL OR btrim(bank_account_name) = '';
END $$;

ALTER TABLE farms ALTER COLUMN farm_serial SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farms_farm_serial_unique'
  ) THEN
    ALTER TABLE farms ADD CONSTRAINT farms_farm_serial_unique UNIQUE (farm_serial);
  END IF;
END $$;

COMMIT;
