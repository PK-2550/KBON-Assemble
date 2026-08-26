import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import { assertDbReady } from './db.js';
import { readUser } from './middleware/auth.js';
import { authIpLimiter } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { farmsRouter } from './routes/farms.js';
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

// รูปใบรับรองถูกส่งมาเป็น base64 ซึ่งใหญ่กว่า limit ปริยาย 100kb มาก
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(readUser);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authIpLimiter, authRouter);
app.use('/api/farms', farmsRouter);
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
  console.error('เกิดข้อผิดพลาดที่ไม่ได้จัดการ:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' });
});

async function start() {
  try {
    await assertDbReady();
  } catch (err) {
    console.error('\nเชื่อมต่อฐานข้อมูลไม่สำเร็จ');
    console.error(`   ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API พร้อมใช้งานที่ http://localhost:${PORT}/api`);
  });
}

start();
