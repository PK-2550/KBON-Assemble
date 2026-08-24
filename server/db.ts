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

export async function assertDbReady() {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN
       ('farms','trees','reviews','users','tree_varieties','farm_certifications','farm_smart_technologies')`
  );
  if (rows[0].n < 7) {
    throw new Error(
      `พบตารางแค่ ${rows[0].n} จาก 7 ตาราง -- ฐานข้อมูลยังไม่ได้ตั้งค่า\n` +
        '   ลองรัน: docker compose up -d'
    );
  }
}
