-- DuriTrack : ย้ายจาก Firestore มาเป็น PostgreSQL
-- โครงสร้างเดิมใน Firestore เป็น nested document 3 ชั้น (farm -> individualTrees[] -> reviews[])
-- ไฟล์นี้แตกออกเป็นตารางจริงที่มี foreign key และ cascade delete
--
-- หมายเหตุเรื่องชนิดข้อมูล:
--   * id ของ farms / trees เก็บเป็น text ไม่ใช่ uuid โดยตั้งใจ
--     เพราะ trees.code (เช่น 'VK-MT-001') ถูกพิมพ์อยู่บนแท็ก NFC จริงที่ติดขั้วผลไปแล้ว
--     ถ้าเปลี่ยน id ของที่ติดไปแล้วจะสแกนไม่เจอ และการเทียบข้อมูลกับ Firestore จะยากขึ้นมาก
--   * ฟิลด์วันที่หลายตัว (planted_date, last_fertilized, expected_harvest, review_date)
--     เก็บเป็น text เพราะข้อมูลเดิมเป็นข้อความไทยรูปแบบผสม เช่น '15 พ.ค. 2553 (2010)',
--     'มิถุนายน - กรกฎาคม' ซึ่ง cast เป็น date ไม่ได้ การ cast ตอน import จะทำให้ข้อมูลตกหล่น
--     ถ้าต้องการเรียงลำดับตามเวลาจริง ให้ใช้คอลัมน์ created_at แทน

BEGIN;

-- ---------------------------------------------------------------------------
-- trigger กลางสำหรับอัปเดต updated_at อัตโนมัติ
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- users : ยุบ /accounts + /users ของ Firestore เข้าด้วยกัน
--
-- Firestore ต้องแยกสอง collection เพราะไม่มี unique index จริง เลยต้องเอา username
-- ไปแปลงเป็น document id (ฟังก์ชัน normalizeUsernameKey ที่แปลงเป็น hex)
-- Postgres มี UNIQUE constraint อยู่แล้ว จึงไม่ต้องแยกตารางและตัดโค้ดแปลง hex ทิ้งได้
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             text PRIMARY KEY,
  username       text        NOT NULL,
  username_lower text        NOT NULL UNIQUE,
  email          text        UNIQUE,
  display_name   text,
  photo_url      text,
  role           text        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  provider       text        NOT NULL DEFAULT 'username'
                             CHECK (provider IN ('username', 'google', 'password', 'guest')),
  -- bcrypt hash. เป็น NULL ได้ 2 กรณี:
  --   1) บัญชีที่ย้ายมาจาก Firestore (ของเดิมเป็น SHA-256 ซึ่งแปลงเป็น bcrypt ไม่ได้
  --      เพราะเป็น one-way hash) -> ต้องตั้งรหัสใหม่ตอน login ครั้งแรก
  --   2) บัญชีที่ล็อกอินผ่าน OAuth ในอนาคต
  password_hash  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- farms
--
-- SocialContact ถูกแบนออกมาเป็นคอลัมน์ contact_* เพราะเป็นความสัมพันธ์ 1:1
-- ส่วน array ของ string ล้วน (top_varieties, certifications, photos) ใช้ text[]
-- ซึ่ง query ได้ด้วย ANY() / && โดยไม่ต้องแตกเป็นตารางย่อย
--
-- ตัวเลขสถิติ (rating, review_count, total_trees, harvested_fruits) เก็บเป็นคอลัมน์
-- ไม่ได้คำนวณจากตาราง reviews โดยตั้งใจ เพราะข้อมูลจริงไม่สอดคล้องกัน
-- (เช่น farm-01 มี review_count = 1420 แต่มีรีวิวในระบบไม่กี่รายการ)
-- ตัวเลขพวกนี้เป็นข้อมูลบรรณาธิการ ไม่ใช่ค่าที่ derive มาจากรีวิว
-- ---------------------------------------------------------------------------
CREATE TABLE farms (
  id                text PRIMARY KEY,
  rank              integer     NOT NULL DEFAULT 99,
  name              text        NOT NULL,
  name_en           text,
  province          text        NOT NULL,
  district          text,

  varieties_count   integer     NOT NULL DEFAULT 0,
  top_varieties     text[]      NOT NULL DEFAULT '{}',
  total_trees       integer     NOT NULL DEFAULT 0,
  harvested_fruits  integer     NOT NULL DEFAULT 0,
  rating            numeric(3, 1) NOT NULL DEFAULT 0,
  review_count      integer     NOT NULL DEFAULT 0,

  logo_bg_color     text,
  logo_text_color   text,
  established_year  integer,
  certifications    text[]      NOT NULL DEFAULT '{}',
  photos            text[]      NOT NULL DEFAULT '{}',
  highlight         text,
  about_story       text,

  contact_facebook  text,
  contact_instagram text,
  contact_line_id   text,
  contact_phone     text,
  contact_website   text,
  contact_address   text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- index ตามรูปแบบ query จริงใน App.tsx (filter จังหวัด + sort 5 แบบ)
CREATE INDEX farms_province_idx         ON farms (province);
CREATE INDEX farms_rank_idx             ON farms (rank);
CREATE INDEX farms_harvested_fruits_idx ON farms (harvested_fruits DESC);
CREATE INDEX farms_total_trees_idx      ON farms (total_trees DESC);
CREATE INDEX farms_rating_idx           ON farms (rating DESC);

CREATE TRIGGER farms_set_updated_at
  BEFORE UPDATE ON farms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- farm_certifications : CertificationDetail[]
-- แยกเป็นตารางแทน jsonb เพราะมีโครงสร้างชัดเจนและมี flag verified ที่ต้อง query
-- ---------------------------------------------------------------------------
CREATE TABLE farm_certifications (
  id          bigserial PRIMARY KEY,
  farm_id     text    NOT NULL REFERENCES farms (id) ON DELETE CASCADE,
  name        text    NOT NULL,
  name_th     text,
  short_code  text,
  cert_number text,
  issued_by   text,
  valid_until text,
  verified    boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,

  -- ไฟล์ใบรับรองที่ผู้ใช้อัปโหลด
  -- ข้อมูลเดิมใน Firestore เก็บรูปเป็น base64 data URI ฝังในเอกสารเลย
  -- (ไม่ได้ใช้ Firebase Storage) จึงยกมาเป็น text ตรง ๆ เพื่อไม่ให้ข้อมูลตกหล่น
  -- Postgres จะ TOAST + บีบอัดให้อัตโนมัติ ปริมาณจริงตอนนี้ 7 ไฟล์ รวม ~0.9 MB
  --
  -- ระยะยาวควรย้ายไปเก็บเป็นไฟล์จริงแล้วเก็บแค่ path แต่ยังไม่จำเป็นตอนนี้
  file_name      text,
  file_type      text,
  document_photo text
);

CREATE INDEX farm_certifications_farm_id_idx ON farm_certifications (farm_id);


-- ---------------------------------------------------------------------------
-- farm_smart_technologies : SmartTechItem[]
-- แยกเป็นตารางเพราะมี flag active ที่แอดมินน่าจะแก้รายรายการ
-- ---------------------------------------------------------------------------
CREATE TABLE farm_smart_technologies (
  id         text    PRIMARY KEY,
  farm_id    text    NOT NULL REFERENCES farms (id) ON DELETE CASCADE,
  name       text    NOT NULL,
  subtext    text,
  icon_emoji text,
  active     boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX farm_smart_technologies_farm_id_idx ON farm_smart_technologies (farm_id);


-- ---------------------------------------------------------------------------
-- tree_varieties : FruitTreeVariety[] (สถิติระดับสายพันธุ์ของแต่ละฟาร์ม)
-- คนละอย่างกับตาราง trees ซึ่งเป็นต้นไม้รายต้น
-- ---------------------------------------------------------------------------
CREATE TABLE tree_varieties (
  id               text PRIMARY KEY,
  farm_id          text NOT NULL REFERENCES farms (id) ON DELETE CASCADE,
  name             text NOT NULL,
  name_en          text,
  category         text NOT NULL DEFAULT 'durian_main'
                        CHECK (category IN ('durian_main', 'durian_rare', 'companion_fruit')),
  category_label   text,
  tag              text,
  avg_weight_kg    numeric(6, 2) NOT NULL DEFAULT 0,
  yield_per_tree   integer       NOT NULL DEFAULT 0,
  total_trees_count integer      NOT NULL DEFAULT 0,
  rating           numeric(3, 1) NOT NULL DEFAULT 0,
  reviews_count    integer       NOT NULL DEFAULT 0,
  sweetness_brix   numeric(4, 1),
  taste_profile    text,
  harvest_season   text,
  sort_order       integer       NOT NULL DEFAULT 0
);

CREATE INDEX tree_varieties_farm_id_idx ON tree_varieties (farm_id);


-- ---------------------------------------------------------------------------
-- trees : แตกออกจาก farms.individualTrees[]
--
-- ★ code เป็น UNIQUE เพราะเป็นรหัสที่พิมพ์บนแท็ก NFC จริง และ query จากการสแกน
--   ใช้ code เป็นตัวค้นหลัก (ไม่ใช่ id)
-- ---------------------------------------------------------------------------
CREATE TABLE trees (
  id                text PRIMARY KEY,
  farm_id           text NOT NULL REFERENCES farms (id) ON DELETE CASCADE,
  code              text NOT NULL UNIQUE,
  name              text NOT NULL,
  variety           text NOT NULL,
  category          text NOT NULL DEFAULT 'durian_main'
                         CHECK (category IN ('durian_main', 'durian_rare', 'companion_fruit')),
  category_label    text,
  badge             text,

  propagation_type  text NOT NULL DEFAULT 'grafted'
                         CHECK (propagation_type IN ('grafted', 'cutting', 'seedling', 'layering')),
  propagation_label text,
  propagation_code  text CHECK (propagation_code IN ('AUTO', 'PHOTO', 'GRAFT', 'ORGANIC', 'EXP')),

  zone              text,
  planted_date      text,
  age_years         integer       NOT NULL DEFAULT 0,

  yield_fruit_count integer       NOT NULL DEFAULT 0,
  yield_weight_kg   numeric(8, 2) NOT NULL DEFAULT 0,
  diaries_count     integer       NOT NULL DEFAULT 0,
  rating            numeric(3, 1) NOT NULL DEFAULT 0,
  review_count      integer       NOT NULL DEFAULT 0,

  health_status     text NOT NULL DEFAULT 'good'
                         CHECK (health_status IN ('excellent', 'good', 'monitoring')),
  sweetness_brix    numeric(4, 1),
  last_watered      text,
  last_fertilized   text,
  expected_harvest  text,
  notes             text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trees_farm_id_idx ON trees (farm_id);

CREATE TRIGGER trees_set_updated_at
  BEFORE UPDATE ON trees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- reviews : รวมสองแหล่งเข้าด้วยกัน
--   1) trees.reviews[] ที่ฝังอยู่ในเอกสารฟาร์ม
--   2) collection /reviews ที่แยกอยู่ต่างหาก
--
-- tree_code ถูก denormalize เก็บซ้ำไว้ เพราะ query ที่ใช้จริงใน TreeDetailModal
-- ค้นด้วย treeCode ตรง ๆ และรีวิวจาก /reviews บางรายการอาจอ้าง treeCode
-- ที่ยังไม่มีต้นไม้รองรับ -> tree_id จึงเป็น NULL ได้ เพื่อไม่ให้ import ตกหล่น
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id              text REFERENCES trees (id) ON DELETE CASCADE,
  tree_code            text NOT NULL,
  farm_id              text REFERENCES farms (id) ON DELETE CASCADE,

  author_name          text NOT NULL,
  rating               numeric(3, 1) NOT NULL DEFAULT 0,
  comment              text NOT NULL,

  nfc_fruit_tag        text,
  nfc_fruit_weight_kg  numeric(6, 2),
  verified_nfc         boolean NOT NULL DEFAULT false,
  tasting_notes        text[]  NOT NULL DEFAULT '{}',
  fruit_photo          text,
  avatar_url           text,

  review_date          text,
  created_at           timestamptz NOT NULL DEFAULT now(),

  -- เก็บ id เดิมจาก Firestore ไว้ให้สคริปต์ verify เทียบได้แบบ 1:1
  -- และกัน import ซ้ำถ้าต้องรันสคริปต์ใหม่
  source_id            text UNIQUE
);

CREATE INDEX reviews_tree_code_idx ON reviews (tree_code);
CREATE INDEX reviews_tree_id_idx   ON reviews (tree_id);
CREATE INDEX reviews_farm_id_idx   ON reviews (farm_id);

COMMIT;
