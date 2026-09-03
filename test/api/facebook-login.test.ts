import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';

/**
 * เข้าสู่ระบบด้วย Facebook
 *
 * ฝั่งเว็บของ Facebook ให้มาแค่ access token ธรรมดา server จึงต้องถาม Graph API
 * ว่า token ใช้ได้ไหมและออกให้แอปเราหรือเปล่า เทสต์นี้ mock fetch ไว้ เพราะการ
 * ยิงจริงต้องมีแอปจริงและ token ที่หมดอายุเร็ว จึงทดสอบตรรกะรอบ ๆ แทน
 *
 * ข้อที่สำคัญที่สุดในไฟล์นี้คือกรณี app_id ไม่ตรง -- token ที่ออกให้แอปอื่น
 * เรียก /me ผ่านได้เหมือนกัน ถ้าไม่เทียบ app_id ใครมีแอป Facebook ของตัวเอง
 * ก็หลอกให้ผู้ใช้กดอนุญาตแล้วเอา token มาสวมบัญชีคนอื่นในระบบเราได้
 */

const h = vi.hoisted(() => {
  process.env.FACEBOOK_APP_ID = 'test-fb-app-id';
  process.env.FACEBOOK_APP_SECRET = 'test-fb-app-secret';
  return {
    state: {
      debug: { is_valid: true, app_id: 'test-fb-app-id' } as Record<string, unknown>,
      me: {} as Record<string, unknown> | null,
      networkError: false,
    },
  };
});

// แทน fetch ทั้งตัว ไม่ให้มีการต่อออกอินเทอร์เน็ตจริงระหว่างเทสต์
vi.stubGlobal('fetch', async (url: string) => {
  if (h.state.networkError) throw new Error('network down');
  const body = String(url).includes('/debug_token')
    ? { data: h.state.debug }
    : h.state.me;
  return { ok: true, json: async () => body } as unknown as Response;
});

// import หลังตั้ง env และ mock แล้วเท่านั้น
const request = (await import('supertest')).default;
const { app } = await import('../../server/index');
const { pool } = await import('../../server/db');

const SUFFIX = Date.now().toString(36);
const LINK_EMAIL = `fblink_${SUFFIX}@example.com`;
const LINK_USERNAME = `fblinkuser_${SUFFIX}`;
const NEW_EMAIL = `fbnew_${SUFFIX}@example.com`;
const SILHOUETTE_EMAIL = `fbsil_${SUFFIX}@example.com`;

function cookieHeader(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.join(';');
}

/** ค่าเริ่มต้นของแต่ละเคส -- token ใช้ได้ ออกให้แอปเรา และมีอีเมลครบ */
function validState(email: string, extra: Record<string, unknown> = {}) {
  h.state.networkError = false;
  h.state.debug = { is_valid: true, app_id: 'test-fb-app-id' };
  h.state.me = { id: 'fb_1234', name: 'ชื่อจาก Facebook', email, ...extra };
}

beforeAll(async () => {
  // บัญชีเดิมที่สมัครด้วย username และมีอีเมลตรงกับที่ Facebook จะส่งมา
  await pool.query(
    `INSERT INTO users (id, username, username_lower, email, display_name, role, provider, password_hash)
     VALUES ($1,$2,$3,$4,$5,'user','username',$6)`,
    [`usr_fblink_${SUFFIX}`, LINK_USERNAME, LINK_USERNAME.toLowerCase(), LINK_EMAIL, 'ชื่อเดิม', 'existing-hash']
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ANY($1) OR username_lower = $2', [
    [LINK_EMAIL, NEW_EMAIL, SILHOUETTE_EMAIL],
    LINK_USERNAME.toLowerCase(),
  ]);
  await pool.end();
});

describe('POST /api/auth/facebook', () => {
  test('ไม่ส่ง accessToken มา ต้อง 400', async () => {
    validState(NEW_EMAIL);
    const res = await request(app).post('/api/auth/facebook').send({});
    expect(res.status).toBe(400);
  });

  test('token ใช้ไม่ได้ ต้องปฏิเสธ', async () => {
    validState(NEW_EMAIL);
    h.state.debug = { is_valid: false, app_id: 'test-fb-app-id' };

    const res = await request(app).post('/api/auth/facebook').send({ accessToken: 'bad' });
    expect(res.status).toBe(401);
  });

  test('token ออกให้แอปอื่น ต้องปฏิเสธ ถึงแม้ /me จะตอบข้อมูลมาครบ', async () => {
    validState(NEW_EMAIL);
    h.state.debug = { is_valid: true, app_id: 'someone-elses-app' };

    const res = await request(app).post('/api/auth/facebook').send({ accessToken: 'stolen' });
    expect(res.status).toBe(401);

    // ต้องไม่มีบัญชีใหม่โผล่ขึ้นมาจาก token ของแอปอื่น
    const { rows } = await pool.query('SELECT 1 FROM users WHERE email = $1', [NEW_EMAIL]);
    expect(rows).toHaveLength(0);
  });

  test('บัญชีไม่มีอีเมล ต้อง 400 พร้อมบอกวิธีแก้', async () => {
    validState(NEW_EMAIL);
    h.state.me = { id: 'fb_1234', name: 'ไม่มีอีเมล' };

    const res = await request(app).post('/api/auth/facebook').send({ accessToken: 'ok' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/อีเมล/);
  });

  test('ติดต่อ Facebook ไม่ได้ ต้อง 503 ไม่ใช่ 401', async () => {
    validState(NEW_EMAIL);
    h.state.networkError = true;

    const res = await request(app).post('/api/auth/facebook').send({ accessToken: 'ok' });
    expect(res.status).toBe(503);
  });

  test('อีเมลตรงกับบัญชีเดิม ต้องผูกให้ ไม่สร้างบัญชีใหม่ และคง password_hash เดิม', async () => {
    validState(LINK_EMAIL, { picture: { data: { url: 'https://example.com/p.png' } } });

    const res = await request(app).post('/api/auth/facebook').send({ accessToken: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.profile.username).toBe(LINK_USERNAME);
    expect(cookieHeader(res)).toMatch(/token=/i);

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [LINK_EMAIL]);
    expect(rows).toHaveLength(1);
    // ไม่แตะของเดิม เจ้าของยังเข้าด้วยรหัสผ่านได้เหมือนเดิม
    expect(rows[0].password_hash).toBe('existing-hash');
    expect(rows[0].username).toBe(LINK_USERNAME);
    expect(rows[0].display_name).toBe('ชื่อเดิม');
    expect(rows[0].provider).toBe('username');
  });

  test('อีเมลใหม่ ต้องสร้างบัญชี provider=facebook ที่ไม่มีรหัสผ่าน', async () => {
    validState(NEW_EMAIL, {
      name: 'ผู้ใช้ใหม่',
      picture: { data: { url: 'https://example.com/n.png' } },
    });

    const res = await request(app).post('/api/auth/facebook').send({ accessToken: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.profile.provider).toBe('facebook');

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [NEW_EMAIL]);
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe('facebook');
    expect(rows[0].password_hash).toBeNull();
    expect(rows[0].photo_url).toBe('https://example.com/n.png');
  });

  test('รูปเริ่มต้นของ Facebook (silhouette) ไม่ถูกเก็บเป็นรูปโปรไฟล์', async () => {
    validState(SILHOUETTE_EMAIL, {
      name: 'ยังไม่ได้ตั้งรูป',
      picture: { data: { url: 'https://example.com/default.png', is_silhouette: true } },
    });

    const res = await request(app).post('/api/auth/facebook').send({ accessToken: 'ok' });
    expect(res.status).toBe(200);

    const { rows } = await pool.query('SELECT photo_url FROM users WHERE email = $1', [
      SILHOUETTE_EMAIL,
    ]);
    // รูปแทนค่าเริ่มต้นของ Facebook ไม่ใช่รูปที่ผู้ใช้ตั้งเอง จึงไม่ควรถูกเก็บ
    expect(rows[0].photo_url).toBeNull();
  });
});
