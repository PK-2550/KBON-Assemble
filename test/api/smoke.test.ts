import 'dotenv/config';
import { describe, test, expect } from 'vitest';
import { run as runApiSmoke } from '../../scripts/smoke-api';
import { run as runFarmRequestSmoke } from '../../scripts/smoke-farm-requests';

/**
 * ห่อชุดทดสอบ smoke เดิมให้รันผ่าน Vitest
 *
 * ไม่ได้เขียนใหม่ เพราะสองไฟล์นั้นครอบคลุมเส้นทางจริงไว้ครบแล้ว 90 ข้อ
 * และยังต้องรันตามลำดับเพราะสร้างข้อมูลต่อกันเป็นทอด
 * แตกเป็น test() รายข้อไม่ได้โดยไม่รื้อทั้งไฟล์
 *
 * ที่ปรับคือให้ทั้งสองไฟล์คืนผลออกมาแทนการเรียก process.exit เอง
 * ฝั่งนี้จึงรายงานได้ว่าพังข้อไหน ไม่ใช่แค่บอกว่าพัง
 *
 * ทั้งสองชุดยิงไปที่เซิร์ฟเวอร์ที่รันอยู่จริงที่ localhost
 * ต้องสั่ง npm run dev:api ค้างไว้ก่อน
 */
describe('ชุดทดสอบ API แบบ end-to-end', () => {
  test('smoke:api ผ่านทุกข้อ', async () => {
    const result = await runApiSmoke();
    expect(result.failures, `ข้อที่ไม่ผ่าน:\n${result.failures.join('\n')}`).toEqual([]);
    expect(result.passed).toBeGreaterThan(0);
  });

  test('smoke:farm-requests ผ่านทุกข้อ', async () => {
    const result = await runFarmRequestSmoke();
    expect(result.failures, `ข้อที่ไม่ผ่าน:\n${result.failures.join('\n')}`).toEqual([]);
    expect(result.passed).toBeGreaterThan(0);
  });
});
