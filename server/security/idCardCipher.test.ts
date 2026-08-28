import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  encryptIdCardValue,
  decryptIdCardValue,
  assertIdCardEncryptionKey,
  IdCardDecryptionError,
} from './idCardCipher';

const KEY_A = crypto.randomBytes(32).toString('base64');
const KEY_B = crypto.randomBytes(32).toString('base64');

const ID = '1229900341828';
const ROW = 'req_1720000000';

const originalKey = process.env.ID_CARD_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.ID_CARD_ENCRYPTION_KEY = KEY_A;
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.ID_CARD_ENCRYPTION_KEY;
  else process.env.ID_CARD_ENCRYPTION_KEY = originalKey;
});

describe('การเข้ารหัสและถอดรหัส', () => {
  it('ถอดกลับได้ค่าเดิม', () => {
    const blob = encryptIdCardValue(ID, ROW);
    expect(decryptIdCardValue(blob, ROW)).toBe(ID);
  });

  it('รองรับข้อมูลยาวแบบรูป base64 ได้', () => {
    const photo = 'data:image/jpeg;base64,' + crypto.randomBytes(80 * 1024).toString('base64');
    const blob = encryptIdCardValue(photo, ROW);
    expect(decryptIdCardValue(blob, ROW)).toBe(photo);
  });

  it('รองรับภาษาไทยและอักขระหลายไบต์', () => {
    const value = 'นายสมชาย วงศ์เกษตร 1229900341828';
    expect(decryptIdCardValue(encryptIdCardValue(value, ROW), ROW)).toBe(value);
  });

  it('ผลลัพธ์ไม่มีข้อความเดิมปนอยู่เลย', () => {
    const blob = encryptIdCardValue(ID, ROW);
    expect(blob.toString('utf8')).not.toContain(ID);
    expect(blob.toString('hex')).not.toContain(Buffer.from(ID, 'utf8').toString('hex'));
  });

  it('เข้ารหัสค่าเดิมสองครั้งได้ ciphertext คนละก้อน (nonce สุ่มใหม่ทุกครั้ง)', () => {
    const a = encryptIdCardValue(ID, ROW);
    const b = encryptIdCardValue(ID, ROW);
    expect(a.equals(b)).toBe(false);
    // nonce 12 ไบต์แรกต้องต่างกัน
    expect(a.subarray(0, 12).equals(b.subarray(0, 12))).toBe(false);
    // แต่ถอดกลับได้ค่าเดียวกันทั้งคู่
    expect(decryptIdCardValue(a, ROW)).toBe(decryptIdCardValue(b, ROW));
  });

  it('ก้อนข้อมูลมีความยาวตามโครงสร้าง nonce + ciphertext + tag', () => {
    const blob = encryptIdCardValue(ID, ROW);
    expect(blob.length).toBe(12 + Buffer.byteLength(ID, 'utf8') + 16);
  });
});

describe('AAD ผูกกับ id ของแถว', () => {
  it('ถอดด้วย rowId อื่นไม่ได้ -- กัน ciphertext ถูกสลับข้ามแถว', () => {
    const blob = encryptIdCardValue(ID, 'req_อันนี้');
    expect(() => decryptIdCardValue(blob, 'req_อันอื่น')).toThrow(IdCardDecryptionError);
  });

  it('สลับก้อนข้อมูลระหว่างสองแถวแล้วต้องถอดไม่ออก', () => {
    const rowA = 'req_A';
    const rowB = 'req_B';
    const blobA = encryptIdCardValue('1229900341828', rowA);
    const blobB = encryptIdCardValue('3210400192848', rowB);

    // จำลองคนที่เขียนฐานข้อมูลได้ เอา ciphertext ของ A ไปใส่แถว B
    expect(() => decryptIdCardValue(blobA, rowB)).toThrow(IdCardDecryptionError);
    expect(() => decryptIdCardValue(blobB, rowA)).toThrow(IdCardDecryptionError);

    // ของเดิมยังถอดได้ปกติ
    expect(decryptIdCardValue(blobA, rowA)).toBe('1229900341828');
    expect(decryptIdCardValue(blobB, rowB)).toBe('3210400192848');
  });

  it('ต้องระบุ rowId เสมอ (ด่านตรวจอินพุต ไม่ใช่ตัว AAD)', () => {
    expect(() => encryptIdCardValue(ID, '')).toThrow();
    expect(() => decryptIdCardValue(encryptIdCardValue(ID, ROW), '')).toThrow(IdCardDecryptionError);
  });

  it('ปฏิเสธข้อความว่างและค่าที่ไม่ใช่ Buffer', () => {
    expect(() => encryptIdCardValue('', ROW)).toThrow();
    // @ts-expect-error จงใจส่งชนิดผิดเพื่อทดสอบด่านตรวจ
    expect(() => decryptIdCardValue('ไม่ใช่ buffer', ROW)).toThrow(IdCardDecryptionError);
    // แคสต์เพราะจงใจส่งค่าที่ผิดชนิด เพื่อทดสอบด่านตรวจตอนรันจริง
    expect(() => decryptIdCardValue(null as unknown as Buffer, ROW)).toThrow(IdCardDecryptionError);
  });
});

describe('การตรวจจับการถูกแก้ไข', () => {
  it('แก้ ciphertext แม้แต่บิตเดียวก็ถอดไม่ออก', () => {
    const blob = encryptIdCardValue(ID, ROW);
    const tampered = Buffer.from(blob);
    tampered[14] ^= 0x01;
    expect(() => decryptIdCardValue(tampered, ROW)).toThrow(IdCardDecryptionError);
  });

  it('แก้ auth tag แล้วถอดไม่ออก', () => {
    const blob = encryptIdCardValue(ID, ROW);
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptIdCardValue(tampered, ROW)).toThrow(IdCardDecryptionError);
  });

  it('แก้ nonce แล้วถอดไม่ออก', () => {
    const blob = encryptIdCardValue(ID, ROW);
    const tampered = Buffer.from(blob);
    tampered[0] ^= 0xff;
    expect(() => decryptIdCardValue(tampered, ROW)).toThrow(IdCardDecryptionError);
  });

  it('ก้อนข้อมูลสั้นเกินไปถูกปฏิเสธ ไม่ใช่ทำให้ระบบพัง', () => {
    expect(() => decryptIdCardValue(Buffer.alloc(10), ROW)).toThrow(IdCardDecryptionError);
    expect(() => decryptIdCardValue(Buffer.alloc(28), ROW)).toThrow(IdCardDecryptionError);
  });

  it('ข้อความ error ไม่หลุดเนื้อข้อมูลจริงออกมา', () => {
    const blob = encryptIdCardValue(ID, ROW);
    try {
      decryptIdCardValue(blob, 'row_ผิด');
      throw new Error('ควรจะโยน error');
    } catch (err) {
      expect(err).toBeInstanceOf(IdCardDecryptionError);
      expect((err as Error).message).not.toContain(ID);
      expect((err as Error).message).not.toContain(ROW);
    }
  });
});

describe('กุญแจ', () => {
  it('ถอดด้วยกุญแจคนละดอกไม่ได้', () => {
    const blob = encryptIdCardValue(ID, ROW);
    process.env.ID_CARD_ENCRYPTION_KEY = KEY_B;
    expect(() => decryptIdCardValue(blob, ROW)).toThrow(IdCardDecryptionError);
  });

  it('ไม่มีค่าสำรองในโค้ด -- ไม่ตั้ง env แล้วต้องใช้งานไม่ได้', () => {
    delete process.env.ID_CARD_ENCRYPTION_KEY;
    expect(() => encryptIdCardValue(ID, ROW)).toThrow(/ID_CARD_ENCRYPTION_KEY/);
    expect(() => assertIdCardEncryptionKey()).toThrow(/ID_CARD_ENCRYPTION_KEY/);
  });

  it('กุญแจที่ความยาวไม่ใช่ 32 ไบต์ถูกปฏิเสธ', () => {
    process.env.ID_CARD_ENCRYPTION_KEY = crypto.randomBytes(16).toString('base64');
    expect(() => assertIdCardEncryptionKey()).toThrow(/32 ไบต์/);

    process.env.ID_CARD_ENCRYPTION_KEY = crypto.randomBytes(48).toString('base64');
    expect(() => assertIdCardEncryptionKey()).toThrow(/32 ไบต์/);
  });

  it('กุญแจที่ไม่ใช่ base64 ถูกปฏิเสธ', () => {
    // Buffer.from(x, 'base64') ของ Node ไม่โยน error มันทิ้งอักขระที่ไม่ใช่ base64
    // แล้วถอดเท่าที่ถอดได้ ด่านที่จับจริงจึงเป็นการตรวจความยาว 32 ไบต์
    process.env.ID_CARD_ENCRYPTION_KEY = 'ไม่ใช่ base64 เลย !!! มีเว้นวรรคด้วย';
    expect(() => assertIdCardEncryptionKey()).toThrow(/32 ไบต์/);

    process.env.ID_CARD_ENCRYPTION_KEY = '!!!!';
    expect(() => assertIdCardEncryptionKey()).toThrow(/32 ไบต์/);
  });

  it('กุญแจที่ตั้งถูกต้องผ่านการตรวจ', () => {
    process.env.ID_CARD_ENCRYPTION_KEY = KEY_A;
    expect(() => assertIdCardEncryptionKey()).not.toThrow();
  });
});
