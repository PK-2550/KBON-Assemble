/**
 * ตั้งรหัสผ่านใหม่ให้บัญชีที่มีอยู่
 *
 *   npm run set-password -- ชื่อผู้ใช้
 *
 * รับรหัสผ่านทาง prompt แบบไม่แสดงตัวอักษร
 * เพื่อไม่ให้รหัสผ่านไปติดอยู่ใน shell history หรือใน argv ที่ process อื่นอ่านได้
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline';
import { pool } from '../server/db.js';

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 12;

/** อ่านบรรทัดโดยไม่ echo ตัวอักษรออกหน้าจอ */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(new Error('ต้องรันคำสั่งนี้ใน terminal จริง จึงจะซ่อนรหัสผ่านได้'));
      return;
    }

    const rl = createInterface({ input, output: process.stdout, terminal: true });

    // ระหว่างพิมพ์รหัสผ่าน ให้ readline เขียนเฉพาะตัวคำถาม ไม่เขียนสิ่งที่ผู้ใช้พิมพ์
    let silent = false;
    const originalWrite = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = function (s: string) {
      if (!silent) originalWrite.call(this, s);
    };

    rl.question(question, (answer) => {
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = originalWrite;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    silent = true;
  });
}

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('ระบุชื่อผู้ใช้ที่ต้องการตั้งรหัสผ่านใหม่');
    console.error('  npm run set-password -- ชื่อผู้ใช้');
    process.exit(1);
  }

  const lower = username.trim().toLowerCase();
  const { rows } = await pool.query<{ id: string; username: string; role: string }>(
    'SELECT id, username, role FROM users WHERE username_lower = $1',
    [lower]
  );

  if (rows.length === 0) {
    console.error(`ไม่พบบัญชี ${username}`);
    process.exit(1);
  }

  const user = rows[0];
  console.log(`บัญชี ${user.username}  สิทธิ์ ${user.role}`);

  const password = await promptHidden('รหัสผ่านใหม่: ');
  if (password.length < MIN_LENGTH) {
    console.error(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_LENGTH} ตัวอักษร`);
    process.exit(1);
  }

  const again = await promptHidden('พิมพ์อีกครั้ง: ');
  if (password !== again) {
    console.error('รหัสผ่านสองครั้งไม่ตรงกัน ยังไม่ได้เปลี่ยนอะไร');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);

  console.log(`ตั้งรหัสผ่านใหม่ให้ ${user.username} เรียบร้อย`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('ล้มเหลว:', err instanceof Error ? err.message : err);
  await pool.end().catch(() => {});
  process.exit(1);
});
