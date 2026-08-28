-- ============================================================================
-- 005  ใบรับรองแยกประเภทสี่ระดับ
--
-- ปลอดภัยกับฐานข้อมูลที่ใช้งานอยู่ ตาราง farm_certifications เดิมยังอยู่ครบ
-- ไม่ถูกแตะเลยในไฟล์นี้ การลบอยู่ใน 007 หลังตรวจข้อมูลที่ย้ายมาแล้วว่าถูกต้อง
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- ประเภทใบรับรอง -- เป็นตารางค้นหา ไม่ใช่ CHECK enum
--
-- เพิ่มประเภทใหม่ในอนาคตจะเป็นแค่การ INSERT ไม่ต้อง migrate schema
-- และไม่ต้องให้ Postgres ไล่ตรวจทุกแถวใหม่แบบที่การแก้ CHECK constraint ต้องทำ
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certification_types (
  id              serial  PRIMARY KEY,
  code            text    NOT NULL UNIQUE,
  tier            text    NOT NULL CHECK (tier IN ('farm', 'packing_house', 'shipment', 'regional')),
  name            text    NOT NULL,
  name_th         text,
  requires_expiry boolean NOT NULL DEFAULT true,  -- ใช้เป็นคำแนะนำในฟอร์มเท่านั้น ไม่ได้บังคับที่ฐานข้อมูล
  sort_order      integer NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true
);

INSERT INTO certification_types (code, tier, name, name_th, sort_order) VALUES
  ('GAP',        'farm',          'GAP (Good Agricultural Practice)', 'มาตรฐาน GAP',              1),
  ('ORGANIC_TH', 'farm',          'Organic Thailand',                 'เกษตรอินทรีย์ไทย',          2),
  ('GMP',        'packing_house', 'GMP',                              'มาตรฐาน GMP โรงคัดบรรจุ',   3),
  ('GACC',       'packing_house', 'GACC Registration',                'ขึ้นทะเบียน GACC',          4),
  ('PHYTO',      'shipment',      'Phytosanitary Certificate',        'ใบรับรองสุขอนามัยพืช',      5),
  ('GI',         'regional',      'GI (Geographical Indication)',     'สิ่งบ่งชี้ทางภูมิศาสตร์',    6),
  ('LEGACY_OTHER', 'farm',        'Other (migrated)',                 'อื่น ๆ (ย้ายมาจากระบบเดิม)', 99)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- ใบรับรองระดับสวน โรงคัดบรรจุ และการขนส่งรายเที่ยว
--
-- tier ถูกคัดลอกมาเก็บไว้ในแถวนี้เอง (trigger เป็นคนเติมจาก certification_types)
-- ไม่ได้ join เอาตอนใช้งาน เพราะเงื่อนไขของ partial index กับ CHECK ของ Postgres
-- ต้องเป็นนิพจน์ที่ immutable ต่อแถว จะไป subquery ตารางอื่นไม่ได้
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certifications (
  id                    bigserial PRIMARY KEY,
  certification_type_id integer NOT NULL REFERENCES certification_types (id),
  tier                  text    NOT NULL CHECK (tier IN ('farm', 'packing_house', 'shipment')),
  farm_id               text    NOT NULL REFERENCES farms (id) ON DELETE CASCADE,

  -- ยังไม่มีตาราง shipments ในระบบ (ค้นทั้ง repo แล้วไม่มีที่ไหนอ้างถึง)
  -- จึงอ้างอิงหลวม ๆ เป็นข้อความไปก่อน ไม่ผูก FK
  -- เมื่อมีระบบเที่ยวขนส่งจริงค่อย migrate เป็น shipment_id พร้อม FK
  shipment_ref          text,

  issuing_authority     text,
  cert_number           text,
  issue_date            date,
  expiry_date           date,
  -- ข้อมูลเดิมเก็บวันหมดอายุเป็นปีเปล่าอย่าง '2029' ธงนี้บอกว่าค่าที่เห็น
  -- ละเอียดถึงระดับวันจริง หรือรู้แค่ปีแล้วเราปัดให้เป็น 31 ธ.ค. เอง
  expiry_precision      text NOT NULL DEFAULT 'day' CHECK (expiry_precision IN ('day', 'year')),
  legacy_valid_until_raw text,

  attachment_data       text,  -- base64 data URI ตามรูปแบบเดิมของระบบ
  attachment_file_name  text,
  attachment_file_type  text CHECK (attachment_file_type IN ('image', 'pdf')),

  approval_status       text NOT NULL DEFAULT 'pending'
                             CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  admin_notes           text,
  previous_admin_notes  text,
  reviewed_by           text,
  reviewed_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CHECK (expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date)
);

-- เติม tier จากประเภท และบังคับกฎที่ต่างกันตามระดับ
CREATE OR REPLACE FUNCTION validate_certification_tier()
RETURNS TRIGGER AS $$
DECLARE actual_tier text;
BEGIN
  SELECT tier INTO actual_tier FROM certification_types WHERE id = NEW.certification_type_id;

  IF actual_tier IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ certification_type_id %', NEW.certification_type_id;
  END IF;

  IF actual_tier = 'regional' THEN
    RAISE EXCEPTION 'ใบรับรองระดับภูมิภาคต้องอยู่ในตาราง regional_certifications ไม่ใช่ certifications';
  END IF;

  NEW.tier := actual_tier;

  IF actual_tier = 'shipment' AND NEW.shipment_ref IS NULL THEN
    RAISE EXCEPTION 'ใบรับรองระดับการขนส่งรายเที่ยวต้องระบุ shipment_ref';
  END IF;

  IF actual_tier <> 'shipment' AND NEW.shipment_ref IS NOT NULL THEN
    RAISE EXCEPTION 'shipment_ref ใช้ได้เฉพาะใบรับรองระดับการขนส่งรายเที่ยวเท่านั้น';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS certifications_validate_tier ON certifications;
CREATE TRIGGER certifications_validate_tier
  BEFORE INSERT OR UPDATE ON certifications
  FOR EACH ROW EXECUTE FUNCTION validate_certification_tier();

DROP TRIGGER IF EXISTS certifications_set_updated_at ON certifications;
CREATE TRIGGER certifications_set_updated_at
  BEFORE UPDATE ON certifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS certifications_farm_id_idx ON certifications (farm_id);
CREATE INDEX IF NOT EXISTS certifications_type_id_idx ON certifications (certification_type_id);

-- ฟาร์มหนึ่งมีใบ GAP หรือ GMP ที่อนุมัติแล้วได้ใบเดียวต่อประเภท
-- การต่ออายุคือทับของเดิม ไม่ใช่มีสองใบใช้งานพร้อมกัน
-- ไม่รวม shipment เพราะโดยธรรมชาติมีได้หลายใบต่อฟาร์ม
CREATE UNIQUE INDEX IF NOT EXISTS certifications_one_active_per_farm_type_idx
  ON certifications (farm_id, certification_type_id)
  WHERE approval_status = 'approved' AND tier IN ('farm', 'packing_house');

-- ใช้อ่านป้ายใบรับรองในหน้ารายชื่อฟาร์ม -- covering index กันไม่ให้ต้องเปิดแถวจริง
-- ไม่รวม shipment เพราะไม่ใช่คุณสมบัติถาวรของสวน จึงไม่ถูกแสดงเป็นป้าย
CREATE INDEX IF NOT EXISTS certifications_farm_approved_idx
  ON certifications (farm_id) INCLUDE (certification_type_id)
  WHERE approval_status = 'approved' AND tier IN ('farm', 'packing_house');

-- ----------------------------------------------------------------------------
-- ใบรับรองระดับภูมิภาค เช่น GI
--
-- แยกตารางเพราะใบแบบนี้เป็นของโซนภูมิศาสตร์ ไม่ใช่ของสวนรายตัว
-- สวนหลายสิบแห่งในโซนเดียวกันอ้างอิงใบใบเดียวกัน ถ้าเก็บซ้ำเป็นแถวต่อสวน
-- พอใบต่ออายุหรือเปลี่ยนหน่วยงานที่ออก ข้อมูลของแต่ละสวนจะเพี้ยนกันเอง
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regional_certifications (
  id                    bigserial PRIMARY KEY,
  certification_type_id integer NOT NULL REFERENCES certification_types (id),
  region_name           text    NOT NULL,   -- เช่น 'ทุเรียนภูเขาไฟศรีสะเกษ'
  province              text    NOT NULL,
  issuing_authority     text,
  cert_number           text,
  issue_date            date,
  expiry_date           date,
  attachment_data       text,
  attachment_file_name  text,
  attachment_file_type  text CHECK (attachment_file_type IN ('image', 'pdf')),
  approval_status       text NOT NULL DEFAULT 'pending'
                             CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  admin_notes           text,
  previous_admin_notes  text,
  reviewed_by           text,
  reviewed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (certification_type_id, region_name)
);

CREATE OR REPLACE FUNCTION validate_regional_certification_tier()
RETURNS TRIGGER AS $$
DECLARE actual_tier text;
BEGIN
  SELECT tier INTO actual_tier FROM certification_types WHERE id = NEW.certification_type_id;
  IF actual_tier IS DISTINCT FROM 'regional' THEN
    RAISE EXCEPTION 'regional_certifications รับได้เฉพาะประเภทที่ tier = regional เท่านั้น';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS regional_certifications_validate_tier ON regional_certifications;
CREATE TRIGGER regional_certifications_validate_tier
  BEFORE INSERT OR UPDATE ON regional_certifications
  FOR EACH ROW EXECUTE FUNCTION validate_regional_certification_tier();

DROP TRIGGER IF EXISTS regional_certifications_set_updated_at ON regional_certifications;
CREATE TRIGGER regional_certifications_set_updated_at
  BEFORE UPDATE ON regional_certifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS farm_regional_certifications (
  farm_id                   text   NOT NULL REFERENCES farms (id) ON DELETE CASCADE,
  regional_certification_id bigint NOT NULL REFERENCES regional_certifications (id) ON DELETE CASCADE,
  linked_at                 timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (farm_id, regional_certification_id)
);

-- farm_id ไม่ต้องมี index แยก เพราะเป็นคอลัมน์แรกของ primary key อยู่แล้ว
CREATE INDEX IF NOT EXISTS farm_regional_certifications_regional_idx
  ON farm_regional_certifications (regional_certification_id);

-- ----------------------------------------------------------------------------
-- ย้ายข้อมูลจาก farm_certifications เดิม
--
-- ไม่ย้าย GI เข้ามาที่นี่โดยตั้งใจ เพราะแถวเดิมไม่มีข้อมูลพอจะรู้ว่าเป็น GI
-- ของโซนไหน ต้องให้แอดมินจับคู่เข้ากับ regional_certifications เอง
--
-- WHERE NOT EXISTS ทำให้รันซ้ำแล้วไม่เกิดข้อมูลซ้ำ
-- ----------------------------------------------------------------------------
INSERT INTO certifications (
  certification_type_id, tier, farm_id, issuing_authority, cert_number,
  expiry_date, expiry_precision, legacy_valid_until_raw,
  attachment_data, attachment_file_name, attachment_file_type, approval_status
)
SELECT
  ct.id,
  ct.tier,
  fc.farm_id,
  fc.issued_by,
  fc.cert_number,
  CASE WHEN fc.valid_until ~ '^\d{4}$' THEN make_date(fc.valid_until::int, 12, 31) ELSE NULL END,
  CASE WHEN fc.valid_until ~ '^\d{4}$' THEN 'year' ELSE 'day' END,
  CASE WHEN fc.valid_until ~ '^\d{4}$' THEN NULL ELSE fc.valid_until END,
  fc.document_photo,
  fc.file_name,
  CASE WHEN fc.file_type IN ('image', 'pdf') THEN fc.file_type ELSE NULL END,
  CASE WHEN fc.verified THEN 'approved' ELSE 'pending' END
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

COMMIT;
