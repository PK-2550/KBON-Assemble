import { describe, test, expect } from 'vitest';
import { normalizeZoneNameKey, cleanZoneName } from './regionalZoneName';

/**
 * กุญแจเทียบชื่อโซนใบรับรองระดับภูมิภาค
 *
 * ต้องให้ผลตรงกับดัชนีใน migration 015 ทุกกรณี ถ้าสองชั้นนี้ตัดสินไม่เหมือนกัน
 * เซิร์ฟเวอร์จะปล่อยชื่อที่ฐานกำลังจะปฏิเสธผ่านไป แล้วผู้ใช้จะเจอ error ดิบ
 * จากฐานข้อมูลแทนข้อความที่อ่านรู้เรื่อง
 *
 * ตัวที่เก็บลงฐานคือชื่อที่แอดมินพิมพ์ (ผ่าน cleanZoneName ซึ่งตัดแค่หัวท้าย)
 * ส่วนกุญแจเทียบล้างช่องว่างทิ้งทั้งหมด
 */

describe('กุญแจเทียบชื่อโซน', () => {
  test('ตัดช่องว่างหัวท้าย', () => {
    expect(normalizeZoneNameKey('  ศรีสะเกษ  ')).toBe(normalizeZoneNameKey('ศรีสะเกษ'));
  });

  test('ช่องว่างกลางชื่อไม่ทำให้เป็นคนละชื่อ', () => {
    // ภาษาไทยไม่ได้ใช้ช่องว่างคั่นคำ สองแบบนี้คือชื่อเดียวกันที่พิมพ์ต่างกัน
    expect(normalizeZoneNameKey('ทุเรียนภูเขาไฟ ศรีสะเกษ')).toBe(
      normalizeZoneNameKey('ทุเรียนภูเขาไฟศรีสะเกษ')
    );
  });

  test('ช่องว่างซ้อนหลายช่องก็ยังเป็นชื่อเดียวกัน', () => {
    expect(normalizeZoneNameKey('ศรี   สะเกษ')).toBe(normalizeZoneNameKey('ศรีสะเกษ'));
  });

  test('แท็บกับขึ้นบรรทัดใหม่ถูกล้างด้วย', () => {
    expect(normalizeZoneNameKey('ศรี\tสะเกษ\n')).toBe(normalizeZoneNameKey('ศรีสะเกษ'));
  });

  test('NBSP ที่มองไม่เห็นถูกล้าง', () => {
    // ติดมาบ่อยที่สุดตอนคัดลอกชื่อจากเว็บหน่วยงาน และมองไม่เห็นบนหน้าจอเลย
    expect(normalizeZoneNameKey('ศรี\u00A0สะเกษ')).toBe(normalizeZoneNameKey('ศรีสะเกษ'));
  });

  test('ZWSP กับอักขระควบคุมความกว้างศูนย์ถูกล้าง', () => {
    expect(normalizeZoneNameKey('ศรี\u200Bสะเกษ')).toBe(normalizeZoneNameKey('ศรีสะเกษ'));
    expect(normalizeZoneNameKey('ศรี\u200Cสะเกษ')).toBe(normalizeZoneNameKey('ศรีสะเกษ'));
    expect(normalizeZoneNameKey('ศรี\u200Dสะเกษ')).toBe(normalizeZoneNameKey('ศรีสะเกษ'));
    expect(normalizeZoneNameKey('\uFEFFศรีสะเกษ')).toBe(normalizeZoneNameKey('ศรีสะเกษ'));
  });

  test('อักษรโรมันต่างแค่ตัวพิมพ์ ถือเป็นชื่อเดียวกัน', () => {
    expect(normalizeZoneNameKey('Sisaket Volcanic')).toBe(normalizeZoneNameKey('sisaket volcanic'));
  });

  test('ชื่อที่ต่างกันจริง ต้องยังต่างกัน', () => {
    // ด่านนี้ต้องไม่กว้างเกินจนรวมโซนคนละโซนเข้าด้วยกัน
    expect(normalizeZoneNameKey('ทุเรียนศรีสะเกษ')).not.toBe(
      normalizeZoneNameKey('ทุเรียนภูเขาไฟศรีสะเกษ')
    );
  });
});

describe('ชื่อที่เก็บลงฐาน', () => {
  test('ตัดช่องว่างหัวท้ายทิ้ง', () => {
    expect(cleanZoneName('  ทุเรียนภูเขาไฟศรีสะเกษ  ')).toBe('ทุเรียนภูเขาไฟศรีสะเกษ');
  });

  test('ยุบช่องว่างซ้อนกลางชื่อให้เหลือช่องเดียว', () => {
    expect(cleanZoneName('ทุเรียนภูเขาไฟ   ศรีสะเกษ')).toBe('ทุเรียนภูเขาไฟ ศรีสะเกษ');
  });

  test('ล้างอักขระล่องหนที่มองไม่เห็นทิ้ง', () => {
    // ถ้าปล่อยไว้ ชื่อบนหน้าจอจะดูปกติแต่ค้นหาไม่เจอ
    expect(cleanZoneName('ทุเรียน\u200Bภูเขาไฟ\uFEFFศรีสะเกษ')).toBe('ทุเรียนภูเขาไฟศรีสะเกษ');
  });

  test('ไม่ยุบช่องว่างที่แอดมินตั้งใจใส่คั่นคำ', () => {
    // ต่างจากกุญแจเทียบ ตัวนี้เก็บชื่อไว้ให้อ่านเหมือนที่พิมพ์มา
    expect(cleanZoneName('ทุเรียนภูเขาไฟ ศรีสะเกษ')).toBe('ทุเรียนภูเขาไฟ ศรีสะเกษ');
  });
});
