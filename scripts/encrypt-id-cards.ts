/**
 * เข้ารหัสเลขบัตรประชาชนและรูปถ่ายบัตรที่ยังเป็นข้อความธรรมดาในตาราง farm_requests
 *
 *   npm run encrypt:id-cards            ลองดูเฉย ๆ ไม่เขียนอะไร (ค่าเริ่มต้น)
 *   npm run encrypt:id-cards -- --apply เขียนจริง
 *
 * ต้องรันหลัง migration 006 และต้องรันให้ครบก่อนจะรัน
 * scripts/sql/007_drop_legacy_plaintext.sql ซึ่งเป็นตัวลบคอลัมน์ข้อความธรรมดาทิ้ง
 *
 * ทำไมต้องเป็นสคริปต์ ไม่ใช่ SQL ล้วน
 * เพราะกุญแจอยู่ในโปรเซส Node เท่านั้น การเข้ารหัสจึงเกิดที่นี่ไม่ใช่ในฐานข้อมูล
 *
 * ความปลอดภัยของสคริปต์นี้
 *
 *   ทำงานทั้งหมดใน transaction เดียว
 *   ก่อน COMMIT จะอ่านสิ่งที่เพิ่งเขียนกลับขึ้นมาถอดรหัส แล้วเทียบกับค่าเดิม
 *   ที่ถืออยู่ในหน่วยความจำแบบตัวต่อตัว ถ้ามีสักแถวที่ไม่ตรง จะ ROLLBACK ทั้งก้อน
 *   ไม่ปล่อยให้เกิดสภาพที่คอลัมน์ ciphertext มีค่าแต่ถอดกลับไม่ได้
 *
 *   ไม่แตะคอลัมน์ข้อความธรรมดาเลย การลบเป็นหน้าที่ของ 007
 *   ถ้าสคริปต์นี้ผิดพลาด ข้อมูลต้นฉบับยังอยู่ครบ
 *
 *   ข้ามแถวที่มี ciphertext อยู่แล้ว จึงรันซ้ำได้ปลอดภัย
 */

import 'dotenv/config';
import { pool } from '../server/db.js';
import {
  assertIdCardEncryptionKey,
  encryptIdCardValue,
  decryptIdCardValue,
} from '../server/security/idCardCipher.js';
import { isValidThaiNationalId, maskThaiNationalId } from '../src/shared/thaiNationalId.js';

const APPLY = process.argv.includes('--apply');

interface Row {
  id: string;
  farmer_id_card_number: string | null;
  farmer_id_card_photo: string | null;
  has_number_cipher: boolean;
  has_photo_cipher: boolean;
}

async function main() {
  assertIdCardEncryptionKey();

  const client = await pool.connect();

  try {
    const { rows } = await client.query<Row>(
      `SELECT id,
              farmer_id_card_number,
              farmer_id_card_photo,
              (farmer_id_card_ciphertext IS NOT NULL)       AS has_number_cipher,
              (farmer_id_card_photo_ciphertext IS NOT NULL) AS has_photo_cipher
         FROM farm_requests
        ORDER BY created_at ASC`
    );

    const todo = rows.filter(
      (r) =>
        (r.farmer_id_card_number && !r.has_number_cipher) ||
        (r.farmer_id_card_photo && !r.has_photo_cipher)
    );

    console.log(`คำขอทั้งหมด ${rows.length} แถว  ต้องเข้ารหัส ${todo.length} แถว`);

    if (todo.length === 0) {
      console.log('ไม่มีอะไรต้องทำ');
      return;
    }

    for (const r of todo) {
      const parts: string[] = [];
      if (r.farmer_id_card_number && !r.has_number_cipher) {
        const ok = isValidThaiNationalId(r.farmer_id_card_number);
        parts.push(`เลขบัตร ${maskThaiNationalId(r.farmer_id_card_number)}${ok ? '' : ' (checksum ไม่ผ่าน)'}`);
      }
      if (r.farmer_id_card_photo && !r.has_photo_cipher) {
        parts.push(`รูปบัตร ${Math.round(r.farmer_id_card_photo.length / 1024)} KB`);
      }
      console.log(`  ${r.id}  ${parts.join('  ')}`);
    }

    if (!APPLY) {
      console.log('\nโหมดลองดูเฉย ๆ ไม่ได้เขียนอะไรลงฐานข้อมูล');
      console.log('ถ้าตรวจแล้วถูกต้อง ให้รันซ้ำด้วย  npm run encrypt:id-cards -- --apply');
      return;
    }

    await client.query('BEGIN');

    for (const r of todo) {
      // rowId ที่ผูกเป็น AAD คือ primary key ของแถวนี้
      // ค่านี้ไม่เคยถูกแก้หลังสร้างแถว (เป็น PK และไม่มี UPDATE ไหนแตะ)
      // ถ้าวันหนึ่งมีใครทำให้ id เปลี่ยนได้ ข้อมูลที่เข้ารหัสไว้จะถอดกลับไม่ได้
      const sets: string[] = [];
      const values: unknown[] = [r.id];

      if (r.farmer_id_card_number && !r.has_number_cipher) {
        values.push(encryptIdCardValue(r.farmer_id_card_number, r.id));
        sets.push(`farmer_id_card_ciphertext = $${values.length}`);

        values.push(r.farmer_id_card_number.slice(-1));
        sets.push(`farmer_id_card_check_digit = $${values.length}`);
      }

      if (r.farmer_id_card_photo && !r.has_photo_cipher) {
        values.push(encryptIdCardValue(r.farmer_id_card_photo, r.id));
        sets.push(`farmer_id_card_photo_ciphertext = $${values.length}`);
      }

      await client.query(`UPDATE farm_requests SET ${sets.join(', ')} WHERE id = $1`, values);
    }

    // อ่านกลับขึ้นมาถอดรหัสเทียบกับค่าเดิมก่อน COMMIT
    // นี่คือด่านที่ทำให้มั่นใจได้ว่าไม่มีแถวไหนเข้ารหัสแล้วถอดกลับไม่ได้
    console.log('\nตรวจสอบด้วยการถอดรหัสกลับมาเทียบกับค่าเดิม');

    const ids = todo.map((r) => r.id);
    const { rows: written } = await client.query<{
      id: string;
      farmer_id_card_ciphertext: Buffer | null;
      farmer_id_card_photo_ciphertext: Buffer | null;
      farmer_id_card_check_digit: string | null;
    }>(
      `SELECT id, farmer_id_card_ciphertext, farmer_id_card_photo_ciphertext, farmer_id_card_check_digit
         FROM farm_requests WHERE id = ANY($1)`,
      [ids]
    );

    const byId = new Map(written.map((w) => [w.id, w]));
    let checked = 0;

    for (const r of todo) {
      const w = byId.get(r.id);
      if (!w) throw new Error(`อ่านแถว ${r.id} กลับมาไม่ได้`);

      if (r.farmer_id_card_number && !r.has_number_cipher) {
        if (!w.farmer_id_card_ciphertext) throw new Error(`แถว ${r.id} ไม่มี ciphertext ของเลขบัตร`);

        const back = decryptIdCardValue(w.farmer_id_card_ciphertext, r.id);
        if (back !== r.farmer_id_card_number) {
          throw new Error(`แถว ${r.id} เลขบัตรที่ถอดกลับมาไม่ตรงกับค่าเดิม`);
        }
        if (w.farmer_id_card_check_digit !== r.farmer_id_card_number.slice(-1)) {
          throw new Error(`แถว ${r.id} หลักตรวจสอบที่เก็บไว้ไม่ตรงกับเลขจริง`);
        }
        checked += 1;
      }

      if (r.farmer_id_card_photo && !r.has_photo_cipher) {
        if (!w.farmer_id_card_photo_ciphertext) throw new Error(`แถว ${r.id} ไม่มี ciphertext ของรูปบัตร`);

        const back = decryptIdCardValue(w.farmer_id_card_photo_ciphertext, r.id);
        if (back !== r.farmer_id_card_photo) {
          throw new Error(`แถว ${r.id} รูปบัตรที่ถอดกลับมาไม่ตรงกับค่าเดิม`);
        }
        checked += 1;
      }

      console.log(`  ตรงกัน  ${r.id}`);
    }

    // ด่านสุดท้าย ยืนยันว่า ciphertext ของแถวหนึ่งเอาไปถอดในนามอีกแถวไม่ได้จริง
    // ถ้าด่านนี้ผ่าน แปลว่า AAD ผูกกับ id ของแถวได้ผลจริงกับข้อมูลชุดนี้
    const withCipher = written.filter((w) => w.farmer_id_card_ciphertext);
    if (withCipher.length >= 2) {
      let swapRejected = false;
      try {
        decryptIdCardValue(withCipher[0].farmer_id_card_ciphertext as Buffer, withCipher[1].id);
      } catch {
        swapRejected = true;
      }
      if (!swapRejected) {
        throw new Error('ciphertext ของแถวหนึ่งถอดในนามอีกแถวได้ AAD ไม่ทำงาน');
      }
      console.log('  ตรวจแล้ว ciphertext สลับข้ามแถวไม่ได้');
    }

    await client.query('COMMIT');
    console.log(`\nเข้ารหัสสำเร็จ ${todo.length} แถว ตรวจค่าตรงกันครบ ${checked} รายการ`);
    console.log('คอลัมน์ข้อความธรรมดายังอยู่ครบ การลบเป็นหน้าที่ของ scripts/sql/007_drop_legacy_plaintext.sql');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nล้มเหลว ยกเลิกการเปลี่ยนแปลงทั้งหมดแล้ว ข้อมูลเดิมยังอยู่ครบ');
    console.error(`   ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
