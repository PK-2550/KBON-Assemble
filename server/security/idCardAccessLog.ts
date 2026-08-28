import { pool } from '../db.js';

/**
 * บันทึกการเข้าถึงข้อมูลบัตรประชาชน
 *
 * แยกออกมาเป็นโมดูลของตัวเองเพราะมีคนเขียนบันทึกสองที่
 * คือตัว route ที่ทำงานสำเร็จหรือล้มเหลวกลางทาง และตัวจำกัดอัตรากับตัวตรวจสิทธิ์
 * ที่ปฏิเสธตั้งแต่ยังไม่ถึง route ถ้าปล่อยให้ต่างคนต่างเขียน INSERT เอง
 * รูปแบบจะเพี้ยนกันในที่สุด
 */

export type IdCardAccessOutcome =
  | 'success'
  | 'not_found'
  | 'decrypt_failed'
  | 'forbidden'
  | 'rate_limited';

/**
 * เขียนบันทึกหนึ่งแถว
 *
 * ตัวเรียกที่อยู่บนเส้นทางตอบข้อมูลจริงต้อง await เสมอ เพื่อให้ได้คุณสมบัติว่า
 * ถ้าเขียนบันทึกไม่สำเร็จ ผู้เรียกจะไม่ได้ข้อมูลไปด้วย
 *
 * ส่วนตัวเรียกที่อยู่บนเส้นทางปฏิเสธ (403, 429) ใช้ logIdCardAccessBestEffort
 * ข้างล่างแทน เพราะที่นั่นไม่มีข้อมูลอะไรจะรั่วอยู่แล้ว และการทำให้คำตอบ 429
 * ล้มเป็น 500 เพราะเขียนบันทึกไม่ได้ ไม่ได้ช่วยใคร
 */
export async function logIdCardAccess(params: {
  adminUserId: string;
  farmRequestId: string;
  outcome: IdCardAccessOutcome;
  ip?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO id_card_access_log (admin_user_id, farm_request_id, outcome, ip)
     VALUES ($1, $2, $3, $4)`,
    [params.adminUserId, params.farmRequestId, params.outcome, params.ip ?? null]
  );
}

/**
 * เขียนบันทึกแบบไม่ให้ข้อผิดพลาดลามไปกระทบคำตอบ
 *
 * ใช้เฉพาะเส้นทางที่กำลังปฏิเสธผู้เรียกอยู่แล้ว ห้ามใช้กับเส้นทางที่ตอบข้อมูลจริง
 */
export function logIdCardAccessBestEffort(params: {
  adminUserId: string;
  farmRequestId: string;
  outcome: IdCardAccessOutcome;
  ip?: string | null;
}): void {
  logIdCardAccess(params).catch((err) => {
    console.error(
      '[idCardAccessLog] เขียนบันทึกการเข้าถึงไม่สำเร็จ',
      JSON.stringify({
        outcome: params.outcome,
        errorName: err instanceof Error ? err.name : typeof err,
      })
    );
  });
}
