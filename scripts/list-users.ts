/**
 * แสดงบัญชีทั้งหมดในระบบ พร้อมสิทธิ์และสิ่งที่แต่ละบัญชีผูกอยู่
 *
 *   npm run list-users
 *
 * ไม่แสดงรหัสผ่านหรือแฮช แสดงแค่ว่าตั้งรหัสผ่านไว้แล้วหรือยัง
 */

import 'dotenv/config';
import { pool } from '../server/db.js';

interface Row {
  username: string;
  role: string;
  provider: string;
  has_password: boolean;
  last_login_at: Date | null;
  created_at: Date;
  farm_count: number;
}

function fmt(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '-';
}

async function main() {
  const { rows } = await pool.query<Row>(`
    SELECT u.username,
           u.role,
           u.provider,
           u.password_hash IS NOT NULL AS has_password,
           u.last_login_at,
           u.created_at,
           count(f.id)::int AS farm_count
      FROM users u
      LEFT JOIN farms f ON f.manager_id = u.id
     GROUP BY u.id
     ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, u.username
  `);

  if (rows.length === 0) {
    console.log('ยังไม่มีบัญชีในระบบ');
    await pool.end();
    return;
  }

  const w = Math.max(12, ...rows.map((r) => r.username.length));
  console.log(
    `\n${'ชื่อผู้ใช้'.padEnd(w)}  ${'สิทธิ์'.padEnd(8)}  ${'วิธีเข้า'.padEnd(10)}  รหัสผ่าน  ฟาร์ม  เข้าล่าสุด   สร้างเมื่อ`
  );
  console.log('-'.repeat(w + 60));

  for (const r of rows) {
    console.log(
      `${r.username.padEnd(w)}  ${r.role.padEnd(8)}  ${r.provider.padEnd(10)}  ` +
        `${(r.has_password ? 'ตั้งแล้ว' : 'ยังไม่ตั้ง').padEnd(8)}  ` +
        `${String(r.farm_count).padStart(4)}  ${fmt(r.last_login_at)}  ${fmt(r.created_at)}`
    );
  }

  console.log(`\nรวม ${rows.length} บัญชี`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('ล้มเหลว:', err instanceof Error ? err.message : err);
  await pool.end().catch(() => {});
  process.exit(1);
});
