/**
 * ประวัติการดูแลต้นไม้
 *
 * ข้อมูลชุดนี้ไหลเข้ามาจากระบบของสวน ไม่ได้ให้คนกรอกผ่านหน้าเว็บ
 * ฝั่งนี้จึงมีแต่การอ่าน การนำเข้าใช้ POST /api/care-logs/import พร้อม API key
 * ซึ่งเรียกจากระบบต้นทางหรือสคริปต์ ไม่ได้เรียกจากเบราว์เซอร์
 */

import { api } from './apiClient';

export type CareActivityType =
  | 'watering'
  | 'fertilizing'
  | 'pruning'
  | 'spraying'
  | 'harvesting'
  | 'inspection'
  | 'other';

export interface CareLog {
  id: string;
  treeCode: string;
  farmId: string;
  activityType: CareActivityType;
  activityLabel?: string;
  /** วันที่ลงมือทำจริง รูปแบบ YYYY-MM-DD */
  performedAt: string;
  notes?: string;
  source: 'import' | 'sensor' | 'manual';
  externalId?: string;
  /** จำนวนรูปแนบ ตัวรูปต้องดึงแยกด้วย fetchCareLogPhotos */
  photoCount: number;
  createdAt?: string;
}

export interface CareLogPhoto {
  photo: string;
  caption?: string;
}

/** ชื่อกิจกรรมภาษาไทยสำหรับแสดงผล */
export const CARE_ACTIVITY_LABELS: Record<CareActivityType, string> = {
  watering: 'รดน้ำ',
  fertilizing: 'ใส่ปุ๋ย',
  pruning: 'แต่งกิ่ง',
  spraying: 'ฉีดพ่น',
  harvesting: 'เก็บเกี่ยว',
  inspection: 'ตรวจแปลง',
  other: 'อื่น ๆ',
};

export async function fetchCareLogs(treeCode: string): Promise<CareLog[]> {
  const { logs } = await api.get<{ logs: CareLog[] }>(
    `/trees/${encodeURIComponent(treeCode)}/care-logs`
  );
  return logs;
}

/**
 * ดึงรูปของรายการหนึ่ง
 *
 * แยกจากการดึงรายการเพราะรูปอาจเป็น base64 ก้อนใหญ่
 * ถ้าแนบมากับรายการทุกครั้ง การเปิดแท็บประวัติจะโหลดข้อมูลหลายเมกะไบต์ทันที
 */
export async function fetchCareLogPhotos(logId: string): Promise<CareLogPhoto[]> {
  const { photos } = await api.get<{ photos: CareLogPhoto[] }>(
    `/care-logs/${encodeURIComponent(logId)}/photos`
  );
  return photos;
}
