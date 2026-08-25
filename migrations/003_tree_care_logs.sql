-- ประวัติการดูแลต้นไม้รายต้น
--
-- ข้อมูลชุดนี้ไม่ได้ให้คนมานั่งกรอกในเว็บ แต่ไหลเข้ามาจากระบบของสวน
-- (ระบบจัดการแปลง เซ็นเซอร์ หรือไฟล์ที่ส่งมาเป็นงวด) เว็บเป็นฝั่งอ่านอย่างเดียว
-- โครงตารางจึงออกแบบให้ซิงก์ซ้ำได้โดยไม่เกิดข้อมูลซ้ำ
--
-- รันด้วย
--   docker exec -i duritrack-postgres psql -U duritrack -d duritrack < migrations/003_tree_care_logs.sql

BEGIN;

CREATE TABLE IF NOT EXISTS tree_care_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tree_id         text NOT NULL REFERENCES trees (id) ON DELETE CASCADE,
  -- เก็บรหัสต้นซ้ำไว้ เพราะทั้ง API และระบบต้นทางอ้างถึงต้นด้วย code
  -- ซึ่งเป็นรหัสเดียวกับที่พิมพ์บนแท็ก NFC ไม่ใช่ id ภายใน
  tree_code       text NOT NULL,
  farm_id         text NOT NULL REFERENCES farms (id) ON DELETE CASCADE,

  activity_type   text NOT NULL CHECK (activity_type IN
                    ('watering', 'fertilizing', 'pruning', 'spraying',
                     'harvesting', 'inspection', 'other')),
  -- ชื่อกิจกรรมแบบอิสระ ใช้เมื่อระบบต้นทางส่งกิจกรรมที่ไม่ตรงกับประเภทข้างบน
  activity_label  text,

  -- วันที่ลงมือทำจริง แยกจาก created_at ที่เป็นวันที่ข้อมูลเข้าระบบ
  -- ข้อมูลอาจถูกซิงก์เข้ามาหลังเหตุการณ์หลายวัน ถ้าใช้ค่าเดียวประวัติจะเพี้ยน
  performed_at    date NOT NULL,
  notes           text,

  -- ที่มาของข้อมูล ใช้แยกว่ามาจากไฟล์นำเข้า เซ็นเซอร์ หรือคนกรอกเอง
  source          text NOT NULL DEFAULT 'import'
                       CHECK (source IN ('import', 'sensor', 'manual')),
  -- id ของรายการนี้ในระบบต้นทาง
  external_id     text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- กันข้อมูลซ้ำเวลาซิงก์รอบใหม่
-- ใช้ unique index แทน table constraint เพราะต้องการให้ external_id ที่เป็น NULL
-- (กรณีคนกรอกเอง) ไม่ถูกบังคับ unique
CREATE UNIQUE INDEX IF NOT EXISTS tree_care_logs_source_external_idx
  ON tree_care_logs (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tree_care_logs_tree_code_idx
  ON tree_care_logs (tree_code, performed_at DESC);
CREATE INDEX IF NOT EXISTS tree_care_logs_farm_id_idx ON tree_care_logs (farm_id);

DROP TRIGGER IF EXISTS tree_care_logs_set_updated_at ON tree_care_logs;
CREATE TRIGGER tree_care_logs_set_updated_at
  BEFORE UPDATE ON tree_care_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- รูปภาพประกอบของแต่ละรายการ
--
-- แยกเป็นอีกตารางแทนการเก็บเป็น text[] ในตารางหลัก เพราะรูปอาจเป็น base64
-- ก้อนใหญ่ (ใบรับรองในระบบนี้มีถึง 426 KB ต่อไฟล์) ถ้าอยู่ตารางเดียวกัน
-- การดึงรายการประวัติจะลากรูปทุกใบมาด้วยเสมอ
-- แยกแล้วเลือกดึงเฉพาะตอนผู้ใช้กดดูรูปได้
--
-- คอลัมน์ photo รับได้ทั้ง base64 data URI และ URL ธรรมดา
-- ระบบต้นทางส่ง URL มามากกว่า ส่วนรูปที่คนอัปโหลดเองจะเป็น base64
-- ฝั่งหน้าเว็บใช้เป็น src ของ img ได้เหมือนกันทั้งสองแบบ
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tree_care_log_photos (
  id         bigserial PRIMARY KEY,
  log_id     uuid NOT NULL REFERENCES tree_care_logs (id) ON DELETE CASCADE,
  photo      text NOT NULL,
  caption    text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS tree_care_log_photos_log_id_idx
  ON tree_care_log_photos (log_id, sort_order);

COMMIT;
