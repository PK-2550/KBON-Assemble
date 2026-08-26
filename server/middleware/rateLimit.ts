import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * ตัวจำกัดอัตราการเรียกสำหรับ endpoint ที่เกี่ยวกับบัญชีผู้ใช้
 *
 * bcrypt cost 12 ทำให้เดารหัสผ่านช้าลงก็จริง แต่ไม่ได้หยุด
 * ถ้าไม่มีอะไรจำกัดจำนวนครั้ง ผู้โจมตีก็ยิงได้เรื่อย ๆ จนกว่าจะเจอ
 *
 * เก็บสถานะไว้ในหน่วยความจำของ process นี้เท่านั้น
 * ถ้าวันหนึ่งรัน API หลาย instance ต้องเปลี่ยนไปใช้ store ร่วม เช่น Redis
 * ไม่อย่างนั้นเพดานจริงจะกลายเป็นเพดานคูณจำนวน instance
 */

/** ข้อความเดียวกันทุกกรณี ไม่บอกว่าติดเพดานเพราะ username ไหน */
const TOO_MANY_MESSAGE =
  'มีการพยายามเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';

function sendTooMany(_req: Request, res: Response) {
  res.status(429).json({ error: TOO_MANY_MESSAGE });
}

/**
 * เพดานรวมของทุก endpoint ใต้ /api/auth ต่อหนึ่ง IP
 *
 * จับกรณียิงหลาย username จาก IP เดียว ซึ่งตัวจำกัดรายบัญชีข้างล่างมองไม่เห็น
 *
 * เป็นแค่ตัวกันชั้นนอก ตัวกันหลักคือ loginLimiter ข้างล่าง
 * จึงตั้งไว้สูง เพราะหลายคนอาจออกเน็ตผ่าน IP เดียวกัน เช่น ออฟฟิศหรือเน็ตมือถือ
 * ถ้าตั้งต่ำกว่านี้ คนทั้งออฟฟิศจะล็อกอินไม่ได้เพราะโควตาร่วมกัน
 */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: sendTooMany,
});

/**
 * เพดานการล็อกอินที่ล้มเหลว แยกตาม IP คู่กับ username
 *
 * skipSuccessfulRequests ทำให้นับเฉพาะครั้งที่ล้มเหลว
 * คนที่กรอกถูกจึงล็อกอินกี่ครั้งก็ได้ ไม่โดนล็อกเพราะใช้งานปกติ
 *
 * ที่ผูก IP เข้ากับ username ด้วย เพราะถ้าใช้ username อย่างเดียว
 * ใครก็ยิงรหัสผิดใส่บัญชี admin เพื่อล็อกเจ้าของออกจากระบบได้
 * แลกกับการที่ผู้โจมตีซึ่งเปลี่ยน IP ได้จะเลี่ยงตัวนี้ไปชน authIpLimiter แทน
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const raw = (req.body as { username?: unknown } | undefined)?.username;
    const username = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    // ipKeyGenerator รวม IPv6 เป็นช่วง /56 กัน bypass ด้วยการเปลี่ยน address ท้าย ๆ
    return `${ipKeyGenerator(req.ip ?? '')}:${username}`;
  },
  handler: sendTooMany,
});

/** กันสมัครสมาชิกรัวจาก IP เดียว */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'สมัครสมาชิกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
    });
  },
});
