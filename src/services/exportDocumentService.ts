import { api } from './apiClient';

/**
 * เอกสารการส่งออกของสวน คือใบรับรองระดับการขนส่งรายเที่ยวอย่าง PHYTO
 *
 * ใบพวกนี้ไม่ขึ้นเป็นตราสาธารณะ เพราะไม่ใช่คุณสมบัติถาวรของสวน สวนที่ส่งออก
 * ไปหนึ่งตู้เมื่อปีที่แล้วไม่ควรได้ตราติดตัวไปตลอด และ PHYTO เป็นเอกสาร
 * ระหว่างผู้ส่งออกกับประเทศปลายทาง ไม่ใช่เครื่องหมายที่ผู้บริโภคใช้ตัดสินใจ
 *
 * เส้นทางนี้เปิดให้เจ้าของสวนกับผู้ดูแลเท่านั้น เลขที่เที่ยวขนส่งกับเลขที่ใบ
 * เป็นข้อมูลทางการค้าของสวนนั้น
 */

export interface ExportDocument {
  id: number;
  shortCode: string;
  nameTh: string;
  certNumber: string;
  issuedBy: string;
  /** เลขที่เที่ยวขนส่งที่ใบนี้ผูกอยู่ สิ่งเดียวที่ทำให้ใบรายเที่ยวอ้างอิงได้ */
  shipmentRef: string;
  validUntil: string;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  adminNotes: string;
  fileName: string;
  fileType: string;
  createdAt: string;
}

export async function fetchExportDocuments(farmId: string): Promise<ExportDocument[]> {
  const { documents } = await api.get<{ documents: ExportDocument[] }>(
    `/farms/${encodeURIComponent(farmId)}/export-documents`
  );
  return documents;
}
