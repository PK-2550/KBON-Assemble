import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';

/** สร้างสตริงขนาดตามที่ต้องการ หน่วยเป็นไบต์ */
const filler = (bytes: number) => 'x'.repeat(bytes);

/**
 * เพดานขนาด body แยกตามเส้นทาง
 *
 * เส้นทางทั่วไปใช้ 256kb ส่วนเส้นทางที่ต้องแนบไฟล์เป็น base64 ใช้ 10mb
 * ชุดนี้ยืนยันทั้งสองฝั่ง คือฝั่งที่ต้องปฏิเสธ และฝั่งที่ต้องยอมรับ
 */
describe('เพดานขนาด body', () => {
  test('endpoint ทั่วไปปฏิเสธ body ที่ใหญ่เกิน 256kb ด้วย 413', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'someone', password: filler(400_000) });

    expect(res.status).toBe(413);
    expect(res.body.error).toContain('ขนาดใหญ่เกินกำหนด');
  });

  test('endpoint ทั่วไปยังรับ body ขนาดปกติได้', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: `ไม่มีบัญชีนี้_${Date.now()}`, password: 'wrongpassword' });

    // 401 คือถูกปฏิเสธเพราะรหัสผิด ไม่ใช่เพราะขนาด body
    expect(res.status).toBe(401);
  });

  test('เส้นทางแนบไฟล์รับ body ขนาด 1MB ได้ ไม่ติดเพดาน 256kb', async () => {
    const res = await request(app)
      .post('/api/farm-requests')
      .send({ farmName: 'สวนทดสอบ', province: 'จันทบุรี', farmerIdCardPhoto: filler(1_000_000) });

    // 401 เพราะยังไม่ได้ล็อกอิน ซึ่งแปลว่า body ผ่านด่านขนาดมาถึง route แล้ว
    expect(res.status).toBe(401);
  });

  test('เส้นทางแนบไฟล์ยังมีเพดานของตัวเอง body เกิน 10mb ถูกปฏิเสธ', async () => {
    const res = await request(app)
      .post('/api/farm-requests')
      .send({ farmName: 'สวนทดสอบ', province: 'จันทบุรี', farmerIdCardPhoto: filler(11_000_000) });

    expect(res.status).toBe(413);
  }, 60_000);

  test('JSON รูปแบบผิดตอบ 400 ไม่ใช่ 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ ไม่ใช่ JSON ที่ถูกต้อง');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง');
  });
});
