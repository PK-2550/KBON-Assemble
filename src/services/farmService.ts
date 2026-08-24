/**
 * ดึงและบันทึกข้อมูลฟาร์ม / ต้นไม้ / รีวิว ผ่าน API
 *
 * ไฟล์นี้มาแทน firestoreService.ts (ซึ่งยังเก็บไว้เป็นข้อมูลอ้างอิงระหว่างเปลี่ยนผ่าน)
 *
 * ข้อแตกต่างที่สำคัญ: ไม่มี realtime แล้ว
 *   Firestore ให้ onSnapshot มาฟรี พอย้ายมาเป็น Postgres + REST จึงไม่มีของแบบนั้น
 *   ตอนนี้ใช้วิธีดึงตอนเปิดหน้า แล้วดึงใหม่หลังบันทึกข้อมูล ซึ่งเพียงพอสำหรับการใช้งานจริง
 *   ถ้าภายหลังต้องการ realtime จริง ๆ ค่อยเพิ่ม SSE + LISTEN/NOTIFY ได้โดยไม่ต้องรื้อ
 *
 * รูปร่างข้อมูลที่ API ส่งกลับมาถูกทำให้เหมือนกับ DurianFarm เดิมทุกประการ
 * คอมโพเนนต์ที่แสดงผลจึงไม่ต้องแก้อะไรเลย
 */

import { api } from './apiClient';
import { DurianFarm, TreeReview } from '../types';

export async function fetchFarms(): Promise<DurianFarm[]> {
  const { farms } = await api.get<{ farms: DurianFarm[] }>('/farms');
  return farms;
}

/**
 * ดึงฟาร์มรายตัว -- ต่างจาก fetchFarms ตรงที่แนบรูปใบรับรอง (base64) มาด้วย
 * หน้ารายการไม่ดึงรูปมาเพราะรวมกันเกือบ 1 MB
 */
export async function fetchFarm(farmId: string): Promise<DurianFarm> {
  const { farm } = await api.get<{ farm: DurianFarm }>(`/farms/${encodeURIComponent(farmId)}`);
  return farm;
}

/** เพิ่มฟาร์มใหม่ -- ต้องเป็นแอดมิน ไม่งั้น API จะตอบ 403 */
export async function createFarm(farm: Partial<DurianFarm>): Promise<DurianFarm> {
  const { farm: created } = await api.post<{ farm: DurianFarm }>('/farms', farm);
  return created;
}

export async function updateFarm(farmId: string, changes: Partial<DurianFarm>): Promise<DurianFarm> {
  const { farm } = await api.patch<{ farm: DurianFarm }>(
    `/farms/${encodeURIComponent(farmId)}`,
    changes
  );
  return farm;
}

export async function fetchTreeReviews(treeCode: string): Promise<TreeReview[]> {
  const { reviews } = await api.get<{ reviews: TreeReview[] }>(
    `/trees/${encodeURIComponent(treeCode)}/reviews`
  );
  return reviews;
}

export interface NewTreeReview {
  rating: number;
  comment: string;
  tastingNotes?: string[];
  nfcFruitTag?: string;
  nfcFruitWeightKg?: number;
  verifiedNfc?: boolean;
}

/**
 * เขียนรีวิวใหม่ -- ต้องล็อกอิน
 *
 * ไม่ต้องส่งชื่อผู้เขียนไป server อ่านจาก token เอง เพื่อไม่ให้ปลอมเป็นคนอื่นได้
 */
export async function createTreeReview(
  treeCode: string,
  review: NewTreeReview
): Promise<TreeReview> {
  const { review: created } = await api.post<{ review: TreeReview }>(
    `/trees/${encodeURIComponent(treeCode)}/reviews`,
    review
  );
  return created;
}

/**
 * เขียนทับฟาร์มทั้งก้อน -- มาแทน saveFarmToFirestore ของเดิม
 *
 * แอดมินแก้ได้ทุกฟาร์ม ผู้จัดการสวนแก้ได้เฉพาะฟาร์มที่ตัวเองดูแล
 * ถ้าไม่มีสิทธิ์ API จะตอบ 403
 */
export async function saveFarm(farm: DurianFarm): Promise<DurianFarm> {
  const { farm: saved } = await api.put<{ farm: DurianFarm }>(
    `/farms/${encodeURIComponent(farm.id)}`,
    farm
  );
  return saved;
}

/** ลบฟาร์ม -- เฉพาะแอดมิน ต้นไม้และรีวิวถูกลบตามด้วย */
export async function deleteFarm(farmId: string): Promise<void> {
  await api.del(`/farms/${encodeURIComponent(farmId)}`);
}
