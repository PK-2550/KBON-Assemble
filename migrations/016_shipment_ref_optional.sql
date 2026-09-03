-- ============================================================================
-- 016  ผ่อนกฎ shipment_ref ให้ใบรับรองระดับการขนส่งรายเที่ยวใช้งานได้จริง
--
-- 005 ตั้งกฎไว้สองข้อบน trigger ของ certifications
--
--   1. tier = shipment  ต้องมี shipment_ref
--   2. tier <> shipment ห้ามมี shipment_ref
--
-- ข้อ 1 ทำให้ใบ PHYTO ใช้ไม่ได้เลยมาตลอด ระบบยังไม่มีตารางเที่ยวขนส่ง
-- จึงไม่มีค่าอะไรให้ใส่ ผลคือประเภท PHYTO ถูกกรองออกจากฟอร์มไปเลย
-- (certificationTypes.ts) และไม่มีใครเลือกได้เลยตั้งแต่ 005
--
-- และถ้าปล่อยไว้แล้วเปิดให้เลือก ผู้ใช้ที่เลือก PHYTO แล้วไม่กรอกเลขที่ใบขนส่ง
-- จะทำให้ trigger โยน exception ซึ่งกลายเป็น 500 ที่ไม่บอกสาเหตุอะไรเลย
--
-- กฎแบบ "ต้องกรอกช่องนี้" ควรอยู่ที่ฟอร์ม ซึ่งบอกผู้ใช้ได้ว่าต้องทำอะไร
-- ไม่ใช่ที่ฐานข้อมูล ซึ่งบอกได้แค่ว่าพัง จึงยกเลิกข้อ 1
--
-- ข้อ 2 คงไว้ เพราะเป็นค่าคงตัวจริงที่ต้องไม่ถูกละเมิด ใบของสวนหรือของ
-- โรงคัดบรรจุไม่ควรมีเลขที่เที่ยวขนส่งติดมาด้วย ถ้าหลุดมาได้แปลว่ามีบั๊ก
-- ที่ชั้นเขียน ไม่ใช่ผู้ใช้กรอกไม่ครบ
--
-- ปลอดภัยกับฐานที่ใช้งานอยู่ ตรวจแล้วไม่มีแถว tier = shipment สักแถว
-- (certifications ทั้งหมดเป็น tier farm) การเปลี่ยน trigger จึงไม่กระทบ
-- ข้อมูลเดิม และเป็นการผ่อนกฎ ไม่ใช่เพิ่มกฎ แถวที่ผ่านอยู่แล้วยังผ่านทั้งหมด
-- ============================================================================

BEGIN;

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

  -- เดิมมีเงื่อนไขบังคับว่า tier = shipment ต้องมี shipment_ref อยู่ตรงนี้
  -- ยกเลิกไปใน 016 เหตุผลอยู่ในหัวไฟล์

  IF actual_tier <> 'shipment' AND NEW.shipment_ref IS NOT NULL THEN
    RAISE EXCEPTION 'shipment_ref ใช้ได้เฉพาะใบรับรองระดับการขนส่งรายเที่ยวเท่านั้น';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
