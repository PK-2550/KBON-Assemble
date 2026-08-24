/**
 * ตัวกลางสำหรับคุยกับ API ของเราเอง (Express ที่ /api)
 *
 * เดิม frontend คุยกับ Firestore ตรง ๆ จากเบราว์เซอร์ กฎความปลอดภัยจึงต้องไป
 * เขียนไว้ใน firestore.rules ซึ่งบังคับได้จำกัดมาก ตอนนี้ทุกอย่างผ่าน API
 * ที่ตรวจสิทธิ์ฝั่ง server ได้เต็มที่
 *
 * credentials: 'include' จำเป็นเพื่อให้เบราว์เซอร์แนบ cookie ที่เก็บ JWT ไปด้วย
 * ตัว token เป็น httpOnly โค้ดฝั่งนี้จึงอ่านหรือแตะมันไม่ได้เลย ซึ่งเป็นเรื่องที่ตั้งใจ
 */

const BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      ...init,
    });
  } catch {
    // fetch จะ throw เฉพาะตอนต่อ server ไม่ได้จริง ๆ (ไม่ใช่ตอนได้ status 4xx/5xx)
    throw new ApiError(
      'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์กำลังทำงานอยู่ (npm run dev)',
      0
    );
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const serverMessage = (body as { error?: string })?.error;
    if (serverMessage) {
      throw new ApiError(serverMessage, res.status);
    }

    // ไม่มี JSON กลับมาพร้อม status 5xx แปลว่าไม่ได้คุยกับ API ของเราจริง ๆ
    // ส่วนใหญ่คือ vite proxy ตอบแทนเพราะต่อ backend ที่ port 3001 ไม่ได้
    // (ซึ่ง proxy รายงานเป็น 500 ไม่ใช่ network error ฝั่งเบราว์เซอร์)
    if (res.status >= 500) {
      throw new ApiError(
        'เซิร์ฟเวอร์ API ไม่ตอบสนอง อาจยังไม่ได้เริ่มทำงานหรือหยุดไปแล้ว',
        res.status
      );
    }

    throw new ApiError(`เกิดข้อผิดพลาด (${res.status})`, res.status);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
};
