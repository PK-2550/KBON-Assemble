import { describe, it, expect } from 'vitest';
import { toRequest } from './farmRequests';

/**
 * การปิดบังเลขบัตรและรูปถ่ายบัตรใน toRequest
 *
 * toRequest เป็นทางออกทางเดียวของข้อมูลคำขอ ทุก route ที่ตอบคำขอกลับไป
 * ล้วนเรียกฟังก์ชันนี้ ทั้งของผู้ใช้ทั่วไป (GET /, GET /mine, POST /)
 * และของแอดมิน (approve, reject, reset) การทดสอบที่นี่จึงครอบทั้งสองเส้นทาง
 * โดยไม่ต้องมีฐานข้อมูล ส่วนการยืนยันระดับ route อยู่ใน test/api/id-card-masking.test.ts
 */

/** แถวแบบที่ยังไม่ได้เข้ารหัส -- สภาพของฐานข้อมูลก่อนรันสคริปต์เข้ารหัส */
const legacyRow = {
  id: 'req_1',
  user_id: 'u1',
  farm_name: 'สวนทดสอบ',
  province: 'จันทบุรี',
  status: 'pending',
  farmer_full_name: 'นายสมชาย วงศ์เกษตร',
  farmer_id_card_number: '1229900341828',
  farmer_id_card_photo: 'data:image/jpeg;base64,AAAABBBBCCCC',
  farmer_id_card_file_type: 'image',
};

/** แถวแบบหลังเข้ารหัสแล้ว -- ไม่มีคอลัมน์ข้อความธรรมดาเหลือ */
const encryptedRow = {
  id: 'req_2',
  user_id: 'u2',
  farm_name: 'สวนทดสอบสอง',
  province: 'ระยอง',
  status: 'approved',
  farmer_full_name: 'นางสาวสมหญิง',
  farmer_id_card_ciphertext: Buffer.from('ciphertext'),
  farmer_id_card_photo_ciphertext: Buffer.from('photo-ciphertext'),
  farmer_id_card_check_digit: '8',
  farmer_id_card_file_type: 'pdf',
};

describe('toRequest -- ไม่ส่งเลขบัตรและรูปออกไปไม่ว่าผู้เรียกเป็นใคร', () => {
  it('แถวที่ยังเป็นข้อความธรรมดา ก็ไม่หลุดออกไป', () => {
    const out = toRequest(legacyRow) as Record<string, unknown>;

    expect(out.farmerIdCardNumber).toBeUndefined();
    expect(out.farmerIdCardPhoto).toBeUndefined();
    expect(out.farmerIdCardMasked).toBe('X-XXXX-XXXXX-XX-8');
    expect(out.hasIdCardPhoto).toBe(true);
  });

  it('แถวที่เข้ารหัสแล้ว ปิดบังจากหลักตรวจสอบที่เก็บแยกไว้', () => {
    const out = toRequest(encryptedRow) as Record<string, unknown>;

    expect(out.farmerIdCardNumber).toBeUndefined();
    expect(out.farmerIdCardPhoto).toBeUndefined();
    expect(out.farmerIdCardMasked).toBe('X-XXXX-XXXXX-XX-8');
    expect(out.hasIdCardPhoto).toBe(true);
  });

  it('ทั้งก้อนที่ส่งออกไปไม่มีเลขบัตรหรือเนื้อรูปปนอยู่เลย', () => {
    for (const row of [legacyRow, encryptedRow]) {
      const serialized = JSON.stringify(toRequest(row));
      expect(serialized).not.toContain('1229900341828');
      expect(serialized).not.toContain('122990034182');
      expect(serialized).not.toContain('AAAABBBBCCCC');
      expect(serialized).not.toContain('ciphertext');
    }
  });

  it('เปิดเผยได้แค่หลักที่ 13 หลักเดียว ไม่ใช่สี่หลักท้าย', () => {
    const out = toRequest(legacyRow) as Record<string, unknown>;
    const masked = out.farmerIdCardMasked as string;
    const digitsShown = masked.replace(/[^0-9]/g, '');

    expect(digitsShown).toHaveLength(1);
    expect(digitsShown).toBe('8');
    // สามหลักก่อนหน้าของกลุ่มสี่หลักท้ายต้องไม่โผล่
    expect(masked).not.toContain('182');
  });

  it('คำขอที่ไม่มีข้อมูลบัตรเลย ไม่มีค่าปิดบังและไม่บอกว่ามีรูป', () => {
    const out = toRequest({
      id: 'req_3',
      user_id: 'u3',
      farm_name: 'สวนไม่มีบัตร',
      province: 'ยะลา',
      status: 'pending',
    }) as Record<string, unknown>;

    expect(out.farmerIdCardMasked).toBeUndefined();
    expect(out.hasIdCardPhoto).toBe(false);
  });

  it('มีรูปแต่ไม่มีเลข ก็ยังบอกว่ามีรูปได้', () => {
    const out = toRequest({
      id: 'req_4',
      user_id: 'u4',
      farm_name: 'สวนมีแต่รูป',
      province: 'ยะลา',
      status: 'pending',
      farmer_id_card_photo: 'data:image/jpeg;base64,ZZZZ',
    }) as Record<string, unknown>;

    expect(out.farmerIdCardMasked).toBeUndefined();
    expect(out.hasIdCardPhoto).toBe(true);
    expect(out.farmerIdCardPhoto).toBeUndefined();
  });

  it('ข้อมูลอื่นของคำขอยังส่งออกไปครบเหมือนเดิม', () => {
    const out = toRequest(legacyRow) as Record<string, unknown>;

    expect(out.id).toBe('req_1');
    expect(out.userId).toBe('u1');
    expect(out.farmName).toBe('สวนทดสอบ');
    expect(out.province).toBe('จันทบุรี');
    expect(out.status).toBe('pending');
    expect(out.farmerFullName).toBe('นายสมชาย วงศ์เกษตร');
    expect(out.farmerIdCardFileType).toBe('image');
  });
});
