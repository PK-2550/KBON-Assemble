-- ============================================================================
-- 017  เปิดให้ provider เป็น 'facebook' ได้
--
-- 001 ตั้ง CHECK ของคอลัมน์ provider ไว้เป็น
--   ('username', 'google', 'password', 'guest')
-- ตอนนั้นยังไม่มีการเข้าสู่ระบบด้วย Facebook จึงไม่มีค่านี้อยู่ในรายการ
--
-- ผลคือถ้าไม่แก้ก่อน การสมัครผ่าน Facebook จะ INSERT ไม่ผ่านตั้งแต่แถวแรก
-- และ error ที่ได้จะเป็น constraint violation ระดับฐานข้อมูล ซึ่งบอกผู้ใช้
-- ไม่ได้ว่าเกิดอะไรขึ้น
--
-- คงค่าเดิมทั้งหมดไว้ เพิ่ม 'facebook' เข้าไปอย่างเดียว บัญชีที่มีอยู่แล้ว
-- จึงไม่ได้รับผลกระทบ
--
-- หมายเหตุสำหรับฐานข้อมูลที่รันอยู่แล้ว
--   docker-compose map โฟลเดอร์ migrations เข้า /docker-entrypoint-initdb.d
--   ซึ่ง Postgres รันให้ "เฉพาะตอนสร้าง volume ครั้งแรก" เท่านั้น
--   ฐานเดิมที่มีข้อมูลอยู่แล้วต้องรันไฟล์นี้เองหนึ่งครั้ง เช่น
--     docker compose exec -T postgres psql -U duritrack -d duritrack \
--       < migrations/017_facebook_provider.sql
-- ============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_provider_check;

ALTER TABLE users
  ADD CONSTRAINT users_provider_check
  CHECK (provider IN ('username', 'google', 'facebook', 'password', 'guest'));
