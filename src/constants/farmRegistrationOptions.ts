/**
 * ตัวเลือกตั้งต้นของฟอร์มขึ้นทะเบียนสวน
 *
 * แยกออกมาเป็นไฟล์ของตัวเองเพราะหลายที่ใช้ค่าชุดเดียวกันนี้ ทั้งฟอร์ม
 * ขึ้นทะเบียน (FarmRegistrationStep4), hook ที่ถือตรรกะฟอร์ม
 * (useFarmRegistrationForm) และค่าตั้งต้นของโมดัลตั้งค่า SmartFarm ในหน้า
 * โปรไฟล์ฟาร์ม (FarmProfileView / FarmProfileHeaderCard)
 *
 * AVAILABLE_SMART_TECH คือแหล่งเดียวของรายการอุปกรณ์ SmartFarm เดิมหน้าโปรไฟล์
 * เคยมีสำเนาชื่อ DEFAULT_SMART_TECH_OPTIONS ที่ id ตรงกันแต่ข้อความเพี้ยนไปคนละ
 * ทาง ยุบมาที่นี่ที่เดียวแล้ว อย่าสร้างสำเนาใหม่
 */

export const AVAILABLE_SMART_TECH = [
  {
    id: 'st-d1',
    name: 'ระบบน้ำหยดอัตโนมัติ (Smart Irrigation)',
    subtext: 'ควบคุมปริมาณน้ำผ่านสมาร์ทโฟน',
    iconEmoji: '💧',
  },
  {
    id: 'st-d2',
    name: 'เซ็นเซอร์วัดความชื้นดินและสภาพอากาศ (IoT Soil Sensor)',
    subtext: 'อ่านค่าความชื้นและอุณหภูมิทุก 15 นาที',
    iconEmoji: '🌡️',
  },
  {
    id: 'st-d3',
    name: 'โดรนพ่นปุ๋ยและสำรวจแปลงทุเรียน (Agricultural Drone)',
    subtext: 'ประเมินสุขภาพใบและลดสารเคมี 40%',
    iconEmoji: '🚁',
  },
  {
    id: 'st-d4',
    name: 'Dashboard ติดตามสวนแบบ Real-time',
    subtext: 'มอนิเตอร์ภาพรวมและจัดการผลผลิตบนมือถือ',
    iconEmoji: '📊',
  },
  {
    id: 'st-d5',
    name: 'พลังงานแสงอาทิตย์ (Solar Farm Automation)',
    subtext: 'ใช้พลังงานแสงอาทิตย์ขับเคลื่อนระบบน้ำ',
    iconEmoji: '☀️',
  },
  {
    id: 'st-d6',
    name: 'ระบบแท็กดิจิทัล / QR-NFC ตรวจสอบย้อนกลับ',
    subtext: 'ระบุต้นกำเนิดผลทุเรียนรายต้น',
    iconEmoji: '🏷️',
  },
];

export const STANDARD_OPTIONS = [
  { code: 'GAP', nameTh: 'มาตรฐานการปฏิบัติทางการเกษตรที่ดี (GAP)', org: 'กรมวิชาการเกษตร' },
  { code: 'GI', nameTh: 'สิ่งบ่งชี้ทางภูมิศาสตร์ (GI)', org: 'กรมทรัพย์สินทางปัญญา' },
  { code: 'Organic', nameTh: 'เกษตรอินทรีย์ (Organic Thailand)', org: 'กระทรวงเกษตรและสหกรณ์' },
  { code: 'Q-Mark', nameTh: 'เครื่องหมายคุณภาพ Q มาตรฐานส่งออก', org: 'มกอช.' },
  { code: 'ISO', nameTh: 'มาตรฐานการจัดการความปลอดภัยอาหาร (ISO 22000)', org: 'สถาบันรับรองมาตรฐาน' },
  { code: 'OTHER', nameTh: 'มาตรฐานรับรองอื่นๆ', org: 'หน่วยงานตรวจรับรอง' },
];
