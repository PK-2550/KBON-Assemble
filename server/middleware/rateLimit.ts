import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { logIdCardAccessBestEffort } from '../security/idCardAccessLog.js';

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

/**
 * ยกเว้นเพดานให้ request ที่มาจากเครื่องเดียวกัน สำหรับตอนพัฒนาและรัน smoke test
 *
 * smoke test สมัครสมาชิก 3 คนต่อรอบ รันซ้ำไม่กี่รอบก็ชนเพดาน 20 ครั้ง/ชั่วโมง
 *
 * ต้องเปิดด้วยตัวเองผ่าน RATE_LIMIT_ALLOW_LOOPBACK ไม่เปิดให้อัตโนมัติ
 * เพราะถ้าดูแค่ IP ว่าเป็น loopback แล้วยกเว้น จะกลายเป็นรูรั่วทันที
 * เมื่อ API อยู่หลัง reverse proxy บนเครื่องเดียวกัน เพราะ req.ip จะเป็น 127.0.0.1
 * ของ proxy ทุก request จึงหลุดเพดานทั้งหมด เท่ากับปิด rate limit ทิ้ง
 *
 * กันอีกชั้นด้วยการปฏิเสธเมื่อ NODE_ENV=production ถึงตั้งตัวแปรไว้ก็ไม่มีผล
 */
const ALLOW_LOOPBACK =
  process.env.RATE_LIMIT_ALLOW_LOOPBACK === 'true' &&
  process.env.NODE_ENV !== 'production';

if (process.env.RATE_LIMIT_ALLOW_LOOPBACK === 'true' && process.env.NODE_ENV === 'production') {
  console.warn(
    'มี RATE_LIMIT_ALLOW_LOOPBACK=true แต่ NODE_ENV=production จึงไม่เปิดการยกเว้น -- rate limit ยังทำงานตามปกติ'
  );
} else if (ALLOW_LOOPBACK) {
  console.warn('ยกเว้น rate limit ให้ request จาก loopback (โหมดพัฒนา ห้ามใช้บน production)');
}

const LOOPBACK_ADDRESSES = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);

/** true เมื่อ request นี้ไม่ต้องนับโควตา */
function skipLoopback(req: Request): boolean {
  return ALLOW_LOOPBACK && LOOPBACK_ADDRESSES.has(req.ip ?? '');
}

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
  skip: skipLoopback,
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
  skip: skipLoopback,
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

/**
 * กันการดึงข้อมูลบัตรประชาชนจำนวนมากผิดปกติ
 *
 * นับตาม uid ของแอดมิน ไม่ใช่ตาม IP เพราะคำถามที่ต้องตอบคือ
 * "บัญชีไหนกำลังกวาดข้อมูล" ไม่ใช่ "เครื่องไหน" แอดมินคนเดียวที่ย้ายเครื่อง
 * หรือเปลี่ยนเน็ตยังต้องนับรวมเป็นคนเดิม
 *
 * จงใจไม่ใส่ skip: skipLoopback ต่างจากตัวอื่นในไฟล์นี้
 * การยกเว้น loopback มีไว้ให้ smoke test สมัครสมาชิกรัว ๆ ได้ตอนพัฒนา
 * ซึ่งเป็นคนละเรื่องกับการอ่านข้อมูลบัตรประชาชน ตัวนี้จึงทำงานทุกสภาพแวดล้อม
 *
 * เพดาน 30 ครั้งต่อ 10 นาที กว้างพอสำหรับแอดมินที่ไล่ตรวจคำขอทีละใบตามปกติ
 * แต่แคบพอที่การกวาดข้อมูลทั้งฐานจะชนเพดานตั้งแต่ยังไม่ได้อะไรไปมาก
 */
export const idCardRevealLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = (req as Request & { user?: { uid?: string } }).user?.uid;
    // ถ้าไม่มี uid แปลว่ามาไม่ผ่าน requireAdmin ซึ่งไม่ควรเกิด นับตาม IP ไว้ก่อน
    return uid ? `admin:${uid}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
  },
  handler: (req, res) => {
    // การชนเพดานคือสัญญาณตรง ๆ ของการกวาดข้อมูล ต้องบันทึกไว้ให้เห็น
    // ไม่ใช่ปฏิเสธเงียบ ๆ แล้วไม่เหลือร่องรอยว่าใครพยายามทำอะไร
    const uid = (req as Request & { user?: { uid?: string } }).user?.uid;
    if (uid) {
      logIdCardAccessBestEffort({
        adminUserId: uid,
        farmRequestId: req.params?.id ?? '(ไม่ระบุ)',
        outcome: 'rate_limited',
        ip: req.ip ?? null,
      });
    }

    res.status(429).json({
      error: 'เปิดดูข้อมูลบัตรประชาชนถี่เกินไป กรุณารอสักครู่แล้วลองใหม่',
    });
  },
});

/** กันสมัครสมาชิกรัวจาก IP เดียว */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  skip: skipLoopback,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'สมัครสมาชิกถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
    });
  },
});
