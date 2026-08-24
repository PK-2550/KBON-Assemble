-- รองรับฟีเจอร์สมัครฟาร์มและระบบอนุมัติของแอดมิน (มาจาก branch main commit 87ec731)
--
-- ฟีเจอร์นี้อยู่บน main อยู่แล้วตอนที่เราเริ่มย้ายฐานข้อมูล แต่ branch ที่ทำ migration
-- แตกออกมาก่อนหน้า จึงไม่ได้ถูกนับรวมในแผนตอนแรก
--
-- migration 001 รันอัตโนมัติตอนสร้าง volume ครั้งแรกเท่านั้น ไฟล์นี้ต้องรันเอง:
--   docker exec -i duritrack-postgres psql -U duritrack -d duritrack < migrations/002_farm_requests.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- role ใหม่: manager (ผู้จัดการสวน/เจ้าของสวนที่ได้รับอนุมัติแล้ว)
-- ---------------------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'manager', 'admin'));

-- ฟาร์มที่ผู้ใช้คนนี้ดูแลอยู่ (ตั้งตอนแอดมินอนุมัติคำขอ)
ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_farm_id text
  REFERENCES farms (id) ON DELETE SET NULL;

-- เจ้าของ/ผู้ดูแลฟาร์ม -- อีกด้านของความสัมพันธ์เดียวกัน
-- ไม่ใส่ FK กลับไปที่ users เพราะฟาร์มที่ seed มาไม่มีเจ้าของ และการลบผู้ใช้
-- ไม่ควรลบฟาร์มทิ้ง
ALTER TABLE farms ADD COLUMN IF NOT EXISTS manager_id text;

CREATE INDEX IF NOT EXISTS farms_manager_id_idx ON farms (manager_id);
CREATE INDEX IF NOT EXISTS users_managed_farm_id_idx ON users (managed_farm_id);


-- ---------------------------------------------------------------------------
-- farm_requests : คำขอขึ้นทะเบียนสวน / ขอสิทธิ์ผู้จัดการ / ขอแก้ไขข้อมูลสวน
--
-- ฟิลด์ที่เป็นค่าเดี่ยวแตกเป็นคอลัมน์จริง ส่วนที่ซ้อนกันเก็บเป็น jsonb
-- เพราะเป็นข้อมูลที่แค่พกไปแสดงในหน้าอนุมัติ ไม่เคยถูกใช้กรองหรือ join
-- (ต่างจากตาราง farms ที่ทุกฟิลด์ถูกค้นและเรียงลำดับจริง จึงแตกเป็นคอลัมน์หมด)
--
-- ไฟล์แนบ (ใบรับรอง, บัตรประชาชน, รูปบรรยากาศสวน) เก็บเป็น base64 data URI
-- ตามรูปแบบเดิมของแอป ซึ่งอาจมีขนาดหลายร้อย KB ต่อรายการ
-- Postgres จะ TOAST + บีบอัดให้เอง
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farm_requests (
  id                    text PRIMARY KEY,

  -- ประเภทคำขอ
  request_category      text CHECK (request_category IN ('manager_application', 'farm_verification')),
  request_type          text CHECK (request_type IN ('new_farm', 'update_farm')),
  target_farm_id        text REFERENCES farms (id) ON DELETE SET NULL,
  update_notes          text,

  -- ผู้ยื่นคำขอ
  -- ไม่ใส่ FK ไป users เพราะข้อมูลเดิมจาก Firestore อาจอ้าง uid ที่ไม่มีในระบบใหม่
  -- (บัญชีเดิมย้ายมาไม่ได้ เพราะรหัสผ่าน SHA-256 แปลงเป็น bcrypt ไม่ได้)
  user_id               text NOT NULL,
  user_display_name     text,
  user_email_or_username text,

  -- ข้อมูลสวน
  farm_name             text NOT NULL,
  farm_name_en          text,
  province              text NOT NULL,
  district              text,
  location_address      text,
  area_rai              numeric(10, 2),
  total_trees_estimate  integer,
  top_varieties         text[] NOT NULL DEFAULT '{}',
  about_story           text,

  -- ใบรับรองมาตรฐาน
  gap_cert_number       text,
  cert_issued_by        text,
  cert_valid_until      text,
  cert_document_photo   text,
  other_certs           text[] NOT NULL DEFAULT '{}',

  -- ตัวตนเจ้าของสวน
  farmer_full_name      text,
  farmer_id_card_number text,
  farmer_id_card_photo  text,
  farmer_id_card_file_type text CHECK (farmer_id_card_file_type IN ('image', 'pdf')),
  agreed_to_criteria    boolean NOT NULL DEFAULT false,

  -- พิกัดแปลง
  google_maps_url       text,

  has_smart_farm        boolean NOT NULL DEFAULT false,

  -- โครงสร้างซ้อน: contact, certificationList, smartTechnologies,
  -- atmospherePhotos, coordinates
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- สถานะการอนุมัติ
  status                text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  admin_notes           text,
  previous_admin_notes  text,
  reviewed_by           text,
  reviewed_at           timestamptz,
  resubmitted_at        timestamptz,
  created_farm_id       text REFERENCES farms (id) ON DELETE SET NULL,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS farm_requests_user_id_idx  ON farm_requests (user_id);
CREATE INDEX IF NOT EXISTS farm_requests_status_idx   ON farm_requests (status);
CREATE INDEX IF NOT EXISTS farm_requests_category_idx ON farm_requests (request_category);
CREATE INDEX IF NOT EXISTS farm_requests_created_idx  ON farm_requests (created_at DESC);

DROP TRIGGER IF EXISTS farm_requests_set_updated_at ON farm_requests;
CREATE TRIGGER farm_requests_set_updated_at
  BEFORE UPDATE ON farm_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
