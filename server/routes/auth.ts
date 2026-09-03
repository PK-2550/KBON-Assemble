import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { asyncHandler } from '../asyncHandler.js';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import {
  signToken, setAuthCookie, clearAuthCookie, requireAuth, type TokenPayload,
} from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;

/**
 * ยืนยัน ID token ของ Google Identity Services
 *
 * ใช้ flow แบบ ID token ปุ่มฝั่งเบราว์เซอร์ได้ credential (JWT) จาก Google มา
 * ส่งเข้ามา server เป็นคน verify แล้วออก cookie ของระบบเราเอง จึงไม่ต้องมี
 * client secret และไม่ต้อง redirect
 *
 * ตั้งค่าไม่ครบ (ไม่มี GOOGLE_CLIENT_ID) ก็ปล่อยเป็น null แล้วตอบ 503 ตอนถูกเรียก
 * เพื่อให้ระบบส่วนอื่นยังรันได้ตามปกติ (เช่นตอน dev ที่ยังไม่ได้ตั้งค่า OAuth)
 */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

/** สร้าง username ที่ไม่ชนของเดิม จากชื่อ/อีเมลของบัญชี Google */
async function uniqueUsername(base: string): Promise<string> {
  const clean = base.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 20) || 'user';
  let candidate = clean;
  for (let i = 0; i < 50; i++) {
    const { rowCount } = await pool.query('SELECT 1 FROM users WHERE username_lower = $1', [
      candidate.toLowerCase(),
    ]);
    if (!rowCount) return candidate;
    candidate = `${clean}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `${clean}_${Date.now().toString(36)}`;
}

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  role: 'user' | 'manager' | 'admin';
  provider: string;
  managed_farm_id: string | null;
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
    managedFarmId: u.managed_farm_id,
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
authRouter.post('/register', registerLimiter, asyncHandler(async (req, res) => {
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

authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
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
    // บัญชีที่เข้าด้วย provider อื่น ยังไม่มีรหัสรหัสผ่าน
    //
    // ตอบข้อความเดียวกับกรณีกรอกผิด พร้อมหน่วงเวลาทิ้งเท่ากัน
    // ถ้าตอบ 409 แยกออกมา คนนอกจะรู้ทันทีว่า username นี้มีอยู่จริง
    // ซึ่งลบล้างการกันเดา username ที่ทำไว้ข้างบนทั้งหมด
    await bcrypt.hash(password, BCRYPT_ROUNDS);
    return res.status(401).json({ error: invalidMessage });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: invalidMessage });

  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

  const payload: TokenPayload = { uid: user.id, username: user.username, role: user.role };
  setAuthCookie(res, signToken(payload));
  res.json({ profile: toProfile({ ...user, last_login_at: new Date() }) });
}));

authRouter.post('/google', loginLimiter, asyncHandler(async (req, res) => {
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'ยังไม่ได้เปิดใช้งานการเข้าสู่ระบบด้วย Google' });
  }

  const { credential } = req.body ?? {};
  if (typeof credential !== 'string' || !credential) {
    return res.status(400).json({ error: 'ไม่พบข้อมูลยืนยันตัวตนจาก Google' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'ยืนยันตัวตนกับ Google ไม่สำเร็จ' });
  }

  // ต้องเป็นอีเมลที่ Google ยืนยันแล้วเท่านั้น เพราะรอบนี้ผูกบัญชีจากอีเมล
  // ถ้ารับอีเมลที่ยังไม่ยืนยัน คนอื่นตั้งอีเมลใครก็ได้แล้วสวมบัญชีนั้นได้
  if (!payload?.email || payload.email_verified !== true) {
    return res.status(401).json({ error: 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล' });
  }

  const email = payload.email.toLowerCase();
  const name = payload.name || payload.email.split('@')[0];
  const picture = payload.picture ?? null;

  const existing = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);

  let user: UserRow;
  if (existing.rows.length > 0) {
    // ผูกกับบัญชีเดิมที่อีเมลตรงกัน เติมชื่อ/รูปเฉพาะช่องที่ยังว่างเท่านั้น
    // ไม่แตะ username และ password_hash เดิม เจ้าของยังเข้าด้วยรหัสผ่านได้เหมือนเดิม
    const { rows } = await pool.query<UserRow>(
      `UPDATE users
          SET last_login_at = now(),
              display_name  = COALESCE(display_name, $2),
              photo_url     = COALESCE(photo_url, $3),
              updated_at    = now()
        WHERE id = $1
        RETURNING *`,
      [existing.rows[0].id, name, picture]
    );
    user = rows[0];
  } else {
    const username = await uniqueUsername(name);
    const uid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users
         (id, username, username_lower, email, display_name, photo_url, role, provider, password_hash, last_login_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'user', 'google', NULL, now())
       RETURNING *`,
      [uid, username, username.toLowerCase(), email, name, picture]
    );
    user = rows[0];
  }

  const tokenPayload: TokenPayload = { uid: user.id, username: user.username, role: user.role };
  setAuthCookie(res, signToken(tokenPayload));
  res.json({ profile: toProfile(user) });
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
