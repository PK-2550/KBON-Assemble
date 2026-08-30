import pg from 'pg';
import 'dotenv/config';

const { Pool, types } = pg;

/**
 * pg คืนค่า numeric และ bigint มาเป็น string โดยปริยาย เพราะกันค่าเกินช่วง
 * ที่ JS number เก็บได้ แต่ในแอปนี้ค่าที่ใช้เป็นคะแนนรีวิว น้ำหนัก และจำนวนนับ
 * ซึ่งเล็กมาก และฝั่ง frontend เรียก .toFixed() กับค่าพวกนี้ตรง ๆ
 * ถ้าปล่อยเป็น string จะพังทันที จึงแปลงเป็น number ตั้งแต่ชั้น driver
 */
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : Number(v)));

if (!process.env.DATABASE_URL) {
  console.error('ไม่พบ DATABASE_URL -- ตรวจว่ามีไฟล์ .env อยู่หรือยัง (ดู .env.example)');
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on('error', (err) => {
  console.error('เกิดข้อผิดพลาดกับ connection pool ของ Postgres:', err.message);
});

/**
 * ตารางที่เซิร์ฟเวอร์ต้องมีจริงถึงจะทำงานได้
 *
 * เดิมลิสต์นี้มี farm_certifications ซึ่งเป็นตารางใบรับรองชุดเก่า
 * โค้ดเลิกอ่านเลิกเขียนไปแล้ว และ 007 จะลบทิ้ง ถ้าไม่แก้ก่อน
 * เซิร์ฟเวอร์จะสตาร์ทไม่ขึ้นทันทีที่รัน 007
 *
 * ใบรับรองชุดใหม่กระจายอยู่สี่ตารางซึ่ง loadFarms join ถึงทั้งหมด
 * ขาดตัวใดตัวหนึ่งก็พังตอนเรียกใช้จริงอยู่ดี จึงตรวจให้ครบตั้งแต่ตอนสตาร์ท
 * จะได้รู้ตั้งแต่แรก แทนที่จะไปพังตอนมีคนเปิดหน้าเว็บ
 */
const REQUIRED_TABLES = [
  'farms',
  'trees',
  'reviews',
  'users',
  'tree_varieties',
  'farm_smart_technologies',
  'certifications',
  'certification_types',
  'regional_certifications',
  'farm_regional_certifications',
];

export async function assertDbReady() {
  const { rows } = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [REQUIRED_TABLES]
  );

  // บอกชื่อตารางที่ขาดไปเลย ของเดิมบอกแค่จำนวนซึ่งไม่ช่วยให้รู้ว่าต้องแก้อะไร
  const found = new Set(rows.map((r) => r.table_name));
  const missing = REQUIRED_TABLES.filter((t) => !found.has(t));

  if (missing.length > 0) {
    throw new Error(
      `ฐานข้อมูลยังไม่ได้ตั้งค่า ขาดตาราง ${missing.length} จาก ${REQUIRED_TABLES.length} ตาราง\n` +
        `   ที่ขาด: ${missing.join(', ')}\n` +
        '   ลองรัน: docker compose up -d'
    );
  }
}
