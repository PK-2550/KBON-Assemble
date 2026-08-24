/**
 * ตั้งสิทธิ์แอดมินให้บัญชีที่ระบุ
 *
 *   npm run make:admin -- <username>
 *   npm run make:admin -- --list
 *
 * ระบบเดิมให้ client เขียน role ลง Firestore เองได้ ใครก็ตั้งตัวเองเป็น admin ได้
 * ตอนนี้ role อยู่ใน JWT ที่เซ็นฝั่ง server เท่านั้น การเลื่อนสิทธิ์จึงต้องทำจากเครื่อง
 * ที่เข้าถึงฐานข้อมูลได้ ซึ่งก็คือสคริปต์นี้
 *
 * ต้องออกจากระบบแล้วเข้าใหม่หลังรัน เพราะ token เดิมยังถือ role เก่าอยู่
 */

import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  const args = process.argv.slice(2);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ไม่พบ DATABASE_URL -- ตรวจว่ามีไฟล์ .env อยู่หรือยัง');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  if (args.length === 0 || args[0] === '--list') {
    const { rows } = await client.query(
      'SELECT username, role, created_at FROM users ORDER BY created_at'
    );
    if (rows.length === 0) {
      console.log('ยังไม่มีบัญชีผู้ใช้ในระบบ -- สมัครผ่านหน้าเว็บก่อน');
    } else {
      console.log('บัญชีทั้งหมดในระบบ:');
      for (const r of rows) {
        console.log(`  ${r.role === 'admin' ? '[admin]' : '[user] '} ${r.username}`);
      }
    }
    if (args.length === 0) {
      console.log('\nวิธีตั้งแอดมิน: npm run make:admin -- <username>');
    }
    await client.end();
    return;
  }

  const username = args[0].trim().toLowerCase();
  const { rows } = await client.query(
    "UPDATE users SET role = 'admin' WHERE username_lower = $1 RETURNING username, role",
    [username]
  );

  if (rows.length === 0) {
    console.error(`ไม่พบบัญชีชื่อ "${args[0]}"`);
    console.error('ดูรายชื่อบัญชีทั้งหมดด้วย: npm run make:admin -- --list');
    await client.end();
    process.exit(1);
  }

  console.log(`ตั้ง "${rows[0].username}" เป็นแอดมินแล้ว`);
  console.log('ออกจากระบบแล้วเข้าใหม่เพื่อให้สิทธิ์มีผล (token เดิมยังถือ role เก่า)');
  await client.end();
}

main().catch((err) => {
  console.error('ล้มเหลว:', err);
  process.exit(1);
});
