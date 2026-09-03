import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';

/**
 * เข้าสู่ระบบด้วย Google (flow แบบ ID token)
 *
 * server เป็นคน verify ID token แล้วออก cookie ของระบบเราเอง เทสต์นี้ mock ตัว
 * verify ของ google-auth-library ไว้ เพราะ verify จริงต้องต่อ Google และต้องมี
 * token จริงที่หมดอายุเร็ว จึงทดสอบตรรกะรอบ ๆ แทน: ผูกบัญชีเมื่ออีเมลตรง สร้าง
 * บัญชีใหม่เมื่อไม่ตรง และปฏิเสธอีเมลที่ยังไม่ยืนยัน
 */

const h = vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  return { state: { payload: null as Record<string, unknown> | null, shouldThrow: false } };
});

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    async verifyIdToken() {
      if (h.state.shouldThrow) throw new Error('invalid token');
      return { getPayload: () => h.state.payload };
    }
  },
}));

// import หลังตั้ง env และ mock แล้วเท่านั้น
const request = (await import('supertest')).default;
const { app } = await import('../../server/index');
const { pool } = await import('../../server/db');

const SUFFIX = Date.now().toString(36);
const LINK_EMAIL = `linkme_${SUFFIX}@example.com`;
const LINK_USERNAME = `linkuser_${SUFFIX}`;
const NEW_EMAIL = `brandnew_${SUFFIX}@example.com`;

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.join(';');
}

beforeAll(async () => {
  // บัญชีเดิมที่สมัครด้วย username และมีอีเมลตรงกับที่ Google จะส่งมา
  await pool.query(
    `INSERT INTO users (id, username, username_lower, email, display_name, role, provider, password_hash)
     VALUES ($1,$2,$3,$4,$5,'user','username',$6)`,
    [`usr_link_${SUFFIX}`, LINK_USERNAME, LINK_USERNAME.toLowerCase(), LINK_EMAIL, 'ชื่อเดิม', 'existing-hash']
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ANY($1) OR username_lower = $2', [
    [LINK_EMAIL, NEW_EMAIL],
    LINK_USERNAME.toLowerCase(),
  ]);
  await pool.end();
});

describe('POST /api/auth/google', () => {
  test('อีเมลยังไม่ยืนยัน ต้องปฏิเสธ', async () => {
    h.state.shouldThrow = false;
    h.state.payload = { email: NEW_EMAIL, email_verified: false, name: 'x' };

    const res = await request(app).post('/api/auth/google').send({ credential: 'fake' });
    expect(res.status).toBe(401);
  });

  test('token ยืนยันไม่ผ่าน ต้องปฏิเสธ', async () => {
    h.state.shouldThrow = true;
    const res = await request(app).post('/api/auth/google').send({ credential: 'bad' });
    expect(res.status).toBe(401);
  });

  test('ไม่ส่ง credential มา ต้อง 400', async () => {
    h.state.shouldThrow = false;
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
  });

  test('อีเมลตรงกับบัญชีเดิม ต้องผูกให้ ไม่สร้างบัญชีใหม่ และคง password_hash เดิม', async () => {
    h.state.shouldThrow = false;
    h.state.payload = {
      email: LINK_EMAIL,
      email_verified: true,
      name: 'ชื่อจาก Google',
      picture: 'https://example.com/p.png',
    };

    const res = await request(app).post('/api/auth/google').send({ credential: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.profile.username).toBe(LINK_USERNAME);
    // ออก cookie session ให้จริง
    expect(cookieHeader(res)).toMatch(/token=/i);

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [LINK_EMAIL]);
    expect(rows).toHaveLength(1);
    // ไม่แตะ password_hash และ username เดิม เจ้าของยังเข้าด้วยรหัสผ่านได้
    expect(rows[0].password_hash).toBe('existing-hash');
    expect(rows[0].username).toBe(LINK_USERNAME);
    // display_name เดิมไม่ว่าง จึงไม่ถูกทับ
    expect(rows[0].display_name).toBe('ชื่อเดิม');
  });

  test('อีเมลใหม่ ต้องสร้างบัญชี provider=google ที่ไม่มีรหัสผ่าน', async () => {
    h.state.shouldThrow = false;
    h.state.payload = {
      email: NEW_EMAIL,
      email_verified: true,
      name: 'ผู้ใช้ใหม่',
      picture: 'https://example.com/n.png',
    };

    const res = await request(app).post('/api/auth/google').send({ credential: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.profile.provider).toBe('google');

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [NEW_EMAIL]);
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe('google');
    expect(rows[0].password_hash).toBeNull();
    expect(rows[0].photo_url).toBe('https://example.com/n.png');
  });
});
