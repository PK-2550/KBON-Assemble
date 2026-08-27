/**
 * สมัครสมาชิก เข้าสู่ระบบ และออกจากระบบ ผ่าน API
 *
 * ไฟล์นี้มาแทน authService.ts เดิม (ซึ่งยังเก็บไว้เป็นข้อมูลอ้างอิงระหว่างเปลี่ยนผ่าน)
 *
 * ของเดิมมีระบบยืนยันตัวตนซ้อนกันสามชั้น -- Firebase Auth, แฮช SHA-256 ที่เก็บใน
 * Firestore และสำเนาบัญชีอีกชุดใน localStorage -- ตอนนี้เหลือทางเดียวคือถาม API
 *
 * สิ่งที่หายไปโดยตั้งใจ:
 *   - usernameToEmail()        ไม่ต้องปลอม username เป็นอีเมล @duritrack.auth อีกแล้ว
 *   - normalizeUsernameKey()   ใช้ UNIQUE index ของ Postgres แทนการแปลงเป็น hex
 *   - hashPassword()           การแฮชย้ายไปฝั่ง server ด้วย bcrypt
 *                              ของเดิมแฮชฝั่ง client แล้วเทียบฝั่ง client ด้วย
 *                              ทำให้ตัวแฮชมีค่าเท่ากับรหัสผ่านเอง
 *   - สำเนาบัญชีใน localStorage  เป็นช่องทางที่ทำให้แฮชรหัสผ่านไปโผล่ฝั่ง client
 *
 * session ไม่ได้เก็บใน localStorage แล้ว แต่อยู่ใน httpOnly cookie ที่ JavaScript
 * อ่านไม่ได้ การรู้ว่าใครล็อกอินอยู่จึงต้องถาม /api/auth/me
 */

import { api, ApiError } from './apiClient';
import { UserRole } from '../types';

export interface AppUserProfile {
  uid: string;
  username: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  provider: string;
  /** ฟาร์มที่บัญชีนี้ดูแล มีเฉพาะ role manager */
  managedFarmId?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
}

export async function registerWithUsername(
  username: string,
  password: string
): Promise<AppUserProfile> {
  const { profile } = await api.post<{ profile: AppUserProfile }>('/auth/register', {
    username,
    password,
  });
  return profile;
}

export async function loginWithUsername(
  username: string,
  password: string
): Promise<AppUserProfile> {
  const { profile } = await api.post<{ profile: AppUserProfile }>('/auth/login', {
    username,
    password,
  });
  return profile;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
  clearPreferredRole();
}

/**
 * ถาม server ว่ามี session อยู่ไหม -- คืน null ถ้ายังไม่ได้ล็อกอิน
 *
 * ถ้าติดต่อ server ไม่ได้จะ throw ไม่ใช่คืน null
 * เพราะสองกรณีนี้ต่างกันมากในมุมผู้ใช้: "ยังไม่ได้ล็อกอิน" ควรพาไปหน้าเข้าสู่ระบบ
 * ส่วน "เซิร์ฟเวอร์ล่ม" ต้องบอกให้รู้ ไม่ใช่โยนหน้า login ใส่แล้วให้งงว่าทำไมล็อกอินไม่ได้
 */
export async function fetchCurrentUser(): Promise<AppUserProfile | null> {
  try {
    const { profile } = await api.get<{ profile: AppUserProfile }>('/auth/me');
    return profile;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// โหมดการแสดงผล (ผู้บริโภค / แอดมิน)
//
// ค่านี้เป็นแค่ "โหมดที่กำลังดูอยู่" ไม่ใช่สิทธิ์จริง
// สิทธิ์จริงอยู่ใน role ของ profile ซึ่งมาจาก JWT ที่ server เซ็น แก้จากฝั่งนี้ไม่ได้
// ปุ่มสลับโหมดใน Navbar แสดงเฉพาะกับคนที่เป็นแอดมินจริงอยู่แล้ว
// และต่อให้ปลอมค่านี้ได้ ทุก endpoint ที่ต้องใช้สิทธิ์แอดมินก็ยังตอบ 403 อยู่ดี
// ---------------------------------------------------------------------------
const ROLE_PREFERENCE_KEY = 'duritrack_view_mode';

export function getPreferredRole(fallback: UserRole = 'user'): UserRole {
  try {
    const saved = localStorage.getItem(ROLE_PREFERENCE_KEY);
    return saved === 'admin' || saved === 'user' ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function setPreferredRole(role: UserRole): void {
  try {
    localStorage.setItem(ROLE_PREFERENCE_KEY, role);
  } catch {
    // localStorage ใช้ไม่ได้ (โหมดส่วนตัวบางเบราว์เซอร์) -- ไม่ใช่เรื่องคอขาดบาดตาย
  }
}

function clearPreferredRole(): void {
  try {
    localStorage.removeItem(ROLE_PREFERENCE_KEY);
  } catch {
    // ไม่เป็นไร
  }
}

/**
 * ตรวจความแข็งแรงของรหัสผ่าน (ย้ายมาจาก authService.ts เดิมทั้งดุ้น)
 * เป็นฟังก์ชันบริสุทธิ์ ไม่ได้ยุ่งกับ Firebase มาตั้งแต่แรก
 */
export function validatePasswordSecurity(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 6) {
    score += 1;
  } else {
    feedback.push('ความยาวอย่างน้อย 6 ตัวอักษร');
  }

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) || /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  return { isValid: password.length >= 6, score, feedback };
}

/**
 * แปลง error ให้เป็นข้อความภาษาไทยที่ผู้ใช้อ่านรู้เรื่อง
 *
 * ง่ายกว่าเดิมมาก เพราะ API ส่งข้อความไทยที่พร้อมแสดงมาให้อยู่แล้ว
 * ไม่ต้องมาแปล error code ของ Firebase ทีละตัวอีก
 */
export function formatAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'เกิดข้อผิดพลาดในการยืนยันตัวตน กรุณาลองใหม่อีกครั้ง';
}
