import { api } from './apiClient';

/**
 * รายงานการล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธ
 *
 * ตารางบันทึกมีมาตั้งแต่ 013 แต่เดิมอ่านได้ทาง SQL ทางเดียว
 * เวลามีคนถามว่าข้อมูลหายไปไหนจึงยังตอบไม่ได้อยู่ดี
 */

export interface DataRetentionEntry {
  id: number;
  farmRequestId: string;
  /** ชื่อคอลัมน์ที่ถูกล้าง ไม่ใช่ค่าที่ถูกลบ ตารางไม่เคยเก็บค่าไว้เลย */
  fieldsCleared: string[];
  rejectedAt: string | null;
  purgedAt: string;
  triggerSource: 'auto' | 'manual';
}

export interface DataRetentionSummary {
  /** กำหนดเวลาเก็บที่ระบบใช้จริง หน้าจอไม่ควรเขียนเลขนี้ซ้ำเอง */
  retentionDays: number;
  totalPurged: number;
  lastPurgedAt: string | null;
  /** คำขอที่ถูกปฏิเสธและยังถือข้อมูลส่วนตัวอยู่ */
  pendingCount: number;
  /** เลยกำหนดแล้วแต่ยังไม่ถูกล้าง ถ้าไม่เป็นศูนย์แปลว่างานล้างไม่ได้ทำงาน */
  overdueCount: number;
  nextDueAt: string | null;
}

export interface DataRetentionReport {
  entries: DataRetentionEntry[];
  summary: DataRetentionSummary;
}

export async function fetchDataRetentionReport(): Promise<DataRetentionReport> {
  return api.get<DataRetentionReport>('/data-retention/log');
}
