-- ============================================================================
-- 013  บันทึกการล้างข้อมูลส่วนตัวตามกำหนดเวลาเก็บ
--
-- คำขอที่ถูกปฏิเสธจะถูกล้างข้อมูลส่วนตัวทิ้งหลังผ่านไป 90 วัน ตารางนี้เก็บว่า
-- ล้างของแถวไหน เมื่อไหร่ ล้างฟิลด์อะไรบ้าง เผื่อมีคนถามย้อนหลังว่าข้อมูล
-- หายไปไหน จะได้ตอบได้ว่าถูกล้างตามกำหนด ไม่ใช่หายเพราะบั๊ก
--
-- ไม่เก็บค่าที่ลบไปเด็ดขาด ถ้าเก็บก็เท่ากับย้ายข้อมูลอ่อนไหวมาไว้ที่นี่แทน
-- ซึ่งย้อนแย้งกับเหตุผลทั้งหมดของการล้าง เก็บแค่ชื่อฟิลด์
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS data_retention_log (
  id              bigserial   PRIMARY KEY,

  -- ไม่ผูก foreign key โดยตั้งใจ
  --
  -- แถวคำขอยังอยู่ในกรณีนี้ แต่ถ้าวันหนึ่งนโยบายเปลี่ยนไปเป็นลบทั้งแถว
  -- หรือแอดมินลบคำขอทิ้งเอง บันทึกว่าเคยล้างอะไรไปต้องไม่หายตามไปด้วย
  farm_request_id text        NOT NULL,

  fields_cleared  text[]      NOT NULL,

  -- วันที่ถูกปฏิเสธ เก็บไว้ให้ตรวจย้อนได้ว่านับ 90 วันจากตรงไหน
  rejected_at     timestamptz,
  purged_at       timestamptz NOT NULL DEFAULT now(),

  -- auto = ตัวตั้งเวลาของเซิร์ฟเวอร์  manual = คนสั่งรันสคริปต์เอง
  trigger_source  text        NOT NULL CHECK (trigger_source IN ('auto', 'manual'))
);

CREATE INDEX IF NOT EXISTS data_retention_log_request_idx
  ON data_retention_log (farm_request_id);

CREATE INDEX IF NOT EXISTS data_retention_log_purged_at_idx
  ON data_retention_log (purged_at DESC);

-- ใช้ค้นหาคำขอที่ถึงกำหนดล้าง เงื่อนไขตรงกับที่งานล้างใช้จริง
-- partial index เพราะแถวที่ไม่ใช่ rejected ไม่เคยถูกมองหาเลย
CREATE INDEX IF NOT EXISTS farm_requests_rejected_reviewed_at_idx
  ON farm_requests (reviewed_at)
  WHERE status = 'rejected';

COMMIT;
