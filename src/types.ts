export interface SocialContact {
  facebook?: string;
  instagram?: string;
  lineId?: string;
  phoneNumber?: string;
  websiteUrl?: string;
  locationAddress?: string;
}

export interface CertificationDetail {
  name: string; // e.g. 'GAP (Good Agricultural Practice)', 'GI (Geographical Indication)', 'Organic Thailand'
  shortCode: string; // 'GAP', 'GI', 'Organic', 'Q-Mark'
  certNumber: string; // e.g. 'GAP-502-66-8891'
  issuedBy: string; // e.g. 'กรมวิชาการเกษตร', 'กรมทรัพย์สินทางปัญญา'
  validUntil: string; // e.g. '2027'
  verified: boolean;
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
  varietiesCount: number;
  topVarieties: string[];
  totalTrees: number;
  harvestedFruits: number;
  rating: number;
  reviewCount: number;
  logoBgColor?: string;
  logoTextColor?: string;
  establishedYear?: number;
  certifications?: string[];
  certificationDetails?: CertificationDetail[];
  contact?: SocialContact;
  highlight?: string;
  aboutStory?: string;
  photos?: string[];
  treeVarieties?: FruitTreeVariety[];
  individualTrees?: IndividualTree[]; // รายชื่อแต่ละต้นอย่างละเอียดพร้อมรหัส
}

export type SortField = 'harvested' | 'trees' | 'rating' | 'rank' | 'name';
