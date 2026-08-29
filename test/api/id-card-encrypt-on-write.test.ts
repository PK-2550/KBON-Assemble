import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';
import { decryptIdCardValue } from '../../server/security/idCardCipher';

/**
 * ข้อมูลบัตรประชาชนต้องถูกเข้ารหัสตั้งแต่ตอนเขียนลงฐานข้อมูล
 *
 * ชุดทดสอบก่อนหน้าคุมแค่ขาออก คือคำตอบของ API ต้องไม่มีเลขบัตรหลุดออกไป
 * แต่ไม่มีอะไรคุมขาเข้าเลย คำขอที่ยื่นใหม่จึงยังถูกเขียนเป็นข้อความธรรมดา
 * ทั้งที่ทั้งระบบสร้างมาเพื่อไม่ให้มีข้อความธรรมดาอยู่ในฐานข้อมูล
 *
 * ชุดนี้ตรวจที่ตัวฐานข้อมูลตรง ๆ ไม่ได้ตรวจผ่านคำตอบของ API
 * เพราะสิ่งที่ต้องพิสูจน์คือ "เก็บอะไรไว้จริง" ไม่ใช่ "ตอบอะไรกลับไป"
 */

const SUFFIX = Date.now().toString(36);
const OWNER = `encwrite_owner_${SUFFIX}`;
const PASS = 'TestPassword12345';

const ID_CARD = '1229900341828';
const ID_PHOTO = 'data:image/jpeg;base64,RU5DUllQVF9PTl9XUklURV9URVNU';

let ownerCookie = '';
const createdIds: string[] = [];

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

async function readRow(id: string) {
  const { rows } = await pool.query(
    `SELECT farmer_id_card_number, farmer_id_card_photo,
            farmer_id_card_ciphertext, farmer_id_card_photo_ciphertext,
            farmer_id_card_check_digit
       FROM farm_requests WHERE id = $1`,
    [id]
  );
  return rows[0];
}

beforeAll(async () => {
  await request(app).post('/api/auth/register').send({ username: OWNER, password: PASS });
  ownerCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: OWNER, password: PASS })
  );
});

afterAll(async () => {
  if (createdIds.length) {
    await pool.query('DELETE FROM farm_requests WHERE id = ANY($1)', [createdIds]);
  }
  await pool.query('DELETE FROM users WHERE username_lower = $1', [OWNER.toLowerCase()]);
  await pool.end();
});

describe('เข้ารหัสตั้งแต่ตอนเขียน', () => {
  test('คำขอที่ยื่นใหม่ ต้องมี ciphertext และต้องไม่มีข้อความธรรมดาเหลืออยู่', async () => {
    const res = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        farmName: `สวนทดสอบเข้ารหัสขาเข้า ${SUFFIX}`,
        province: 'จันทบุรี',
        farmerFullName: 'นายทดสอบ ขาเข้า',
        farmerIdCardNumber: ID_CARD,
        farmerIdCardPhoto: ID_PHOTO,
        farmerIdCardFileType: 'image',
      });

    expect(res.status).toBe(201);
    const id = res.body.request.id;
    createdIds.push(id);

    const row = await readRow(id);

    // สิ่งที่ต้องมี
    expect(row.farmer_id_card_ciphertext).not.toBeNull();
    expect(row.farmer_id_card_photo_ciphertext).not.toBeNull();
    expect(row.farmer_id_card_check_digit).toBe(ID_CARD.slice(-1));

    // สิ่งที่ต้องไม่มี -- ถ้าข้อความธรรมดายังอยู่ แปลว่า 007 จะลบข้อมูลจริงทิ้ง
    expect(row.farmer_id_card_number).toBeNull();
    expect(row.farmer_id_card_photo).toBeNull();
  });

  test('ค่าที่เข้ารหัสไว้ถอดกลับได้ตรงกับที่ยื่นเข้ามา', async () => {
    const id = createdIds[0];
    const row = await readRow(id);

    expect(decryptIdCardValue(row.farmer_id_card_ciphertext, id)).toBe(ID_CARD);
    expect(decryptIdCardValue(row.farmer_id_card_photo_ciphertext, id)).toBe(ID_PHOTO);
  });

  test('ส่งแก้ไขคำขอเดิมโดยไม่แนบบัตรมาใหม่ ข้อมูลเดิมต้องไม่หาย', async () => {
    const id = createdIds[0];

    const res = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        id,
        farmName: `สวนทดสอบเข้ารหัสขาเข้า ${SUFFIX} แก้ไขแล้ว`,
        province: 'จันทบุรี',
        updateNotes: 'แก้ชื่อสวนอย่างเดียว ไม่ได้แตะข้อมูลบัตร',
      });

    expect(res.status).toBe(201);

    const row = await readRow(id);
    expect(row.farmer_id_card_ciphertext).not.toBeNull();
    expect(decryptIdCardValue(row.farmer_id_card_ciphertext, id)).toBe(ID_CARD);
    expect(row.farmer_id_card_number).toBeNull();
  });

  test('ส่งแก้ไขพร้อมเลขบัตรใหม่ ต้องเข้ารหัสค่าใหม่ทับ ไม่ใช่เก็บดิบ', async () => {
    const id = createdIds[0];
    const NEW_ID = '3210400192848';

    const res = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({
        id,
        farmName: `สวนทดสอบเข้ารหัสขาเข้า ${SUFFIX} แก้เลขบัตร`,
        province: 'จันทบุรี',
        farmerIdCardNumber: NEW_ID,
      });

    expect(res.status).toBe(201);

    const row = await readRow(id);
    expect(row.farmer_id_card_number).toBeNull();
    expect(decryptIdCardValue(row.farmer_id_card_ciphertext, id)).toBe(NEW_ID);
    expect(row.farmer_id_card_check_digit).toBe(NEW_ID.slice(-1));
  });

  test('คำขอที่ไม่ได้แนบข้อมูลบัตรเลย ต้องไม่พังและไม่มีคอลัมน์ไหนถูกเติมมั่ว', async () => {
    const res = await request(app)
      .post('/api/farm-requests')
      .set('Cookie', ownerCookie)
      .send({ farmName: `สวนไม่มีบัตร ${SUFFIX}`, province: 'ระยอง' });

    expect(res.status).toBe(201);
    const id = res.body.request.id;
    createdIds.push(id);

    const row = await readRow(id);
    expect(row.farmer_id_card_ciphertext).toBeNull();
    expect(row.farmer_id_card_photo_ciphertext).toBeNull();
    expect(row.farmer_id_card_number).toBeNull();
    expect(row.farmer_id_card_check_digit).toBeNull();
  });
});
