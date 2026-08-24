import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'duritrack_token';
const TOKEN_TTL = '7d';

if (!process.env.JWT_SECRET) {
  console.error('ไม่พบ JWT_SECRET -- ตรวจว่ามีไฟล์ .env อยู่หรือยัง (ดู .env.example)');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

export interface TokenPayload {
  uid: string;
  username: string;
  role: 'user' | 'admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/**
 * ส่ง token ผ่าน httpOnly cookie ไม่ใช่ response body
 *
 * ระบบเดิมเก็บ session ไว้ใน localStorage ซึ่ง JavaScript อ่านได้
 * แปลว่า XSS ตัวเดียวก็ขโมย session ได้ทั้งหมด
 * httpOnly ทำให้ JS แตะ cookie ไม่ได้เลย เบราว์เซอร์แนบให้เองตอนยิง request
 */
export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    // localhost ใช้ http ธรรมดา จึงยังเปิด secure ไม่ได้
    // ตอนขึ้น production ที่เป็น https ต้องเปลี่ยนเป็น true
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** อ่าน token ถ้ามี แต่ไม่บังคับว่าต้องล็อกอิน */
export function readUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      // token หมดอายุหรือถูกแก้ -- ถือว่าไม่ได้ล็อกอิน
    }
  }
  next();
}

/** บังคับว่าต้องล็อกอิน */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งานส่วนนี้' });
  }
  next();
}

/**
 * บังคับว่าต้องเป็นแอดมิน
 *
 * role อ่านจาก JWT ที่เซ็นด้วย secret ฝั่ง server เท่านั้น
 * ระบบเดิมให้ client เขียน role ลง Firestore เองได้ ผู้ใช้ทั่วไปจึงตั้งตัวเองเป็น
 * admin ได้ทันที ตอนนี้ client แก้ role ไม่ได้แล้ว ต้องใช้ npm run make:admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งานส่วนนี้' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ต้องมีสิทธิ์ผู้ดูแลระบบ (Admin) จึงจะทำรายการนี้ได้' });
  }
  next();
}
