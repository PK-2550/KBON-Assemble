-- ============================================================================
-- 014  ประเภทใบรับรองที่ฟอร์มเลือกได้จริง และคำขอใบระดับโซนที่รอแอดมินจับคู่
--
-- ฟอร์มยื่นคำขอใช้รายการตัวเลือกที่ฝังไว้ในโค้ดฝั่งหน้าเว็บ ซึ่งไม่เคยถูกทำให้
-- ตรงกับตาราง certification_types เลย ผลคือ
--
--   Q-Mark กับ ISO เลือกได้ในฟอร์ม แต่ไม่มีในฐาน จึงถูกบันทึกเป็น LEGACY_OTHER
--   ซึ่งแปลว่า อื่น ๆ ย้ายมาจากระบบเดิม ทั้งที่ผู้ใช้ระบุมาตรฐานมาชัดเจน
--
--   GMP กับ GACC มีในฐานตั้งแต่ 005 แต่ไม่มีในรายการ จึงเลือกไม่ได้เลย
--
-- 005 ออกแบบให้ตารางนี้เป็นตารางค้นหา เพิ่มประเภทใหม่คือ INSERT ไม่ต้องแก้ schema
-- ไฟล์นี้จึงเติมสองประเภทที่ขาด แล้วให้ฟอร์มไปดึงรายการจากที่นี่แทน
-- ============================================================================

BEGIN;

INSERT INTO certification_types (code, tier, name, name_th, sort_order) VALUES
  ('Q_MARK',   'farm', 'Q Mark',      'เครื่องหมายคุณภาพ Q มาตรฐานส่งออก', 7),
  ('ISO22000', 'farm', 'ISO 22000',   'มาตรฐานความปลอดภัยอาหาร ISO 22000', 8)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- คำขอใบรับรองระดับโซนที่ยังรอแอดมินจับคู่
--
-- ใบอย่าง GI เป็นของโซนภูมิศาสตร์ ไม่ใช่ของสวนรายตัว สวนหลายแห่งใช้ใบเดียวกัน
-- ตอนอนุมัติคำขอจึงเขียนลงตาราง certifications ไม่ได้ เพราะ trigger ปฏิเสธ
-- ใบระดับ regional และเพราะระบบไม่มีทางรู้เองว่าสวนนี้ควรอยู่โซนไหน
--
-- เดิมใบเหล่านี้ถูกข้ามทิ้งเงียบ ๆ ผู้ใช้กรอกครบ แอดมินกดอนุมัติ แล้วใบหายไป
-- โดยไม่มีใครรู้ ตารางนี้เก็บคำขอไว้ให้แอดมินมาจับคู่โซนทีหลัง
--
-- เก็บเลขที่ใบกับหน่วยงานที่ผู้ใช้กรอกมาไว้ด้วย แอดมินจะได้ใช้ตัดสินว่าตรงกับ
-- โซนไหน หรือควรสร้างโซนใหม่
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS regional_certification_requests (
  id                    bigserial   PRIMARY KEY,
  farm_id               text        NOT NULL REFERENCES farms (id) ON DELETE CASCADE,
  certification_type_id integer     NOT NULL REFERENCES certification_types (id),
  farm_request_id       text,
  cert_number           text,
  issuing_authority     text,
  status                text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'linked', 'rejected')),
  -- โซนที่แอดมินจับคู่ให้ ว่างไว้จนกว่าจะมีคนมาจัดการ
  regional_certification_id bigint  REFERENCES regional_certifications (id) ON DELETE SET NULL,
  admin_notes           text,
  resolved_by           text,
  resolved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),

  -- จับคู่แล้วต้องรู้ว่าคู่กับโซนไหน ยังไม่จับคู่ต้องไม่มีโซนติดมา
  CHECK (
    (status = 'linked' AND regional_certification_id IS NOT NULL) OR
    (status <> 'linked' AND regional_certification_id IS NULL)
  )
);

-- ใช้หาคำขอที่ยังค้างเพื่อเอาไปแสดงในศูนย์อนุมัติ
CREATE INDEX IF NOT EXISTS regional_certification_requests_pending_idx
  ON regional_certification_requests (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS regional_certification_requests_farm_idx
  ON regional_certification_requests (farm_id);

-- สวนหนึ่งมีคำขอที่ยังค้างได้ใบเดียวต่อประเภท
-- ยื่นแก้ไขคำขอซ้ำจึงไม่ทำให้เกิดคำขอค้างซ้อนกันหลายใบ
CREATE UNIQUE INDEX IF NOT EXISTS regional_certification_requests_one_pending_idx
  ON regional_certification_requests (farm_id, certification_type_id)
  WHERE status = 'pending';

COMMIT;
