import crypto from 'node:crypto';

/**
 * เข้ารหัสข้อมูลบัตรประชาชน -- เลขบัตรและรูปถ่ายบัตร
 *
 * ใช้ AES-256-GCM ของ Node ไม่ใช่ pgcrypto
 * pgcrypto ต้องส่งกุญแจเข้าไปเป็นพารามิเตอร์ของคำสั่ง SQL ทุกครั้งที่เรียก
 * กุญแจจึงมีโอกาสไปโผล่ใน log_statement, pg_stat_activity หรือ pg_stat_statements
 * การเข้ารหัสที่นี่ทำให้กุญแจอยู่ในโปรเซส Node เท่านั้น
 * ส่วน Postgres สายเน็ตเวิร์ก และ log เห็นแต่ ciphertext
 *
 * GCM ให้ทั้งความลับและการตรวจจับการถูกแก้ไข ถ้าใครแก้ ciphertext แม้แต่บิตเดียว
 * การถอดรหัสจะล้ม ไม่ใช่คืนข้อมูลมั่ว ๆ ออกมา
 */

/**
 * คำเตือนเรื่องการเปลี่ยนกุญแจ
 *
 * ตอนนี้ระบบรองรับกุญแจชุดเดียว ยังไม่มีการอ่าน id_card_key_version
 * และยังไม่มีแผนที่ระหว่างเวอร์ชันกับกุญแจ
 *
 * ถ้าเปลี่ยนค่า ID_CARD_ENCRYPTION_KEY ทั้งที่มีข้อมูลเข้ารหัสไว้แล้ว
 * ข้อมูลเดิมจะถอดกลับไม่ได้ทั้งหมดอย่างถาวร อาการที่เห็นคือทุกครั้งที่แอดมิน
 * กดดูเลขบัตรจะได้ 500 ซึ่งดังพอให้รู้ตัว แต่ก็แปลว่าข้อมูลนั้นหายไปแล้ว
 *
 * การหมุนกุญแจต้องทำสองอย่างก่อน คือทำให้ถอดรหัสเลือกกุญแจตามเวอร์ชันได้
 * และมีสคริปต์เข้ารหัสข้อมูลเดิมใหม่ทั้งหมด ทั้งสองอย่างยังไม่มีในตอนนี้
 */

/** ขนาดกุญแจของ aes-256-gcm */
const KEY_BYTES = 32;

/**
 * ความยาว nonce 12 ไบต์ เป็นค่าที่ NIST SP 800-38D แนะนำสำหรับ GCM
 * ไม่ใช้ค่าอื่นเพราะความยาวอื่นทำให้ GCM ต้องเอา nonce ไปผ่าน GHASH ก่อน
 * ซึ่งลดขอบเขตความปลอดภัยลงโดยไม่ได้อะไรกลับมา
 */
const NONCE_BYTES = 12;

/** ความยาว authentication tag มาตรฐานของ GCM */
const TAG_BYTES = 16;

const ALGORITHM = 'aes-256-gcm';

/** ข้อผิดพลาดตอนถอดรหัส -- จงใจไม่พ่วงรายละเอียดของข้อมูลจริงติดไปด้วย */
export class IdCardDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdCardDecryptionError';
  }
}

/**
 * อ่านกุญแจจาก process.env เท่านั้น ไม่มีค่าสำรองเขียนตายตัวในโค้ด
 *
 * อ่านตอนเรียกใช้ ไม่ใช่ตอน import เพราะถ้าอ่านตอน import แล้วสั่ง exit
 * แบบเดียวกับ auth.ts ไฟล์นี้จะ import เข้ามาทดสอบไม่ได้เลย
 * ความ fail-fast ตอนเปิดเซิร์ฟเวอร์ได้จาก assertIdCardEncryptionKey() ที่ index.ts เรียกแทน
 */
function getKey(): Buffer {
  const raw = process.env.ID_CARD_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      'ไม่พบ ID_CARD_ENCRYPTION_KEY -- ตรวจว่ามีไฟล์ .env อยู่หรือยัง (ดู .env.example)'
    );
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error('ID_CARD_ENCRYPTION_KEY ไม่ใช่ base64 ที่ถูกต้อง');
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ID_CARD_ENCRYPTION_KEY ต้องยาว ${KEY_BYTES} ไบต์เมื่อถอด base64 แล้ว (ได้ ${key.length} ไบต์) ` +
        'สร้างใหม่ด้วย: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  return key;
}

/**
 * ตรวจว่ากุญแจตั้งค่าไว้ถูกต้องหรือยัง ให้ index.ts เรียกตอนเปิดเซิร์ฟเวอร์
 * จะได้ล้มตั้งแต่ตอนเปิด ไม่ใช่ตอนผู้ใช้กดยื่นคำขอแล้วเจอ 500
 */
export function assertIdCardEncryptionKey(): void {
  getKey();
}

/**
 * เข้ารหัส
 *
 * ผลลัพธ์เป็นก้อนเดียว  nonce(12) ‖ ciphertext ‖ authTag(16)
 * เก็บลงคอลัมน์ bytea ได้ตรง ๆ ไม่ต้องแยกคอลัมน์เก็บ nonce กับ tag
 *
 * rowId ถูกผูกเข้าไปเป็น AAD -- ข้อมูลที่ไม่ได้ถูกเข้ารหัสแต่ถูกคุ้มครองด้วย tag
 * ทำให้ ciphertext ของแถวหนึ่งย้ายไปวางในอีกแถวไม่ได้ ถ้ามีคนสลับก้อนข้อมูล
 * ระหว่างแถว การถอดรหัสจะล้มทันที ไม่ใช่คืนเลขบัตรของคนอื่นออกมาแนบกับคำขอผิดคน
 * ซึ่งเป็นความผิดพลาดที่ตรวจจับได้ยากมากถ้าปล่อยให้เกิด
 */
export function encryptIdCardValue(plaintext: string, rowId: string): Buffer {
  if (typeof plaintext !== 'string' || plaintext === '') {
    throw new Error('encryptIdCardValue: ข้อมูลที่จะเข้ารหัสต้องเป็นข้อความที่ไม่ว่าง');
  }
  if (typeof rowId !== 'string' || rowId === '') {
    throw new Error('encryptIdCardValue: ต้องระบุ rowId เพื่อผูกเป็น AAD');
  }

  const key = getKey();
  // nonce ต้องไม่ซ้ำกับที่เคยใช้กับกุญแจเดียวกันเด็ดขาด สุ่มใหม่ทุกครั้งที่เข้ารหัส
  // ห้ามใช้ตัวนับหรือค่าที่เดาได้ และห้ามนำ nonce เดิมมาใช้ซ้ำตอนแก้ข้อมูล
  const nonce = crypto.randomBytes(NONCE_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(rowId, 'utf8'));

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([nonce, ciphertext, tag]);
}

/**
 * ถอดรหัส
 *
 * โยน IdCardDecryptionError เมื่อก้อนข้อมูลสั้นเกินไป ถูกแก้ไข ถูกสลับข้ามแถว
 * หรือกุญแจไม่ตรง ผู้เรียกควรตอบ 500 กลาง ๆ และบันทึกเหตุไว้
 * ห้ามส่งข้อความของ error นี้ออกไปให้ผู้ใช้ เพราะไม่ได้ช่วยอะไรผู้ใช้
 * และเป็นการบอกผู้โจมตีว่าเขาไปได้ถึงขั้นไหนแล้ว
 */
export function decryptIdCardValue(blob: Buffer, rowId: string): string {
  if (!Buffer.isBuffer(blob)) {
    throw new IdCardDecryptionError('ข้อมูลที่ส่งมาถอดรหัสไม่ใช่ Buffer');
  }
  if (blob.length <= NONCE_BYTES + TAG_BYTES) {
    throw new IdCardDecryptionError('ก้อนข้อมูลสั้นเกินกว่าจะเป็น ciphertext ที่ถูกต้อง');
  }
  if (typeof rowId !== 'string' || rowId === '') {
    throw new IdCardDecryptionError('ต้องระบุ rowId เพื่อตรวจ AAD');
  }

  const nonce = blob.subarray(0, NONCE_BYTES);
  const ciphertext = blob.subarray(NONCE_BYTES, blob.length - TAG_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), nonce, {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(rowId, 'utf8'));
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (err) {
    // บันทึกไว้ให้ตามเรื่องได้ว่าเกิดอะไรขึ้นจริง ๆ
    // ถ้าไม่บันทึก ความล้มเหลวจากการตั้งค่าผิด ฐานข้อมูลเสียหาย หรือถูกแก้ไขโดยเจตนา
    // จะแยกจากกันไม่ออกเลย เพราะทุกกรณีโผล่ออกไปเป็นข้อความกลาง ๆ ก้อนเดียวกัน
    //
    // บันทึกเฉพาะสิ่งที่ช่วยวินิจฉัย คือแถวไหน ก้อนยาวเท่าไร และเป็น error ชนิดใด
    // ห้ามบันทึกเนื้อข้อมูล เนื้อ ciphertext หรือกุญแจ
    console.error(
      '[idCardCipher] ถอดรหัสไม่สำเร็จ',
      JSON.stringify({
        rowId,
        blobBytes: blob.length,
        errorName: err instanceof Error ? err.name : typeof err,
      })
    );

    // ข้อความที่โยนออกไปเป็นข้อความเดียวเสมอ ไม่ว่าสาเหตุจะเป็นอะไร
    // ไม่ส่งข้อความของ error เดิมต่อ เพราะบางเส้นทางอาจเผลอเอาไปตอบผู้ใช้
    // และการบอกว่าล้มเพราะอะไรคือการบอกผู้โจมตีว่าเขาไปถึงขั้นไหนแล้ว
    throw new IdCardDecryptionError(
      'ถอดรหัสไม่สำเร็จ ข้อมูลอาจถูกแก้ไข ถูกสลับแถว หรือกุญแจไม่ตรง'
    );
  }
}
