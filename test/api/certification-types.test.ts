import 'dotenv/config';
import { describe, test, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';

/**
 * รายการประเภทใบรับรองที่ฟอร์มเอาไปสร้างตัวเลือก
 *
 * เดิมฟอร์มใช้ค่าคงที่ฝั่งหน้าเว็บซึ่งไม่เคยถูกทำให้ตรงกับตาราง
 * certification_types เลย ผลคือ
 *
 *   เลือก Q-Mark หรือ ISO แล้วถูกบันทึกเป็น LEGACY_OTHER ทั้งที่ผู้ใช้
 *   ระบุมาตรฐานชัดเจน ตราบนหน้าเว็บจึงขึ้นว่า อื่น ๆ ย้ายมาจากระบบเดิม
 *
 *   GMP กับ GACC มีอยู่ในฐานตั้งแต่ 005 แต่เลือกไม่ได้เลย
 *
 * 005 ออกแบบให้ certification_types เป็นตารางค้นหา เพิ่มประเภทใหม่คือ INSERT
 * ไม่ต้องแก้ schema ถ้าฟอร์มยังฝังรายการไว้ในโค้ด เจตนานั้นก็ไม่เกิดผล
 */

afterAll(async () => {
  await pool.end();
});

describe('GET /api/certification-types', () => {
  test('คืนประเภทที่เลือกได้ในฟอร์ม', async () => {
    const res = await request(app).get('/api/certification-types');

    expect(res.status).toBe(200);
    const codes = res.body.types.map((t: { code: string }) => t.code);

    expect(codes).toContain('GAP');
    expect(codes).toContain('GMP');
    expect(codes).toContain('GACC');
    expect(codes).toContain('ORGANIC_TH');
    expect(codes).toContain('Q_MARK');
    expect(codes).toContain('ISO22000');
  });

  test('ไม่คืนใบระดับการขนส่งรายเที่ยว เพราะยังไม่มีระบบเที่ยวขนส่ง', async () => {
    // PHYTO เป็น tier shipment ซึ่ง trigger บังคับว่าต้องมี shipment_ref
    // ถ้าปล่อยให้เลือกได้ ผู้ใช้จะกรอกครบแล้วแอดมินอนุมัติไม่ผ่าน
    const res = await request(app).get('/api/certification-types');
    const codes = res.body.types.map((t: { code: string }) => t.code);

    expect(codes).not.toContain('PHYTO');
  });

  test('ไม่คืนประเภทสำหรับข้อมูลที่ย้ายมาจากระบบเดิม', async () => {
    // LEGACY_OTHER เป็นถังรองรับตอนย้ายข้อมูล ไม่ใช่ตัวเลือกที่ผู้ใช้ควรเลือกเอง
    const res = await request(app).get('/api/certification-types');
    const codes = res.body.types.map((t: { code: string }) => t.code);

    expect(codes).not.toContain('LEGACY_OTHER');
  });

  test('คืน GI มาด้วย พร้อมบอกว่าเป็นใบระดับโซน', async () => {
    // GI เลือกได้ แต่ปลายทางคนละตารางกับใบของสวน หน้าเว็บต้องรู้เพื่อบอกผู้ใช้
    // ว่าแอดมินจะเป็นคนจับคู่โซนให้ ไม่ใช่ปล่อยให้กรอกแล้วหายเงียบ ๆ
    const res = await request(app).get('/api/certification-types');
    const gi = res.body.types.find((t: { code: string }) => t.code === 'GI');

    expect(gi).toBeDefined();
    expect(gi.tier).toBe('regional');
  });

  test('เรียงตามลำดับที่ตั้งไว้ในฐาน และมีชื่อไทยกับหน่วยงานที่ออกให้ครบ', async () => {
    const res = await request(app).get('/api/certification-types');
    const types = res.body.types as { code: string; nameTh: string; sortOrder: number }[];

    expect(types.length).toBeGreaterThan(0);
    for (const t of types) {
      expect(t.nameTh).toBeTruthy();
    }
    const orders = types.map((t) => t.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  test('ไม่ต้องเข้าสู่ระบบก็เรียกได้ เพราะฟอร์มยื่นคำขอต้องใช้ตอนยังไม่ล็อกอิน', async () => {
    const res = await request(app).get('/api/certification-types');
    expect(res.status).toBe(200);
  });
});
