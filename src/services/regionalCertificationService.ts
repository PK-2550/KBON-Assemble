import { api, ApiError } from './apiClient';

/**
 * ใบรับรองระดับโซน และคำขอที่รอแอดมินจับคู่
 *
 * ใบอย่าง GI เป็นของโซนภูมิศาสตร์ ไม่ใช่ของสวนรายตัว ระบบจึงไม่มีทางรู้เองว่า
 * สวนที่เพิ่งอนุมัติไปควรอยู่โซนไหน คำขอถูกเก็บค้างไว้รอคนตัดสิน
 *
 * ทุกเส้นทางที่นี่เป็นของแอดมิน การจับคู่คือการมอบตรารับรองให้สวน
 * ซึ่งเป็นสิ่งที่ผู้บริโภคใช้ตัดสินใจซื้อ
 */

export interface RegionalZone {
  id: number;
  regionName: string;
  province: string;
  certNumber: string;
  issuingAuthority: string;
  approvalStatus: string;
  typeCode: string;
  typeNameTh: string;
  /** วันหมดอายุของใบตัวแทนโซน คืนเป็นปีเปล่าถ้าข้อมูลรู้แค่ระดับปี */
  validUntil: string;
  /** จำนวนสวนที่ผูกกับโซนนี้อยู่แล้ว ใช้ดูว่าโซนไหนใช้งานจริง */
  linkedFarmCount: number;
}

export interface RegionalCertRequest {
  id: number;
  farmId: string;
  farmName: string;
  province: string;
  typeCode: string;
  typeNameTh: string;
  certNumber: string;
  issuingAuthority: string;
  status: 'pending' | 'linked' | 'rejected';
  adminNotes: string;
  resolvedBy: string;
  resolvedAt: string | null;
  createdAt: string;
  regionalCertificationId: number | null;
  linkedRegionName: string;
}

export async function fetchRegionalZones(): Promise<RegionalZone[]> {
  const { zones } = await api.get<{ zones: RegionalZone[] }>('/regional-certifications');
  return zones;
}

/**
 * คำขอใบระดับโซนตามสถานะ
 *
 * ค่าตั้งต้นคือที่ยังค้าง เพราะนั่นคือกองงานที่แอดมินต้องเคลียร์
 * ส่วนที่จัดการไปแล้วขอดูได้ ไว้ใช้ตอนต้องย้อนดูว่าใบใบหนึ่งเคยถูกตัดสิน
 * ไปว่าอย่างไร ใครตัดสิน และเพราะอะไร ซึ่งเป็นคำถามที่ต้องตอบได้ตอน
 * เจ้าของสวนโทรมาถามว่าทำไมตรายังไม่ขึ้น
 */
export async function fetchRegionalCertRequests(
  status: RegionalCertRequest['status'] = 'pending'
): Promise<RegionalCertRequest[]> {
  const { requests } = await api.get<{ requests: RegionalCertRequest[] }>(
    `/regional-certifications/requests?status=${status}`
  );
  return requests;
}

/**
 * สถานะใบระดับโซนของสวนหนึ่ง สำหรับเจ้าของสวนเอง
 *
 * ต่างจาก fetchRegionalCertRequests ตรงที่คืนทุกสถานะของสวนเดียว ไม่ใช่
 * สถานะเดียวของทุกสวน และเปิดให้เจ้าของสวนเรียกได้ ไม่ใช่เฉพาะแอดมิน
 *
 * ชื่อผู้ตัดสินถูกตัดออกฝั่งเซิร์ฟเวอร์เมื่อผู้เรียกไม่ใช่แอดมิน
 */
export async function fetchRegionalCertRequestsForFarm(
  farmId: string
): Promise<RegionalCertRequest[]> {
  const { requests } = await api.get<{ requests: RegionalCertRequest[] }>(
    `/regional-certifications/requests/by-farm/${encodeURIComponent(farmId)}`
  );
  return requests;
}

export async function linkRegionalCertRequest(
  requestId: number,
  regionalCertificationId: number
): Promise<RegionalCertRequest> {
  const { request } = await api.post<{ request: RegionalCertRequest }>(
    `/regional-certifications/requests/${requestId}/link`,
    { regionalCertificationId }
  );
  return request;
}

export async function rejectRegionalCertRequest(
  requestId: number,
  adminNotes: string
): Promise<RegionalCertRequest> {
  const { request } = await api.post<{ request: RegionalCertRequest }>(
    `/regional-certifications/requests/${requestId}/reject`,
    { adminNotes }
  );
  return request;
}

/** ค่าที่ฟอร์มส่งไปตอนสร้างหรือแก้ไขโซน */
export interface RegionalZoneInput {
  certificationTypeCode?: string;
  regionName: string;
  province: string;
  certNumber?: string;
  issuingAuthority?: string;
  validUntil?: string;
  /** ยืนยันว่าเป็นคนละโซนกับที่มีอยู่แล้วในจังหวัดนั้น */
  confirmDuplicate?: boolean;
}

/** โซนที่อาจซ้ำ ซึ่งเซิร์ฟเวอร์ส่งกลับมาให้แอดมินดูก่อนตัดสิน */
export interface SimilarZone {
  id: number;
  regionName: string;
  province: string;
  certNumber: string;
  linkedFarmCount: number;
}

/**
 * ผลของการเขียนโซน
 *
 * การถูกปฏิเสธเพราะซ้ำเป็นผลลัพธ์ปกติของงานนี้ ไม่ใช่ความผิดพลาดของระบบ
 * จึงคืนเป็นค่าให้ผู้เรียกจัดการ ไม่ใช่โยน exception ซึ่งจะทำให้หน้าจอ
 * ต้องแกะรหัสกับรายชื่อโซนออกมาจาก error เอง
 */
export type RegionalZoneWriteResult =
  | { ok: true; zone: RegionalZone }
  | { ok: false; code: string; error: string; zones?: SimilarZone[] };

/** แปลง error ของ API ให้เป็นผลลัพธ์ที่หน้าจอเอาไปแสดงได้ตรง ๆ */
function toWriteFailure(err: unknown): RegionalZoneWriteResult {
  if (err instanceof ApiError) {
    const body = (err.body ?? {}) as { code?: string; zones?: SimilarZone[] };
    return {
      ok: false,
      code: body.code ?? 'UNKNOWN',
      error: err.message,
      zones: body.zones,
    };
  }
  return {
    ok: false,
    code: 'UNKNOWN',
    error: err instanceof Error ? err.message : 'บันทึกโซนไม่สำเร็จ',
  };
}

export async function createRegionalZone(
  input: RegionalZoneInput
): Promise<RegionalZoneWriteResult> {
  try {
    const { zone } = await api.post<{ zone: RegionalZone }>('/regional-certifications', input);
    return { ok: true, zone };
  } catch (err) {
    return toWriteFailure(err);
  }
}

export async function updateRegionalZone(
  id: number,
  input: Partial<RegionalZoneInput>
): Promise<RegionalZoneWriteResult> {
  try {
    const { zone } = await api.patch<{ zone: RegionalZone }>(
      `/regional-certifications/${id}`,
      input
    );
    return { ok: true, zone };
  } catch (err) {
    return toWriteFailure(err);
  }
}
