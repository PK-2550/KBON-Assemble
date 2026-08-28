import { describe, it, expect } from 'vitest';
import {
  normalizeThaiNationalId,
  thaiNationalIdCheckDigit,
  isValidThaiNationalId,
  maskThaiNationalId,
  formatThaiNationalId,
} from './thaiNationalId';

// เลขสมมติที่คำนวณหลักตรวจสอบมาให้ถูกต้อง ไม่ใช่เลขของคนจริง
const VALID = ['1229900341828', '3210400192848', '1101700234568', '3909901122330'];

// เลขที่ใช้เป็นข้อมูลตัวอย่างอยู่ในระบบตอนนี้ หลักตรวจสอบผิดทั้งหมด
const SAMPLE_DATA_IN_REPO = ['1229900341829', '3210400192841', '1234567890123'];

describe('normalizeThaiNationalId', () => {
  it('ตัดขีดคั่นและเว้นวรรคออก', () => {
    expect(normalizeThaiNationalId('1-2299-00341-82-8')).toBe('1229900341828');
    expect(normalizeThaiNationalId(' 1229 9003 41828 ')).toBe('1229900341828');
  });

  it('รับค่าว่างได้โดยไม่พัง', () => {
    expect(normalizeThaiNationalId('')).toBe('');
  });
});

describe('thaiNationalIdCheckDigit', () => {
  it('คำนวณหลักที่ 13 จาก 12 หลักแรกได้', () => {
    expect(thaiNationalIdCheckDigit('122990034182')).toBe(8);
    expect(thaiNationalIdCheckDigit('390990112233')).toBe(0);
  });

  it('คืน null เมื่อยังไม่ครบ 12 หลัก', () => {
    expect(thaiNationalIdCheckDigit('1229')).toBeNull();
  });
});

describe('isValidThaiNationalId', () => {
  it.each(VALID)('ผ่านสำหรับเลขที่หลักตรวจสอบถูกต้อง: %s', (id) => {
    expect(isValidThaiNationalId(id)).toBe(true);
  });

  it('ผ่านแม้ผู้ใช้พิมพ์ขีดคั่นมาด้วย', () => {
    expect(isValidThaiNationalId('1-2299-00341-82-8')).toBe(true);
  });

  it.each(SAMPLE_DATA_IN_REPO)('ไม่ผ่านสำหรับเลขที่หลักตรวจสอบผิด: %s', (id) => {
    expect(isValidThaiNationalId(id)).toBe(false);
  });

  it('ไม่ผ่านเมื่อจำนวนหลักไม่ใช่ 13', () => {
    expect(isValidThaiNationalId('122990034182')).toBe(false);
    expect(isValidThaiNationalId('12299003418288')).toBe(false);
    expect(isValidThaiNationalId('')).toBe(false);
  });

  it('ไม่ผ่านเมื่อขึ้นต้นด้วยศูนย์', () => {
    expect(isValidThaiNationalId('0123456789012')).toBe(false);
  });

  it('ไม่ผ่านเมื่อมีตัวอักษรปน', () => {
    expect(isValidThaiNationalId('abcdefghijklm')).toBe(false);
  });
});

describe('maskThaiNationalId', () => {
  it('เปิดเผยเฉพาะหลักที่ 13 ซึ่งเป็นหลักตรวจสอบ', () => {
    expect(maskThaiNationalId('1229900341828')).toBe('X-XXXX-XXXXX-XX-8');
    expect(maskThaiNationalId('3909901122330')).toBe('X-XXXX-XXXXX-XX-0');
  });

  it('มีตัวเลขโผล่ออกมาตัวเดียว และเป็นหลักที่ 13 เท่านั้น', () => {
    // เช็คแบบนับจำนวนตัวเลข ไม่ใช่ไล่ดูว่าหลักไหนโผล่บ้าง
    // เพราะค่าของหลักตรวจสอบอาจบังเอิญตรงกับหลักใดหลักหนึ่งใน 12 ตัวแรกก็ได้
    const cases = ['1229900341828', '3210400192848', '3909901122330'];
    for (const id of cases) {
      const masked = maskThaiNationalId(id);
      const digitsShown = masked.replace(/[^0-9]/g, '');
      expect(digitsShown).toHaveLength(1);
      expect(digitsShown).toBe(id[12]);
    }
  });

  it('ปิดบังทั้งหมดเมื่อค่าที่ได้ไม่ใช่เลข 13 หลัก', () => {
    expect(maskThaiNationalId('1229')).toBe('X-XXXX-XXXXX-XX-X');
    expect(maskThaiNationalId('')).toBe('X-XXXX-XXXXX-XX-X');
  });
});

describe('formatThaiNationalId', () => {
  it('จัดกลุ่มตามรูปแบบบนบัตรจริง', () => {
    expect(formatThaiNationalId('1229900341828')).toBe('1-2299-00341-82-8');
  });

  it('คืนตัวเลขล้วนเมื่อจำนวนหลักไม่ครบ', () => {
    expect(formatThaiNationalId('1229')).toBe('1229');
  });
});
