import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import {
  signToken, setAuthCookie, clearAuthCookie, requireAuth, type TokenPayload,
} from '../middleware/auth.js';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  role: 'user' | 'admin';
  provider: string;
  password_hash: string | null;
  created_at: Date;
  last_login_at: Date | null;
}

/** รูปร่างที่ frontend ใช้ (AppUserProfile) */
function toProfile(u: UserRow) {
  return {
    uid: u.id,
    username: u.username,
    email: u.email,
    displayName: u.display_name ?? u.username,
    photoURL: u.photo_url,
    role: u.role,
    provider: u.provider,
    createdAt: u.created_at?.toISOString?.() ?? null,
    lastLoginAt: u.last_login_at?.toISOString?.() ?? null,
  };
}

function validateCredentials(username: unknown, password: unknown): string | null {
  if (typeof username !== 'string' || !username.trim()) {
    return 'กรุณากรอกชื่อผู้ใช้งาน (Username)';
  }
  if (username.trim().length < 3) {
    return 'ชื่อผู้ใช้งานต้องมีความยาวอย่างน้อย 3 ตัวอักษร';
  }
  if (typeof password !== 'string' || !password) {
    return 'กรุณากรอกรหัสผ่าน (Password)';
  }
  if (password.length < 6) {
    return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรขึ้นไป';
  }
  return null;
}

/**
 * สมัครสมาชิก
 *
 * ไม่ล็อกอินให้อัตโนมัติ เพื่อคงพฤติกรรมเดิมของแอป (commit aec4eff)
 * ผู้ใช้ต้องกรอกรหัสผ่านอีกครั้งที่หน้า login
 */
authRouter.post('/register', asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  const invalid = validateCredentials(username, password);
  if (invalid) return res.status(400).json({ error: invalid });

  const clean = (username as string).trim();
  const lower = clean.toLowerCase();

  const existing = await pool.query('SELECT 1 FROM users WHERE username_lower = $1', [lower]);
  if (existing.rowCount && existing.rowCount > 0) {
    return res.status(409).json({
      error: 'ชื่อผู้ใช้งาน (Username) นี้ถูกลงทะเบียนไว้แล้ว กรุณาเลือกชื่ออื่น หรือเข้าสู่ระบบ',
    });
  }

  // แฮชฝั่ง server เท่านั้น รหัสผ่านดิบไม่เคยถูกเก็บและไม่เคยออกจาก request นี้
  const passwordHash = await bcrypt.hash(password as string, BCRYPT_ROUNDS);
  const uid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (id, username, username_lower, email, display_name, role, provider, password_hash)
     VALUES ($1, $2, $3, $4, $5, 'user', 'username', $6)
     RETURNING *`,
    [uid, clean, lower, clean.includes('@') ? lower : null, clean, passwordHash]
  );

  res.status(201).json({ profile: toProfile(rows[0]) });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' });
  }

  const lower = username.trim().toLowerCase();
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE username_lower = $1',
    [lower]
  );
  const user = rows[0];

  // ข้อความ error เหมือนกันทุกกรณี ไม่บอกว่า "ไม่มีผู้ใช้นี้" หรือ "รหัสผิด"
  // เพื่อไม่ให้ใครเดาได้ว่ามี username ไหนอยู่ในระบบบ้าง
  const invalidMessage =
    'ชื่อผู้ใช้งาน (User) หรือรหัสผ่าน (Password) ไม่ถูกต้อง อาจมีการกรอกผิด กรุณาตรวจสอบอีกครั้ง';

  if (!user) {
    // เสียเวลาแฮชทิ้งให้พอ ๆ กับกรณีที่เจอผู้ใช้ กัน timing attack
    await bcrypt.hash(password, BCRYPT_ROUNDS);
    return res.status(401).json({ error: invalidMessage });
  }

  if (!user.password_hash) {
    return res.status(409).json({
      error: 'บัญชีนี้ยังไม่ได้ตั้งรหัสผ่านในระบบใหม่ กรุณาสมัครใหม่อีกครั้ง',
    });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: invalidMessage });

  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

  const payload: TokenPayload = { uid: user.id, username: user.username, role: user.role };
  setAuthCookie(res, signToken(payload));
  res.json({ profile: toProfile({ ...user, last_login_at: new Date() }) });
}));

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [req.user!.uid]);
  if (rows.length === 0) {
    // ผู้ใช้ถูกลบไปแล้วแต่ token ยังไม่หมดอายุ
    clearAuthCookie(res);
    return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้นี้แล้ว' });
  }
  res.json({ profile: toProfile(rows[0]) });
}));
