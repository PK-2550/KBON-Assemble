-- ============================================================================
-- 010  เก็บตกใบรับรองที่ยังไม่มีคู่ในตาราง certifications
--
-- 005 ย้ายข้อมูลให้ครั้งเดียวตอนรัน แต่โค้ดยังเขียนตารางเก่าอย่างเดียวต่อมาอีก
-- ใบที่อนุมัติหลังจากนั้นจึงไปกองอยู่ตารางเก่า ไฟล์นี้เก็บตกใบเหล่านั้น
--
-- ต้นเหตุถูกแก้ที่โค้ดแล้วในก้อนเดียวกันนี้ ขาเขียนลงตารางใหม่ด้วยแล้ว
-- ไฟล์นี้จึงเป็นการตามเก็บของที่ค้างอยู่ ไม่ใช่วิธีแก้ถาวร
--
-- ใช้เกณฑ์จับคู่ประเภทชุดเดียวกับ 005 และเงื่อนไขกันซ้ำชุดเดียวกับที่
-- ชุดทดสอบ certifications-legacy-parity ใช้ตรวจ คือเทียบถึงระดับประเภท
-- และเลขที่ใบ ไม่ใช่แค่ว่าฟาร์มนี้มีใบอะไรสักใบในตารางใหม่
--
--   docker exec -i duritrack-postgres psql -U duritrack -d duritrack \
--     -f /dev/stdin < scripts/sql/010_backfill_missing_certs.sql
--
-- รันซ้ำได้ ไม่เกิดข้อมูลซ้ำ ไม่แตะตาราง farm_certifications
-- GI ไม่ถูกแตะที่นี่ ใบระดับภูมิภาคย้ายไปแล้วใน 009
-- ============================================================================

BEGIN;

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
  CASE WHEN fc.valid_until ~ '^\d{4}$' THEN make_date(fc.valid_until::int, 12, 31) END,
  CASE WHEN fc.valid_until ~ '^\d{4}$' THEN 'year' ELSE 'day' END,
  CASE WHEN fc.valid_until ~ '^\d{4}$' THEN NULL ELSE fc.valid_until END,
  fc.document_photo,
  fc.file_name,
  CASE WHEN fc.file_type IN ('image', 'pdf') THEN fc.file_type END,
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
        SELECT 1
          FROM certifications c
         WHERE c.farm_id = fc.farm_id
           AND c.certification_type_id = ct.id
           AND c.cert_number IS NOT DISTINCT FROM fc.cert_number
      );

-- ----------------------------------------------------------------------------
-- ยามท้ายสุด  ไม่เหลือใบที่ไม่ใช่ GI ที่ยังไม่มีคู่ ไม่งั้น rollback ทั้งก้อน
-- ----------------------------------------------------------------------------
DO $$
DECLARE n_left integer;
BEGIN
  SELECT count(*) INTO n_left
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

  IF n_left > 0 THEN
    RAISE EXCEPTION 'หยุด: เก็บตกไม่ครบ ยังเหลือใบรับรอง % แถวที่ไม่มีคู่', n_left;
  END IF;
END $$;

COMMIT;
