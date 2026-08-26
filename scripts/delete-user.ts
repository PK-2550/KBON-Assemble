/**
 * ลบบัญชีผู้ใช้ออกจากระบบ
 *
 *   npm run delete-user -- ชื่อผู้ใช้            ดูว่าจะกระทบอะไรบ้าง ยังไม่ลบ
 *   npm run delete-user -- ชื่อผู้ใช้ --confirm  ลบจริง
 *
 * แสดงผลกระทบให้ดูก่อนเสมอ เพราะบัญชีอาจผูกกับฟาร์มหรือคำขอสมัครอยู่
 */

import 'dotenv/config';
import { pool } from '../server/db.js';

async function main() {
  const username = process.argv[2];
  const confirmed = process.argv.includes('--confirm');

  if (!username || username.startsWith('--')) {
    console.error('ระบุชื่อผู้ใช้ที่ต้องการลบ');
    console.error('  npm run delete-user -- ชื่อผู้ใช้');
    process.exit(1);
  }

  const lower = username.trim().toLowerCase();
  const { rows } = await pool.query<{
    id: string;
    username: string;
    role: string;
    managed_farm_id: string | null;
  }>(
    'SELECT id, username, role, managed_farm_id FROM users WHERE username_lower = $1',
    [lower]
  );

  if (rows.length === 0) {
    console.error(`ไม่พบบัญชี ${username}`);
    process.exit(1);
  }

  const user = rows[0];

  const [farms, requests] = await Promise.all([
    pool.query('SELECT id, name FROM farms WHERE manager_id = $1', [user.id]),
    pool.query('SELECT id, status FROM farm_requests WHERE user_id = $1', [user.id]),
  ]);

  console.log(`\nบัญชี ${user.username}  สิทธิ์ ${user.role}`);
  console.log(`  ฟาร์มที่ดูแลอยู่   ${farms.rowCount}`);
  farms.rows.forEach((f: { id: string; name: string }) => console.log(`    - ${f.name} (${f.id})`));
  console.log(`  คำขอสมัครฟาร์ม   ${requests.rowCount}`);
  // ตาราง reviews เก็บแค่ author_name ไม่ได้อ้างถึง users.id
  // รีวิวจึงไม่หายตามบัญชี แต่จะค้างอยู่ในชื่อเดิม
  const reviews = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM reviews WHERE author_name = $1',
    [user.username]
  );
  console.log(`  รีวิวในชื่อนี้    ${reviews.rows[0].n}  (จะคงอยู่หลังลบบัญชี)`);

  if (user.role === 'admin') {
    const { rows: admins } = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM users WHERE role = 'admin'"
    );
    if (admins[0].n <= 1) {
      console.error('\nนี่เป็นบัญชี admin คนสุดท้าย ลบแล้วจะไม่มีใครเข้าศูนย์อนุมัติได้');
      console.error('สร้าง admin คนใหม่ก่อน (npm run make-admin -- ชื่อผู้ใช้) แล้วค่อยลบบัญชีนี้');
      process.exit(1);
    }
  }

  if (!confirmed) {
    console.log('\nยังไม่ได้ลบอะไร ถ้าต้องการลบจริงให้ใส่ --confirm');
    console.log(`  npm run delete-user -- ${username} --confirm`);
    await pool.end();
    return;
  }

  // ฟาร์มที่บัญชีนี้ดูแลจะไม่ถูกลบตาม แค่ตัดผู้ดูแลออก
  // ข้อมูลฟาร์มและต้นไม้เป็นของสวน ไม่ใช่ของบัญชี
  await pool.query('UPDATE farms SET manager_id = NULL WHERE manager_id = $1', [user.id]);
  await pool.query('UPDATE users SET managed_farm_id = NULL WHERE id = $1', [user.id]);
  await pool.query('DELETE FROM farm_requests WHERE user_id = $1', [user.id]);
  await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

  console.log(`\nลบบัญชี ${user.username} เรียบร้อย`);
  if (farms.rowCount) {
    console.log(`ฟาร์ม ${farms.rowCount} แห่งยังอยู่ แต่ตอนนี้ไม่มีผู้ดูแล`);
  }
  if (requests.rowCount) {
    console.log(`คำขอสมัคร ${requests.rowCount} รายการถูกลบไปด้วย`);
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error('ล้มเหลว:', err instanceof Error ? err.message : err);
  await pool.end().catch(() => {});
  process.exit(1);
});
