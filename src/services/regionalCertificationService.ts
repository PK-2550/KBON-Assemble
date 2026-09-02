import { api } from './apiClient';

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

export async function fetchPendingRegionalCertRequests(): Promise<RegionalCertRequest[]> {
  const { requests } = await api.get<{ requests: RegionalCertRequest[] }>(
    '/regional-certifications/requests'
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
