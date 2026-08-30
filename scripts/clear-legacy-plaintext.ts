import 'dotenv/config';
import { createHash } from 'node:crypto';
import { pool } from '../server/db.js';
import { decryptIdCardValue } from '../server/security/idCardCipher.js';

/**
 * ล้างเลขบัตรและรูปบัตรที่ยังเป็นข้อความธรรมดาออกจากฐานข้อมูล
 *
 * แถวเหล่านี้ถูกเข้ารหัสไปแล้ว แต่คอลัมน์ข้อความธรรมดายังมีค่าเดิมค้างอยู่
 * เพราะสคริปต์แปลงข้อมูลรอบแรกเลือกไม่ลบทิ้งทันที เผื่อต้องเทียบย้อนกลับ
 *
 * ตรวจก่อนล้างเสมอว่าถอดรหัสกลับมาแล้วตรงกับข้อความธรรมดาที่กำลังจะลบ
 * ถ้ามีแถวไหนไม่ตรง จะหยุดทั้งหมดโดยไม่ลบอะไรเลย เพราะแปลว่าฉบับเข้ารหัส
 * ไม่ใช่ข้อมูลเดียวกันกับของเดิม การลบข้อความธรรมดาจะทำให้ข้อมูลจริงหาย
 *
 * ตรวจซ้ำหลังล้างอีกรอบ ว่า ciphertext ยังถอดได้ค่าเดิมเป๊ะ
 *
 *   npx tsx scripts/clear-legacy-plaintext.ts          ตรวจอย่างเดียว ไม่แก้
 *   npx tsx scripts/clear-legacy-plaintext.ts --apply  ตรวจแล้วล้างจริง
 */

const APPLY = process.argv.includes('--apply');

const md5 = (v: string) => createHash('md5').update(v, 'utf8').digest('hex');

/** ย่อค่าให้พอเทียบได้โดยไม่พิมพ์ข้อมูลจริงลง log */
const fingerprint = (v: string | null) =>
  v === null ? 'NULL' : `len=${v.length} md5=${md5(v).slice(0, 12)}`;

interface Row {
  id: string;
  farm_name: string;
  farmer_id_card_number: string | null;
  farmer_id_card_photo: string | null;
  farmer_id_card_ciphertext: Buffer | null;
  farmer_id_card_photo_ciphertext: Buffer | null;
}

async function main() {
  const { rows } = await pool.query<Row>(
    `SELECT id, farm_name,
            farmer_id_card_number, farmer_id_card_photo,
            farmer_id_card_ciphertext, farmer_id_card_photo_ciphertext
       FROM farm_requests
      WHERE farmer_id_card_number IS NOT NULL
         OR farmer_id_card_photo IS NOT NULL
      ORDER BY id`
  );

  if (rows.length === 0) {
    console.log('ไม่มีแถวไหนเหลือข้อความธรรมดาแล้ว ไม่ต้องทำอะไร');
    return;
  }

  console.log(`พบ ${rows.length} แถวที่ยังมีข้อความธรรมดา\n`);

  const problems: string[] = [];
  const expected = new Map<string, { id: string | null; photo: string | null }>();

  for (const r of rows) {
    console.log(`  ${r.id}  ${r.farm_name}`);

    const checks: [string, string | null, Buffer | null][] = [
      ['เลขบัตร', r.farmer_id_card_number, r.farmer_id_card_ciphertext],
      ['รูปบัตร', r.farmer_id_card_photo, r.farmer_id_card_photo_ciphertext],
    ];

    const keep: { id: string | null; photo: string | null } = { id: null, photo: null };

    for (const [label, plain, cipher] of checks) {
      if (plain === null) {
        console.log(`    ${label}  ไม่มีข้อความธรรมดา ข้าม`);
        continue;
      }

      if (cipher === null) {
        problems.push(`${r.id} ${label}: มีข้อความธรรมดาแต่ไม่มีฉบับเข้ารหัส`);
        console.log(`    ${label}  ไม่มีฉบับเข้ารหัส -- หยุด`);
        continue;
      }

      // AAD ผูกกับ id ของแถว การถอดรหัสจึงล้มถ้าเอา ciphertext ของแถวอื่นมาใส่
      let decrypted: string;
      try {
        decrypted = decryptIdCardValue(cipher, r.id);
      } catch (err) {
        problems.push(`${r.id} ${label}: ถอดรหัสไม่สำเร็จ ${(err as Error).message}`);
        console.log(`    ${label}  ถอดรหัสไม่สำเร็จ -- หยุด`);
        continue;
      }

      if (decrypted !== plain) {
        problems.push(`${r.id} ${label}: ถอดรหัสแล้วไม่ตรงกับข้อความธรรมดา`);
        console.log(`    ${label}  ไม่ตรงกัน  ธรรมดา ${fingerprint(plain)}  ถอดได้ ${fingerprint(decrypted)}`);
        continue;
      }

      console.log(`    ${label}  ตรงกัน  ${fingerprint(plain)}`);
      if (label === 'เลขบัตร') keep.id = decrypted;
      else keep.photo = decrypted;
    }

    expected.set(r.id, keep);
  }

  if (problems.length > 0) {
    console.error(`\nไม่ล้างอะไรเลย เพราะเจอปัญหา ${problems.length} จุด`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nทุกแถวถอดรหัสกลับมาตรงกับข้อความธรรมดาครบ');

  if (!APPLY) {
    console.log('โหมดตรวจอย่างเดียว ยังไม่ล้าง ใส่ --apply เพื่อล้างจริง');
    return;
  }

  const ids = rows.map((r) => r.id);
  const res = await pool.query(
    `UPDATE farm_requests
        SET farmer_id_card_number = NULL,
            farmer_id_card_photo  = NULL
      WHERE id = ANY($1)`,
    [ids]
  );
  console.log(`\nล้างข้อความธรรมดาแล้ว ${res.rowCount} แถว`);

  // ตรวจซ้ำหลังล้าง -- ciphertext ต้องยังถอดได้ค่าเดิมเป๊ะ
  const after = await pool.query<Row>(
    `SELECT id, farm_name, farmer_id_card_number, farmer_id_card_photo,
            farmer_id_card_ciphertext, farmer_id_card_photo_ciphertext
       FROM farm_requests WHERE id = ANY($1) ORDER BY id`,
    [ids]
  );

  let ok = true;
  for (const r of after.rows) {
    const want = expected.get(r.id)!;

    if (r.farmer_id_card_number !== null || r.farmer_id_card_photo !== null) {
      console.error(`  ${r.id}  ยังเหลือข้อความธรรมดาอยู่`);
      ok = false;
      continue;
    }

    const gotId = r.farmer_id_card_ciphertext
      ? decryptIdCardValue(r.farmer_id_card_ciphertext, r.id)
      : null;
    const gotPhoto = r.farmer_id_card_photo_ciphertext
      ? decryptIdCardValue(r.farmer_id_card_photo_ciphertext, r.id)
      : null;

    const idOk = want.id === null || gotId === want.id;
    const photoOk = want.photo === null || gotPhoto === want.photo;

    console.log(
      `  ${r.id}  ข้อความธรรมดาว่างแล้ว  เลขบัตร ${idOk ? 'ตรง' : 'ไม่ตรง'}  รูปบัตร ${photoOk ? 'ตรง' : 'ไม่ตรง'}`
    );
    if (!idOk || !photoOk) ok = false;
  }

  if (!ok) {
    console.error('\nมีแถวที่ตรวจซ้ำแล้วไม่ผ่าน กู้จากไฟล์สำรองทันที');
    process.exitCode = 1;
    return;
  }

  const left = await pool.query(
    `SELECT count(*)::int AS n FROM farm_requests
      WHERE farmer_id_card_number IS NOT NULL OR farmer_id_card_photo IS NOT NULL`
  );
  console.log(`\nทั้งตารางเหลือแถวที่มีข้อความธรรมดา ${left.rows[0].n} แถว`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
