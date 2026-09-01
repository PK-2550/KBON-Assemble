import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import { assertDbReady } from './db.js';
import { scheduleRejectedPiiPurge } from './jobs/purgeRejectedPii.js';
import { readUser } from './middleware/auth.js';
import { assertIdCardEncryptionKey } from './security/idCardCipher.js';
import { authIpLimiter } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { farmsRouter } from './routes/farms.js';
import { certificationTypesRouter } from './routes/certificationTypes.js';
import { treesRouter } from './routes/trees.js';
import { farmRequestsRouter } from './routes/farmRequests.js';
import { careLogsRouter } from './routes/careLogs.js';

const PORT = Number(process.env.API_PORT ?? 3001);

const app = express();

// ตัวจำกัดอัตรานับตาม req.ip ถ้า API อยู่หลัง proxy ที่เชื่อถือได้
// ต้องตั้ง TRUST_PROXY เพื่อให้ express อ่าน X-Forwarded-For
// ไม่เปิดไว้เสมอ เพราะถ้าไม่มี proxy จริง ใครก็ปลอม IP ตัวเองได้ด้วย header นี้
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY) {
  app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);
}

/**
 * เพดานขนาด body แยกตามเส้นทาง
 *
 * เดิมตั้ง 10mb ไว้ที่เดียวแล้วใช้กับทุก endpoint รวมถึง /api/auth/login
 * ที่รับแค่ชื่อผู้ใช้กับรหัสผ่าน ใครก็ยิง body ขนาด 10mb ใส่ endpoint ไหนก็ได้
 * แล้วบังคับให้เซิร์ฟเวอร์อ่านและแปลง JSON ทั้งก้อนก่อนจะรู้ว่าเป็นขยะ
 *
 * เส้นทางที่ต้องรับก้อนใหญ่จริงมีไม่กี่เส้น เพราะแนบไฟล์มาเป็น base64
 *   /api/farm-requests   สำเนาบัตรประชาชนและใบรับรอง ซึ่งแนบเป็น PDF ได้
 *   /api/farms           ข้อมูลฟาร์มพร้อมรูปบรรยากาศและรูปใบรับรอง
 *   /api/care-logs       นำเข้าประวัติการดูแลได้ครั้งละไม่เกิน 1000 รายการ
 *
 * ไฟล์ PDF ไม่ผ่านการบีบอัดฝั่ง client ต่างจากรูปภาพ จึงยังต้องเผื่อไว้ 10mb
 * ที่เหลือใช้ 256kb ซึ่งกว้างพอสำหรับข้อความและตัวเลขทุกฟอร์มในระบบ
 */
const jsonLarge = express.json({ limit: '10mb' });
const jsonSmall = express.json({ limit: '256kb' });

// ต้องมาก่อนตัวเล็ก เพราะ body-parser ตัวถัดไปจะข้ามให้เองเมื่อ body ถูกอ่านแล้ว
app.use('/api/farm-requests', jsonLarge);
app.use('/api/farms', jsonLarge);
app.use('/api/care-logs', jsonLarge);
app.use(jsonSmall);

app.use(cookieParser());
app.use(readUser);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authIpLimiter, authRouter);
app.use('/api/farms', farmsRouter);
app.use('/api/certification-types', certificationTypesRouter);
app.use('/api/trees', treesRouter);
app.use('/api/farm-requests', farmRequestsRouter);
// careLogs ลงทะเบียนที่ราก /api เพราะมีทั้งเส้นทางใต้ /trees และ /care-logs
app.use('/api', careLogsRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'ไม่พบ endpoint ที่เรียก' }));

/**
 * ตัวจับ error รวม
 *
 * route ทุกตัวเป็น async ถ้า throw ออกมาโดยไม่มีตัวจับ Express 4 จะปล่อยค้าง
 * จน request timeout แทนที่จะตอบ error กลับไป
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  // body ใหญ่เกินเพดาน body-parser โยน error ที่มี type เป็น entity.too.large
  // ตอบ 413 พร้อมบอกสาเหตุ ดีกว่าปล่อยให้กลายเป็น 500 ที่ผู้ใช้เดาไม่ถูกว่าทำอะไรผิด
  if ((err as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({
      error: 'ข้อมูลที่ส่งมามีขนาดใหญ่เกินกำหนด กรุณาลดขนาดไฟล์แนบแล้วลองใหม่',
    });
  }

  // JSON ที่รูปแบบไม่ถูกต้อง ก็ไม่ใช่ความผิดพลาดของเซิร์ฟเวอร์เช่นกัน
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง' });
  }

  console.error('เกิดข้อผิดพลาดที่ไม่ได้จัดการ:', err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' });
});

/**
 * ส่งออกไปให้ชุดทดสอบเรียกผ่าน supertest ได้โดยไม่ต้องเปิดพอร์ตจริง
 * ตัวเซิร์ฟเวอร์เริ่มทำงานเฉพาะเมื่อไฟล์นี้ถูกรันตรง ไม่ใช่ตอนถูก import
 */
export { app };

async function start() {
  // ล้มตั้งแต่ตอนเปิดเซิร์ฟเวอร์ถ้ากุญแจเข้ารหัสบัตรประชาชนตั้งไว้ไม่ถูก
  // ไม่ใช่ปล่อยให้ไปเจอตอนผู้ใช้กดยื่นคำขอแล้วได้ 500 โดยไม่รู้สาเหตุ
  try {
    assertIdCardEncryptionKey();
  } catch (err) {
    console.error('\nกุญแจเข้ารหัสข้อมูลบัตรประชาชนตั้งค่าไม่ถูกต้อง');
    console.error(`   ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  try {
    await assertDbReady();
  } catch (err) {
    console.error('\nเชื่อมต่อฐานข้อมูลไม่สำเร็จ');
    console.error(`   ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  // งานล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธ รันทันทีหนึ่งรอบแล้วทุก 24 ชั่วโมง
  //
  // ตั้งหลังเชื่อมฐานสำเร็จ ไม่งั้นรอบแรกจะล้มทุกครั้งที่ฐานยังไม่พร้อม
  // ตัวงานกันรันซ้อนด้วย advisory lock ที่ฐาน ไม่ใช่ตัวแปรในหน่วยความจำ
  scheduleRejectedPiiPurge();

  app.listen(PORT, () => {
    console.log(`API พร้อมใช้งานที่ http://localhost:${PORT}/api`);
  });
}

// รันเซิร์ฟเวอร์เฉพาะตอนที่ไฟล์นี้ถูกสั่งรันตรง ๆ
// เวลาชุดทดสอบ import app เข้ามา จะไม่จองพอร์ตซ้อนกับเซิร์ฟเวอร์ที่รันอยู่
if (!process.env.VITEST) {
  start();
}
