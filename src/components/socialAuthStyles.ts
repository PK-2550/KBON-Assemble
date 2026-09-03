/**
 * ค่าที่ปุ่มเข้าสู่ระบบด้วยบริการภายนอกทุกปุ่มใช้ร่วมกัน
 *
 * ปุ่ม Google เรนเดอร์โดยสคริปต์ของ Google เอง เราแต่งสีมันไม่ได้ เลือกได้แค่
 * ธีมที่มีให้ (ที่นี่ใช้ filled_black + pill + size large ซึ่งได้ความสูง 40px)
 * ปุ่มที่เหลือจึงต้องมาเข้าคู่กับมัน ไม่ใช่ทางกลับกัน
 *
 * ค่าพวกนี้อยู่ไฟล์เดียวเพื่อไม่ให้ปุ่มสองปุ่มค่อย ๆ เพี้ยนออกจากกันเวลาแก้ทีละที่
 */

/** GIS รับความกว้างเป็นตัวเลข px เท่านั้น ใช้เปอร์เซ็นต์หรือ rem ไม่ได้ */
export const SOCIAL_BUTTON_WIDTH = 280;

/**
 * รูปทรงร่วมของปุ่มที่เราวาดเอง ให้สูง มน และขนาดตัวอักษรเท่าปุ่มของ Google
 *
 * h-10 = 40px เท่ากับ size 'large' ของ GIS พอดี
 */
export const socialButtonBase =
  'w-full h-10 rounded-full flex items-center justify-center gap-2 ' +
  'text-sm font-semibold text-white border transition-colors';

/**
 * สถานะปกติ กดได้
 *
 * ใช้ bg-surface ไม่ใช่ bg-well เพราะปุ่มของ Google เป็นเทาเข้ม (#202124)
 * ถ้าปุ่มข้าง ๆ ดำสนิทกว่านั้นมาก สองปุ่มจะดูเป็นคนละชุดกันทันที
 * bg-surface เป็นเฉดที่ใกล้กันที่สุดในโทนของแอปโดยไม่ต้องใส่สีนอกธีม
 */
export const socialButtonEnabled =
  'bg-surface border-line hover:bg-surface-2 hover:border-line-strong cursor-pointer ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

/** สถานะยังไม่ได้ตั้งค่า OAuth -- ปุ่มปิดที่ยังอยู่ในแถวเดียวกัน ไม่ทำให้แถวเบี้ยว */
export const socialButtonDisabled =
  'bg-surface border-line opacity-40 cursor-not-allowed';
