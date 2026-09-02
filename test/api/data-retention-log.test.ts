import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { pool } from '../../server/db';
import { RETENTION_DAYS } from '../../server/jobs/purgeRejectedPii';

/**
 * รายงานการล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธ
 *
 * 013 สร้างตารางบันทึกไว้เพื่อให้ตอบได้ว่าข้อมูลหายไปเพราะถูกล้างตามกำหนด
 * ไม่ใช่หายเพราะบั๊ก แต่บันทึกนั้นอ่านได้ทาง SQL ทางเดียว ซึ่งแปลว่าเวลามีคน
 * ถามจริง ๆ ก็ยังตอบไม่ได้อยู่ดี
 *
 * และรายงานที่มีแต่ประวัติยังไม่พอ ตารางว่างเปล่าตีความได้สองแบบ คืองานล้าง
 * ทำงานปกติแต่ยังไม่มีอะไรถึงกำหนด กับงานล้างไม่เคยทำงานเลย ซึ่งต่างกันมาก
 * จึงต้องบอกจำนวนที่เลยกำหนดแล้วแต่ยังไม่ถูกล้างด้วย
 */

const SUFFIX = Date.now().toString(36);
const ADMIN = `retlog_admin_${SUFFIX}`;
const OTHER = `retlog_other_${SUFFIX}`;
const PASS = 'TestPassword12345';
const FARM_NAME = `สวนทดสอบบันทึกการล้าง ${SUFFIX}`;

let adminCookie = '';
let otherCookie = '';

/** id ของคำขอที่ชุดนี้สร้าง ใช้ลบทิ้งทั้งหมดใน afterAll */
const requestIds: string[] = [];

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

/**
 * สร้างคำขอที่ถูกปฏิเสธไว้แล้ว โดยคุมวันที่ปฏิเสธได้
 *
 * เขียนลงตารางตรง ๆ เพราะต้องย้อนวันที่ให้เลยกำหนดเก็บ ซึ่งเดินผ่านเส้นทางปกติ
 * ทำไม่ได้ ส่วนตัวที่ต้องพิสูจน์คือการนับกับการรายงาน ไม่ใช่การยื่นคำขอ
 */
async function makeRejected(daysAgo: number, withPii: boolean): Promise<string> {
  const id = `req_retlog_${SUFFIX}_${requestIds.length}`;
  await pool.query(
    `INSERT INTO farm_requests
       (id, user_id, farm_name, province, status, reviewed_at, created_at,
        farmer_full_name, payload)
     VALUES ($1, $2, $3, 'จันทบุรี', 'rejected',
             now() - make_interval(days => $4::int),
             now() - make_interval(days => $4::int),
             $5, $6::jsonb)`,
    [
      id,
      `user_${SUFFIX}`,
      FARM_NAME,
      daysAgo,
      withPii ? 'นายทดสอบ ข้อมูลส่วนตัว' : null,
      withPii ? JSON.stringify({ note: 'x' }) : '{}',
    ]
  );
  requestIds.push(id);
  return id;
}

beforeAll(async () => {
  for (const u of [ADMIN, OTHER]) {
    await request(app).post('/api/auth/register').send({ username: u, password: PASS });
  }
  await pool.query("UPDATE users SET role='admin' WHERE username_lower=$1", [ADMIN.toLowerCase()]);

  adminCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: ADMIN, password: PASS })
  );
  otherCookie = cookieOf(
    await request(app).post('/api/auth/login').send({ username: OTHER, password: PASS })
  );

  // เลยกำหนดแล้วและยังถือข้อมูลส่วนตัวอยู่ -- งานล้างควรจัดการไปแล้ว
  await makeRejected(RETENTION_DAYS + 10, true);

  // ยังไม่ถึงกำหนด ยังถือข้อมูลอยู่ตามปกติ
  await makeRejected(10, true);

  // ถูกล้างไปแล้ว ไม่ควรถูกนับซ้ำ
  const purged = await makeRejected(RETENTION_DAYS + 30, false);
  await pool.query(
    `INSERT INTO data_retention_log
       (farm_request_id, fields_cleared, rejected_at, purged_at, trigger_source)
     VALUES ($1, $2::text[], now() - make_interval(days => 30), now() - make_interval(days => 1), 'auto')`,
    [purged, ['farmer_full_name', 'payload']]
  );
});

afterAll(async () => {
  if (requestIds.length > 0) {
    await pool.query('DELETE FROM data_retention_log WHERE farm_request_id = ANY($1)', [requestIds]);
    await pool.query('DELETE FROM farm_requests WHERE id = ANY($1)', [requestIds]);
  }
  await pool.query('DELETE FROM users WHERE username_lower = ANY($1)', [
    [ADMIN.toLowerCase(), OTHER.toLowerCase()],
  ]);
  await pool.end();
});

describe('การตรวจสิทธิ์', () => {
  test('ไม่ได้ล็อกอิน ดูไม่ได้', async () => {
    const res = await request(app).get('/api/data-retention/log');
    expect(res.status).toBe(401);
  });

  test('ผู้ใช้ทั่วไปดูไม่ได้', async () => {
    // บันทึกนี้บอกว่าคำขอไหนเคยมีข้อมูลส่วนตัวอะไรอยู่ ไม่ใช่ของสาธารณะ
    const res = await request(app).get('/api/data-retention/log').set('Cookie', otherCookie);
    expect(res.status).toBe(403);
  });

  test('แอดมินดูได้', async () => {
    const res = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
  });
});

describe('รายการที่ล้างไปแล้ว', () => {
  test('คืนบันทึกพร้อมรายชื่อฟิลด์ที่ถูกล้าง', async () => {
    const res = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);

    const mine = res.body.entries.find((e: { farmRequestId: string }) =>
      e.farmRequestId.startsWith(`req_retlog_${SUFFIX}`)
    );

    expect(mine).toBeDefined();
    expect(mine.fieldsCleared).toContain('farmer_full_name');
    expect(mine.triggerSource).toBe('auto');
    expect(mine.purgedAt).toBeTruthy();
  });

  test('เรียงล่าสุดขึ้นก่อน', async () => {
    const res = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);
    const times = res.body.entries.map((e: { purgedAt: string }) => Date.parse(e.purgedAt));

    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  test('ไม่ส่งค่าที่ถูกลบไปแล้วออกมาด้วย', async () => {
    // ถ้ารายงานคืนค่าที่ถูกล้างมาให้ดู ก็เท่ากับไม่ได้ล้างจริง
    const res = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);
    expect(JSON.stringify(res.body)).not.toContain('นายทดสอบ ข้อมูลส่วนตัว');
  });

  test('จำกัดจำนวนรายการได้', async () => {
    const res = await request(app)
      .get('/api/data-retention/log?limit=1')
      .set('Cookie', adminCookie);

    expect(res.body.entries).toHaveLength(1);
  });
});

describe('สรุปสถานะของงานล้าง', () => {
  test('บอกกำหนดเวลาเก็บที่ระบบใช้จริง', async () => {
    // เลข 90 ไม่ควรถูกเขียนซ้ำไว้ที่หน้าจอ ถ้าวันหนึ่งเปลี่ยนนโยบาย
    // หน้าจอจะบอกตัวเลขที่ไม่ตรงกับที่ระบบทำ
    const res = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);
    expect(res.body.summary.retentionDays).toBe(RETENTION_DAYS);
  });

  test('นับคำขอที่ถูกปฏิเสธและยังถือข้อมูลส่วนตัวอยู่', async () => {
    const res = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);
    // สองแถวที่ชุดนี้สร้างและยังไม่ถูกล้าง
    expect(res.body.summary.pendingCount).toBeGreaterThanOrEqual(2);
  });

  test('นับที่เลยกำหนดแล้วแต่ยังไม่ถูกล้าง แยกออกมาต่างหาก', async () => {
    // ตัวเลขนี้คือคำตอบว่างานล้างยังทำงานอยู่หรือไม่ ถ้าไม่มีตัวเลขนี้
    // ตารางว่างเปล่าจะตีความไม่ได้ว่าปกติหรือพัง
    const res = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);
    expect(res.body.summary.overdueCount).toBeGreaterThanOrEqual(1);
  });

  test('แถวที่ล้างไปแล้ว ไม่ถูกนับเป็นค้างหรือเลยกำหนด', async () => {
    const before = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);

    // ล้างแถวที่เลยกำหนดทิ้งจริง แล้วตัวเลขต้องลดลง
    await pool.query(
      `UPDATE farm_requests SET farmer_full_name = NULL, payload = '{}'::jsonb WHERE id = $1`,
      [requestIds[0]]
    );

    const after = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);

    expect(after.body.summary.overdueCount).toBe(before.body.summary.overdueCount - 1);
    expect(after.body.summary.pendingCount).toBe(before.body.summary.pendingCount - 1);
  });

  test('บอกวันครบกำหนดของรายการที่ใกล้ที่สุด', async () => {
    const res = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);
    expect(res.body.summary.nextDueAt).toBeTruthy();
  });

  test('บอกว่าล้างครั้งล่าสุดเมื่อไหร่', async () => {
    const res = await request(app).get('/api/data-retention/log').set('Cookie', adminCookie);
    expect(res.body.summary.lastPurgedAt).toBeTruthy();
  });
});
