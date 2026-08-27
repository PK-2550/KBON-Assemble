import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';

/**
 * ทดสอบ Express โดยไม่ต้องเปิดพอร์ต
 *
 * supertest เรียก app ตรง ๆ ต่างจากชุด smoke ที่ยิงผ่าน HTTP ไปยังเซิร์ฟเวอร์
 * ที่รันอยู่ ข้อดีคือรันได้แม้ยังไม่ได้สั่ง npm run dev:api
 * ยังต้องมีฐานข้อมูลอยู่ เพราะ route จริงคุยกับ Postgres
 */
describe('Express app ผ่าน supertest', () => {
  test('GET /api/health ตอบ 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('endpoint ที่ไม่มีอยู่ตอบ 404 พร้อมข้อความภาษาไทย', async () => {
    const res = await request(app).get('/api/ไม่มีเส้นทางนี้');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('ไม่พบ endpoint ที่เรียก');
  });

  test('GET /api/farms เปิดให้อ่านได้โดยไม่ต้องล็อกอิน', async () => {
    const res = await request(app).get('/api/farms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.farms)).toBe(true);
  });

  test('GET /api/auth/me ตอบ 401 เมื่อยังไม่ได้ล็อกอิน', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('ยื่นคำขอขึ้นทะเบียนสวนโดยไม่ล็อกอินไม่ได้', async () => {
    const res = await request(app)
      .post('/api/farm-requests')
      .send({ farmName: 'สวนทดสอบ', province: 'จันทบุรี' });
    expect(res.status).toBe(401);
  });

  test('ล็อกอินด้วยรหัสผิดตอบ 401 พร้อมข้อความกลาง ๆ ที่ไม่บอกว่าบัญชีมีอยู่หรือไม่', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: `ไม่มีบัญชีนี้แน่นอน_${Date.now()}`, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    // ข้อความต้องเป็นอันเดียวกับกรณีรหัสผ่านผิด ไม่เช่นนั้นจะเดา username ได้
    expect(res.body.error).toContain('ไม่ถูกต้อง');
  });
});
