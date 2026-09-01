import { api } from './apiClient';
import { STANDARD_OPTIONS } from '../constants/farmRegistrationOptions';

/**
 * ประเภทใบรับรองที่ฟอร์มยื่นคำขอเอาไปสร้างตัวเลือก
 *
 * ดึงจากฐานข้อมูลแทนการฝังรายการไว้ในโค้ด ตารางค้นหาที่ 005 ออกแบบไว้จึงมีผลจริง
 * เพิ่มประเภทใหม่คือ INSERT ไม่ต้องแก้โค้ดฝั่งไหนเลย
 */

export interface CertificationTypeOption {
  code: string;
  tier: 'farm' | 'packing_house' | 'shipment' | 'regional';
  name: string;
  nameTh: string;
  requiresExpiry: boolean;
  sortOrder: number;
}

/**
 * รายการสำรองเมื่อเรียก API ไม่สำเร็จ
 *
 * แปลงจากค่าคงที่ชุดเดิม ฟอร์มจะได้ยังกรอกต่อได้ถ้าเครือข่ายมีปัญหา
 * ดีกว่าปล่อยให้ตัวเลือกว่างเปล่าจนยื่นคำขอไม่ได้เลย
 *
 * ถือเป็นทางสำรองจริง ๆ ไม่ใช่แหล่งข้อมูลหลัก จึงไม่มี GMP กับ GACC
 * ที่เพิ่งเปิดให้เลือก เพราะค่าที่ไม่ตรงกับฐานคือต้นเหตุของปัญหาที่กำลังแก้อยู่
 */
const FALLBACK_TYPES: CertificationTypeOption[] = STANDARD_OPTIONS.filter(
  (o) => o.code === 'GAP' || o.code === 'GI'
).map((o, i) => ({
  code: o.code,
  tier: o.code === 'GI' ? 'regional' : 'farm',
  name: o.code,
  nameTh: o.nameTh,
  requiresExpiry: true,
  sortOrder: i + 1,
}));

export async function fetchCertificationTypes(): Promise<CertificationTypeOption[]> {
  try {
    const { types } = await api.get<{ types: CertificationTypeOption[] }>('/certification-types');
    return types.length > 0 ? types : FALLBACK_TYPES;
  } catch {
    return FALLBACK_TYPES;
  }
}
