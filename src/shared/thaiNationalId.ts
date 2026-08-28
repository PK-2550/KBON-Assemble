/**
 * เลขประจำตัวประชาชนไทย -- ตรวจความถูกต้องและปิดบังเพื่อแสดงผล
 *
 * อยู่ใน src/shared เพราะทั้งหน้าเว็บ (Vite) และเซิร์ฟเวอร์ (tsx) ต้องใช้ตัวเดียวกัน
 * ถ้าแยกเขียนสองที่ วันหนึ่งเกณฑ์จะเพี้ยนกัน แล้วจะเกิดกรณีที่หน้าเว็บบอกว่าเลขใช้ได้
 * แต่เซิร์ฟเวอร์ปฏิเสธ หรือแย่กว่านั้นคือกลับกัน
 *
 * ไฟล์นี้ต้องไม่ import อะไรที่ผูกกับ React, DOM หรือ pg เด็ดขาด
 */

/** จำนวนหลักของเลขประจำตัวประชาชน */
export const THAI_ID_LENGTH = 13;

/**
 * ตัดทุกอย่างที่ไม่ใช่ตัวเลขออก
 *
 * ผู้ใช้พิมพ์ขีดคั่นหรือเว้นวรรคมาได้ตามสะดวก เก็บและตรวจด้วยตัวเลขล้วนเสมอ
 */
export function normalizeThaiNationalId(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/**
 * คำนวณหลักตรวจสอบ (หลักที่ 13) จาก 12 หลักแรก
 *
 * สูตรของกรมการปกครอง คือถ่วงน้ำหนักหลักที่ i ด้วย (14 - i) แล้วหารเอาเศษด้วย 11
 * หลักที่ 13 จึงไม่ได้มีข้อมูลใหม่ในตัวเอง คำนวณจาก 12 หลักแรกได้ทั้งหมด
 * -- เป็นเหตุผลที่เวลาปิดบังเลข เราเปิดเผยได้เฉพาะหลักนี้โดยไม่เพิ่มอะไรให้ผู้โจมตี
 *
 * คืน null เมื่อความยาวไม่ถึง 12 หลัก เพราะยังคำนวณไม่ได้
 */
export function thaiNationalIdCheckDigit(value: string): number | null {
  const digits = normalizeThaiNationalId(value);
  if (digits.length < THAI_ID_LENGTH - 1) return null;

  let sum = 0;
  for (let i = 0; i < THAI_ID_LENGTH - 1; i += 1) {
    sum += Number(digits[i]) * (THAI_ID_LENGTH - i);
  }
  return (11 - (sum % 11)) % 10;
}

/**
 * ตรวจว่าเป็นเลขประจำตัวประชาชนไทยที่ถูกต้องตามหลักตรวจสอบหรือไม่
 *
 * ผ่านการตรวจนี้แปลว่าเลข "มีรูปแบบถูกต้อง" เท่านั้น
 * ไม่ได้แปลว่ามีคนคนนี้อยู่จริง หรือเป็นเจ้าของเลขนี้จริง
 */
export function isValidThaiNationalId(value: string): boolean {
  const digits = normalizeThaiNationalId(value);
  if (digits.length !== THAI_ID_LENGTH) return false;
  // หลักแรกเป็น 0 ไม่มีในระบบจริง กรมการปกครองไม่เคยออกเลขขึ้นต้นด้วยศูนย์
  if (digits[0] === '0') return false;

  return thaiNationalIdCheckDigit(digits) === Number(digits[12]);
}

/**
 * ปิดบังเลขสำหรับแสดงผล -- เปิดเผยเฉพาะหลักที่ 13 ซึ่งเป็นหลักตรวจสอบ
 *
 * ได้ผลเป็น X-XXXX-XXXXX-XX-9 ตามรูปแบบการจัดกลุ่มของบัตรจริง
 *
 * จงใจไม่เปิด 4 หลักท้าย เพราะกลุ่มนั้นกินหลักที่ 10-13 ซึ่งมีสาระจริงถึง 3 หลัก
 * และธนาคารกับค่ายมือถือไทยใช้เลขชุดนั้นเป็นคำถามยืนยันตัวตน
 * ส่วนหลักที่ 13 คำนวณจาก 12 หลักแรกได้อยู่แล้ว เปิดไปก็ไม่ได้ให้ข้อมูลอะไรเพิ่ม
 * แต่พอให้แอดมินแยกแถวสองแถวออกจากกันได้เวลาไล่ดูรายการ
 */
export function maskThaiNationalId(value: string): string {
  const digits = normalizeThaiNationalId(value);
  if (digits.length !== THAI_ID_LENGTH) return maskedThaiNationalIdFromCheckDigit();

  return maskedThaiNationalIdFromCheckDigit(digits[12]);
}

/**
 * สร้างข้อความปิดบังจากหลักตรวจสอบอย่างเดียว
 *
 * ใช้ตอนที่เลขเต็มถูกเข้ารหัสไปแล้วและเหลือแค่หลักที่ 13 เก็บไว้ต่างหาก
 * ฝั่งเซิร์ฟเวอร์จึงแสดงผลได้โดยไม่ต้องถอดรหัสทุกครั้งที่มีคนเรียกดูรายการ
 *
 * แยกออกมาเพื่อให้รูปแบบการปิดบังมีนิยามอยู่ที่เดียว ไม่ว่าจะมาจากเลขเต็ม
 * หรือมาจากหลักตรวจสอบ ถ้าวันหนึ่งเปลี่ยนรูปแบบ จะไม่มีทางเปลี่ยนหลุดข้างเดียว
 */
export function maskedThaiNationalIdFromCheckDigit(checkDigit?: string | null): string {
  const digit = typeof checkDigit === 'string' && /^[0-9]$/.test(checkDigit) ? checkDigit : 'X';
  return `X-XXXX-XXXXX-XX-${digit}`;
}

/**
 * จัดรูปแบบเลขเต็มให้อ่านง่ายตามการจัดกลุ่มบนบัตรจริง (1-2345-67890-12-3)
 *
 * ใช้เฉพาะตอนที่ตั้งใจแสดงเลขเต็มจริง ๆ เท่านั้น คือช่องกรอกของเจ้าตัว
 * และหน้าจอแอดมินหลังกดเปิดเผย ที่อื่นให้ใช้ maskThaiNationalId
 */
export function formatThaiNationalId(value: string): string {
  const d = normalizeThaiNationalId(value);
  if (d.length !== THAI_ID_LENGTH) return d;

  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
}
