export interface SocialContact {
  facebook?: string;
  instagram?: string;
  lineId?: string;
  phoneNumber?: string;
  websiteUrl?: string;
  locationAddress?: string;
}

export interface CertificationDetail {
  id?: string;
  name: string; // e.g. 'GAP (Good Agricultural Practice)', 'GI (Geographical Indication)', 'Organic Thailand'
  nameTh?: string;
  shortCode: string; // 'GAP', 'GI', 'Organic', 'Q-Mark'
  certNumber: string; // e.g. 'GAP-502-66-8891'
  issuedBy: string; // e.g. 'กรมวิชาการเกษตร', 'กรมทรัพย์สินทางปัญญา'
  validUntil: string; // e.g. '2027'
  verified: boolean;
  documentPhoto?: string; // ภาพถ่ายใบรับรองฉบับจริง หรือ Base64 Data URL (PNG/JPG/PDF)
  fileType?: 'image' | 'pdf'; // 'image' or 'pdf'
  fileName?: string; // e.g. 'GAP_Certificate_2026.pdf'
}

export interface TreeReview {
  id: string;
  authorName: string;
  nfcFruitTag: string; // e.g. "NFC-VK-MT01-084", "VK-F042 (หมอนทองลูกที่ 42)"
  nfcFruitWeightKg?: number; // e.g. 3.6
  rating: number; // e.g. 5 or 9.8
  reviewDate: string; // e.g. "14 ส.ค. 2026"
  comment: string;
  verifiedNfc: boolean;
  avatarUrl?: string;
  tastingNotes?: string[]; // e.g. ['หวาน 34 Brix', 'กรอบนอกนุ่มใน', 'เม็ดลีบแท้']
  fruitPhoto?: string;
}

export interface IndividualTree {
  id: string;
  code: string; // รหัสเฉพาะประจำต้น เช่น "VK-MT-001", "KY-A-012"
  name: string; // ชื่อเฉพาะของต้น เช่น "หมอนทองภูเขาไฟ ต้นแม่พันธุ์ A1"
  variety: string; // สายพันธุ์ เช่น "หมอนทอง", "ก้านยาว", "มูซานคิง"
  category: 'durian_main' | 'durian_rare' | 'companion_fruit';
  categoryLabel: string;
  badge?: string; // '2026 NEW', '2025 NEW', 'GI', 'แม่พันธุ์'
  propagationType: 'grafted' | 'cutting' | 'seedling' | 'layering'; // 'เสียบยอด', 'ตอนกิ่ง', 'เพาะเมล็ด'
  propagationLabel: string; // 'เสียบยอด', 'ทาบกิ่ง', 'ตอนกิ่ง'
  propagationCode: 'AUTO' | 'PHOTO' | 'GRAFT' | 'ORGANIC' | 'EXP';
  zone: string; // โซนที่ปลูก เช่น "โซน A (ลาดเขา)", "แปลงดินภูเขาไฟ B"
  plantedDate: string; // วันที่เริ่มปลูก เช่น "15 พ.ค. 2553 (2010)"
  ageYears: number; // อายุต้น เช่น 8 ปี
  yieldFruitCount: number; // จำนวนลูกที่ได้ต่อต้น เช่น 84 ลูก
  yieldWeightKg: number; // น้ำหนักรวม เช่น 310 กก.
  diariesCount: number; // จำนวนบันทึกการดูแล (Diaries) เช่น 104
  rating: number; // คะแนนรีวิวดาว เช่น 9.8
  reviewCount: number; // จำนวนรีวิว
  healthStatus: 'excellent' | 'good' | 'monitoring';
  sweetnessBrix?: number; // ค่าความหวาน Brix เช่น 33
  lastWatered?: string;
  lastFertilized?: string;
  expectedHarvest?: string;
  notes?: string;
  reviews?: TreeReview[]; // รีวิวเฉพาะต้นไม้ต้นนี้ พร้อม NFC tag หลังชื่อ
}

export interface FruitTreeVariety {
  id: string;
  name: string;
  nameEn?: string;
  category: 'durian_main' | 'durian_rare' | 'companion_fruit';
  categoryLabel: string;
  tag?: string;
  avgWeightKg: number;
  yieldPerTree: number;
  totalTreesCount: number;
  rating: number;
  reviewsCount: number;
  sweetnessBrix?: number;
  tasteProfile?: string;
  harvestSeason?: string;
}

export interface DurianFarm {
  id: string;
  rank: number;
  name: string;
  nameEn?: string;
  province: string;
  district?: string;
  areaRai?: number;
  varietiesCount: number;
  topVarieties: string[];
  totalTrees: number;
  harvestedFruits: number;
  harvestRounds?: number;
  rating: number;
  reviewCount: number;
  logoBgColor?: string;
  logoTextColor?: string;
  establishedYear?: number;
  certifications?: string[];
  certificationDetails?: CertificationDetail[];
  certDocumentPhoto?: string; // ภาพถ่ายใบรับรอง GAP/GI ฉบับจริง
  contact?: SocialContact;
  highlight?: string;
  aboutStory?: string;
  photos?: string[]; // รูปภาพบรรยากาศสวน
  atmospherePhotos?: string[]; // รูปภาพบรรยากาศสวน
  treeVarieties?: FruitTreeVariety[];
  individualTrees?: IndividualTree[]; // รายชื่อแต่ละต้นอย่างละเอียดพร้อมรหัส
  hasSmartFarm?: boolean; // มีเทคโนโลยี Smart Farm หรือไม่
  smartTechnologies?: SmartTechItem[];
  coordinates?: { lat: number; lng: number }; // พิกัด GPS แปลงสวนจริง
  managerId?: string; // UID ของผู้จัดการสวนที่เป็นเจ้าของ
  managerName?: string;
  verifiedAt?: string;
}

export interface SmartTechItem {
  id: string;
  name: string;
  subtext: string;
  iconEmoji: string;
  active: boolean;
}

export type SortField = 'harvested' | 'trees' | 'rating' | 'rank' | 'name';

export type UserRole = 'user' | 'manager' | 'admin'; // 'user' = ผู้บริโภคทั่วไป, 'manager' = ผู้จัดการสวน/เจ้าของสวนที่ได้รับอนุมัติแล้ว, 'admin' = ผู้ดูแลระบบ

export type RequestCategory = 'manager_application' | 'farm_verification';

export interface FarmRegistrationRequest {
  id: string; // e.g. "req_1720000000"
  requestCategory?: RequestCategory; // 'manager_application' = คำขอสิทธิ์ผู้จัดการสวน, 'farm_verification' = ตรวจสอบและรับรองมาตรฐานฟาร์ม
  requestType?: 'new_farm' | 'update_farm'; // 'new_farm' = ขอขึ้นทะเบียนสวนใหม่, 'update_farm' = ขอแก้ไข/เพิ่มเติมข้อมูลสวนที่มีอยู่
  targetFarmId?: string; // ID ของฟาร์มเดิมที่ต้องการขอแก้ไข (กรณี update_farm)
  updateNotes?: string; // รายละเอียดหรือสิ่งที่ต้องการแก้ไข/เพิ่มเติมที่ Manager แจ้ง Admin
  userId: string;
  userDisplayName: string;
  userEmailOrUsername: string;
  farmName: string;
  farmNameEn?: string;
  province: string;
  district: string;
  locationAddress?: string;
  areaRai: number;
  totalTreesEstimate: number;
  topVarieties: string[];
  aboutStory: string;
  contact: SocialContact;
  // Standard Certification
  gapCertNumber: string;
  certIssuedBy: string;
  certValidUntil: string;
  certDocumentPhoto?: string; // รูปหรือไฟล์ PDF ใบรับรองทางการเกษตรหลัก
  certificationList?: CertificationDetail[]; // รายการใบรับรองมาตรฐานทั้งหมด (รองรับ PDF / PNG หลายไฟล์)
  otherCerts?: string[];
  // Garden Atmosphere Photos
  atmospherePhotos?: string[]; // รูปบรรยากาศสวน
  // Smart Farm
  hasSmartFarm?: boolean;
  smartTechnologies?: SmartTechItem[];
  // Farmer Identity & Eligibility Verification
  farmerFullName?: string; // ชื่อ-นามสกุลจริงเจ้าของสวน
  farmerIdCardNumber?: string; // เลขประจำตัวประชาชน 13 หลัก
  farmerIdCardPhoto?: string; // รูปถ่ายหรือ PDF บัตรประชาชนเจ้าของสวน (มี Watermark ปลอดภัย)
  farmerIdCardFileType?: 'image' | 'pdf'; // 'image' | 'pdf'
  agreedToCriteria?: boolean; // ยินยอมตามเกณฑ์คัดเลือกสวนพรีเมียม 3 ข้อ
  coordinates?: { lat: number; lng: number }; // พิกัดแปลงจริงบนแผนที่ GPS
  googleMapsUrl?: string; // ลิงก์ปักหมุด Google Maps จากผู้ใช้
  // Approval state
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  adminNotes?: string;
  previousAdminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  resubmittedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdFarmId?: string;
}

export interface NfcScannedFruit {
  tagId: string; // e.g. "NFC Tag: #VK-MT01-F042"
  treeCode: string; // e.g. "VK-MT-001"
  treeName: string; // e.g. "หมอนทองภูเขาไฟ ต้นแม่พันธุ์ A1"
  farmName: string; // e.g. "สวนทุเรียนภูเขาไฟ ลุงดำ"
  variety: string;
  weightKg: number;
  harvestDate: string;
  sweetnessBrix?: number;
  verified: boolean;
}
