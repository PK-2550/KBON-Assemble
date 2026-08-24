/**
 * คำขอขึ้นทะเบียนสวนและระบบอนุมัติของแอดมิน
 *
 * เดิมไฟล์นี้คุยกับ Firestore ตรง ๆ จากเบราว์เซอร์ ตอนนี้เรียกผ่าน API แทน
 *
 * งานหนักย้ายไปอยู่ฝั่ง server หมดแล้ว โดยเฉพาะการอนุมัติคำขอ ซึ่งเดิม
 * ประกอบข้อมูลฟาร์มและเขียน 4 ที่ติดกันในเบราว์เซอร์ (สร้างฟาร์ม อัปเดตคำขอ
 * เลื่อน role และผูกบัญชี) โดยแต่ละก้อนครอบ try/catch ที่กลืน error ทิ้ง
 * ถ้าพังกลางทางจะได้สถานะครึ่ง ๆ กลาง ๆ ตอนนี้ทำใน transaction เดียวที่ server
 *
 * ส่วนที่เป็น localStorage และข้อมูลตัวอย่างยังอยู่เหมือนเดิม เพราะไม่เกี่ยวกับฐานข้อมูล
 */

import { api } from './apiClient';
import { FarmRegistrationRequest, DurianFarm, IndividualTree, CertificationDetail } from '../types';
const LOCAL_STORAGE_REQUESTS_KEY = 'duritrack_local_farm_requests';

export const DEFAULT_STATIC_SAMPLE_REQUESTS: FarmRegistrationRequest[] = [
  {
    id: 'req_sample_somchai_manager',
    requestCategory: 'manager_application',
    requestType: 'new_farm',
    status: 'pending',
    userId: 'usr_farmer_somchai_2026',
    userDisplayName: 'สมชาย วงศ์เกษตร',
    userEmailOrUsername: 'somchai.farm@duritrack.th',
    farmName: 'สวนทุเรียนลุงสมชาย จันทบุรี',
    farmNameEn: 'Somchai Chanthaburi Durian Orchard',
    farmerFullName: 'นายสมชาย วงศ์เกษตร',
    farmerIdCardNumber: '1229900341829',
    farmerIdCardPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
    farmerIdCardFileType: 'image',
    province: 'จันทบุรี',
    district: 'ท่าใหม่',
    locationAddress: '128 หมู่ 4 ต.เขาวัว อ.ท่าใหม่ จ.จันทบุรี 22120',
    areaRai: 35,
    totalTreesEstimate: 450,
    topVarieties: ['หมอนทอง', 'ก้านยาว', 'พวงมณี'],
    aboutStory: 'เกษตรกรชาวสวนทุเรียนจันทบุรี ต้องการขอรับสิทธิ์ Manager เพื่อบริหารจัดการแปลงทุเรียนและบันทึกประวัติต้น',
    contact: {
      phoneNumber: '081-492-8841',
      lineId: '@somchai_durian',
      facebook: 'สวนทุเรียนลุงสมชาย จันทบุรี',
    },
    gapCertNumber: 'GAP-TH-68-092281',
    certIssuedBy: 'สำนักวิจัยและพัฒนาการเกษตรเขตที่ 6 (กรมวิชาการเกษตร)',
    certValidUntil: '2028',
    certDocumentPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'req_sample_maen_verification',
    requestCategory: 'farm_verification',
    requestType: 'new_farm',
    status: 'pending',
    userId: 'usr_farmer_maen_2026',
    userDisplayName: 'ยายแม้น การ์เด้น',
    userEmailOrUsername: 'maen.rayong@duritrack.th',
    farmName: 'สวนยายแม้น ระยองการ์เด้น (อินทรีย์ปลอดสารเคมี)',
    farmNameEn: 'Grandma Maen Organic Rayong Durian',
    farmerFullName: 'นางแม้น จันทรศิริ',
    farmerIdCardNumber: '3210400192841',
    farmerIdCardPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
    farmerIdCardFileType: 'image',
    province: 'ระยอง',
    district: 'แกลง',
    locationAddress: '88 หมู่ 2 ต.วังหว้า อ.แกลง จ.ระยอง 21110',
    areaRai: 22,
    totalTreesEstimate: 280,
    topVarieties: ['มูซานคิง', 'นกหยิบ', 'หมอนทอง'],
    aboutStory: 'สวนทุเรียนสายพันธุ์หายาก เน้นวิถีเกษตรอินทรีย์ 100% ปราศจากสารเคมี มีลูกค้าระดับพรีเมียมจองข้ามปี ขอรับการตรวจสอบมาตรฐาน GAP และ Organic เพื่อเปิดแสดงในทำเนียบฟาร์ม',
    contact: {
      phoneNumber: '089-112-9904',
      lineId: '@maen_organic',
      facebook: 'สวนทุเรียนยายแม้น ระยอง',
    },
    gapCertNumber: 'GAP-TH-68-110432',
    certIssuedBy: 'กรมวิชาการเกษตร (กระทรวงเกษตรและสหกรณ์)',
    certValidUntil: '2029',
    certDocumentPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
    certificationList: [
      {
        name: 'GAP (Good Agricultural Practice)',
        shortCode: 'GAP',
        certNumber: 'GAP-TH-68-110432',
        issuedBy: 'กรมวิชาการเกษตร',
        validUntil: '2029',
        verified: true,
        documentPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
        fileType: 'image',
      },
      {
        name: 'Organic Thailand (มาตรฐานเกษตรอินทรีย์)',
        shortCode: 'ORGANIC',
        certNumber: 'ORG-TH-68-0091',
        issuedBy: 'มกอช.',
        validUntil: '2028',
        verified: true,
        documentPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
        fileType: 'image',
      },
    ],
    atmospherePhotos: [
      'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800&auto=format&fit=crop&q=80',
    ],
    hasSmartFarm: true,
    smartTechnologies: [
      { id: 'tech_1', name: 'ระบบน้ำอัจฉริยะ IoT', subtext: 'ควบคุมผ่านมือถือแม่นยำ', iconEmoji: '💧', active: true },
      { id: 'tech_2', name: 'เซนเซอร์วัดความชื้นในดิน', subtext: 'Soil Moisture 4 จุด', iconEmoji: '🌱', active: true },
    ],
    coordinates: { lat: 12.7781, lng: 101.6508 },
    googleMapsUrl: 'https://maps.google.com/?q=12.7781,101.6508',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

// In-memory request storage cache to always keep full binary/dataUrl intact
const inMemoryRequestsCache = new Map<string, FarmRegistrationRequest>();

// Populate in-memory cache with default static sample requests
DEFAULT_STATIC_SAMPLE_REQUESTS.forEach((req) => {
  inMemoryRequestsCache.set(req.id, req);
});

export function getInitialFarmRequests(): FarmRegistrationRequest[] {
  try {
    const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_REQUESTS_KEY) || '[]');
    if (Array.isArray(local) && local.length > 0) {
      // Merge with in-memory cache so images/docs are preserved
      return local.map((l: FarmRegistrationRequest) => {
        const mem = inMemoryRequestsCache.get(l.id);
        if (mem) {
          return {
            ...l,
            farmerIdCardPhoto: mem.farmerIdCardPhoto || l.farmerIdCardPhoto,
            certDocumentPhoto: mem.certDocumentPhoto || l.certDocumentPhoto,
            certificationList: mem.certificationList || l.certificationList,
            atmospherePhotos: mem.atmospherePhotos || l.atmospherePhotos,
          };
        }
        return l;
      });
    }
  } catch {}
  return Array.from(inMemoryRequestsCache.values());
}

/**
 * Safely cache requests to in-memory cache and localStorage.
 * Full records (including base64 photos/PDFs) are saved directly.
 * Only if browser quota is reached will it fallback gracefully without crashing.
 */
function safeSetLocalRequests(requests: FarmRegistrationRequest[]): void {
  // 1. Always save full high-res records into in-memory cache
  requests.forEach((r) => {
    inMemoryRequestsCache.set(r.id, r);
  });

  // 2. Try storing full data in localStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_REQUESTS_KEY, JSON.stringify(requests.slice(0, 20)));
  } catch (err) {
    // If quota exceeded, store up to 5 items or compressed copies without breaking other storage
    try {
      const smallerList = requests.slice(0, 5);
      localStorage.setItem(LOCAL_STORAGE_REQUESTS_KEY, JSON.stringify(smallerList));
    } catch {
      console.warn('LocalStorage quota limit reached, relying on in-memory & Firestore store');
    }
  }
}

const READ_REQUESTS_STORAGE_KEY = 'durian_read_admin_request_ids';
const READ_EVENT_NAME = 'durian:admin_requests_read_changed';

/**
 * Get all request IDs that have been viewed by admin
 */
export function getReadRequestIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_REQUESTS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Mark one or more request IDs as viewed
 */
export function markRequestsAsRead(ids: string | string[]): void {
  try {
    const current = getReadRequestIds();
    const toAdd = Array.isArray(ids) ? ids : [ids];
    let changed = false;
    toAdd.forEach((id) => {
      if (id && !current.has(id)) {
        current.add(id);
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(READ_REQUESTS_STORAGE_KEY, JSON.stringify(Array.from(current)));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(READ_EVENT_NAME));
      }
    }
  } catch {}
}

/**
 * Mark all requests of a given category as viewed
 */
export function markCategoryAsRead(
  category: 'manager_application' | 'farm_verification',
  requests: FarmRegistrationRequest[]
): void {
  const isManagerApp = (r: FarmRegistrationRequest) =>
    r.requestCategory === 'manager_application' ||
    (!r.requestCategory && !r.targetFarmId && r.requestType !== 'update_farm' && Boolean(r.farmerIdCardNumber));

  const targetRequests = requests.filter((r) =>
    category === 'manager_application' ? isManagerApp(r) : !isManagerApp(r)
  );
  if (targetRequests.length > 0) {
    markRequestsAsRead(targetRequests.map((r) => r.id));
  }
}

/**
 * Subscribe to read status changes
 */
export function subscribeReadRequestIds(callback: (readIds: Set<string>) => void): () => void {
  callback(getReadRequestIds());

  const handler = () => {
    callback(getReadRequestIds());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(READ_EVENT_NAME, handler);
    window.addEventListener('storage', handler);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(READ_EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    }
  };
}

/**
 * Deep clean undefined fields
 */
function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) res[k] = sanitize(v);
    }
    return res;
  }
  return obj;
}

/**
 * Submit a new Farm Registration, Manager Upgrade, or Farm Verification Request
 * (or resubmit an existing request that was marked for revision)
 */
export async function submitFarmRegistrationRequest(
  data: Omit<FarmRegistrationRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    existingRequestId?: string;
    createdAt?: string;
  }
): Promise<FarmRegistrationRequest> {
  const targetId =
    data.id ||
    data.existingRequestId ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  // Determine category
  const inferredCategory: 'manager_application' | 'farm_verification' =
    data.requestCategory ||
    (data.targetFarmId || data.requestType === 'update_farm'
      ? 'farm_verification'
      : data.farmerIdCardNumber
      ? 'manager_application'
      : 'farm_verification');

  const newRequest: FarmRegistrationRequest = {
    ...data,
    id: targetId,
    requestCategory: inferredCategory,
    requestType: data.requestType || (data.targetFarmId ? 'update_farm' : 'new_farm'),
    status: 'pending', // Reverts/sets status to pending (รอผลพิจารณาจาก admin)
    adminNotes: '', // Clears the previous revision note
    reviewedBy: undefined,
    reviewedAt: undefined,
    resubmittedAt: now,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  const cleaned = sanitize(newRequest);

  // 1. ส่งคำขอไปเก็บที่ server
  //    userId ที่ server บันทึกจริงมาจาก token ไม่ใช่ค่าที่ส่งไปในนี้
  //    จึงยื่นคำขอในนามคนอื่นไม่ได้
  try {
    await api.post('/farm-requests', cleaned);
  } catch (err) {
    // เก็บลง localStorage ต่อไปเพื่อให้หน้าจอยังเห็นคำขอที่เพิ่งกรอก
    // แต่ต้องโยน error ต่อ ไม่งั้นผู้ใช้จะนึกว่าส่งสำเร็จทั้งที่ไม่ถึง server
    console.warn('ส่งคำขอไปยังเซิร์ฟเวอร์ไม่สำเร็จ:', err);
    throw err;
  }

  // 2. Local Storage sync for fast instant UI response
  try {
    const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_REQUESTS_KEY) || '[]');
    // Filter out previous entry with same id or old revision requests for this user in same category
    const filtered = local.filter((r: FarmRegistrationRequest) => {
      if (r.id === targetId) return false;
      if (r.userId === data.userId && r.status === 'needs_revision') return false;
      return true;
    });
    filtered.unshift(newRequest);
    safeSetLocalRequests(filtered);
  } catch (err) {
    console.warn('Local storage cache update skipped:', err);
  }

  return newRequest;
}

/**
 * Submit a Farm Update Request specifically for existing managed farms
 */
export async function submitFarmUpdateRequest(
  targetFarm: DurianFarm,
  data: Partial<FarmRegistrationRequest> & { updateNotes?: string },
  currentUser: { uid: string; displayName?: string; username?: string; email?: string }
): Promise<FarmRegistrationRequest> {
  return submitFarmRegistrationRequest({
    requestType: 'update_farm',
    targetFarmId: targetFarm.id,
    updateNotes: data.updateNotes || 'ขอแก้ไขและปรับปรุงข้อมูลสวน',
    userId: currentUser.uid,
    userDisplayName: currentUser.displayName || currentUser.username || 'ผู้จัดการสวน',
    userEmailOrUsername: currentUser.email || currentUser.username || currentUser.uid,
    farmName: data.farmName || targetFarm.name,
    farmNameEn: data.farmNameEn !== undefined ? data.farmNameEn : targetFarm.nameEn,
    province: data.province || targetFarm.province,
    district: data.district || targetFarm.district || '',
    locationAddress: data.locationAddress || targetFarm.contact?.locationAddress || '',
    areaRai: data.areaRai || targetFarm.areaRai || 20,
    totalTreesEstimate: data.totalTreesEstimate || targetFarm.totalTrees || 300,
    topVarieties: data.topVarieties || targetFarm.topVarieties || ['หมอนทอง'],
    aboutStory: data.aboutStory !== undefined ? data.aboutStory : (targetFarm.aboutStory || ''),
    contact: data.contact || targetFarm.contact || {},
    gapCertNumber: data.gapCertNumber || targetFarm.certificationDetails?.[0]?.certNumber || 'GAP-TH-2026',
    certIssuedBy: data.certIssuedBy || targetFarm.certificationDetails?.[0]?.issuedBy || 'กรมวิชาการเกษตร',
    certValidUntil: data.certValidUntil || targetFarm.certificationDetails?.[0]?.validUntil || '2028',
    certDocumentPhoto: data.certDocumentPhoto || targetFarm.certDocumentPhoto || targetFarm.certificationDetails?.[0]?.documentPhoto,
    certificationList: data.certificationList || targetFarm.certificationDetails || [],
    atmospherePhotos: data.atmospherePhotos || targetFarm.atmospherePhotos || targetFarm.photos || [],
    hasSmartFarm: data.hasSmartFarm !== undefined ? data.hasSmartFarm : (targetFarm.hasSmartFarm ?? false),
    smartTechnologies: data.smartTechnologies || targetFarm.smartTechnologies || [],
  });
}

/**
 * Subscribe to the current user's farm registration requests
 */
export function subscribeUserFarmRequest(
  userId: string,
  onUpdated: (requests: FarmRegistrationRequest[]) => void
): () => void {
  // Check local storage first
  try {
    const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_REQUESTS_KEY) || '[]');
    const userReqs = local.filter((r: FarmRegistrationRequest) => r.userId === userId);
    if (userReqs.length > 0) {
      onUpdated(userReqs);
    }
  } catch {}

  // เดิมใช้ onSnapshot ของ Firestore ที่อัปเดตเองแบบ realtime
  // Postgres + REST ไม่มีของแบบนั้น จึงดึงครั้งเดียวตอนเรียก
  // แต่คง signature เดิม (คืนฟังก์ชันยกเลิก) ไว้ให้คอมโพเนนต์ไม่ต้องแก้
  let cancelled = false;

  api
    .get<{ requests: FarmRegistrationRequest[] }>('/farm-requests/mine')
    .then(({ requests }) => {
      if (cancelled) return;

      // เก็บสำเนาไว้ใน localStorage ให้หน้าจอขึ้นทันทีในครั้งถัดไป
      if (requests.length > 0) {
        try {
          const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_REQUESTS_KEY) || '[]');
          const otherReqs = local.filter((r: FarmRegistrationRequest) => r.userId !== userId);
          safeSetLocalRequests([...requests, ...otherReqs]);
        } catch {}
      }

      onUpdated(requests);
    })
    .catch((err) => {
      // ยังไม่ได้ล็อกอินหรือต่อ server ไม่ได้ -- ใช้สำเนาใน localStorage ต่อไป
      console.warn('โหลดคำขอของผู้ใช้ไม่สำเร็จ:', err);
    });

  return () => {
    cancelled = true;
  };
}

/**
 * Subscribe to all farm requests for Admin Approval Hub
 */
export function subscribeAllFarmRequests(
  onUpdated: (requests: FarmRegistrationRequest[]) => void
): () => void {
  // API คืนคำขอทั้งหมดให้เฉพาะแอดมิน ถ้าไม่ใช่แอดมินจะได้แค่ของตัวเอง
  // (ของเดิมฝั่ง Firestore ใครก็อ่านคำขอของคนอื่นได้ รวมถึงเลขบัตรประชาชน
  //  และรูปบัตรที่แนบมาด้วย)
  let cancelled = false;

  api
    .get<{ requests: FarmRegistrationRequest[] }>('/farm-requests')
    .then(({ requests }) => {
      if (cancelled) return;
      if (requests.length > 0) {
        safeSetLocalRequests(requests);
        onUpdated(requests);
      } else {
        onUpdated(getInitialFarmRequests());
      }
    })
    .catch((err) => {
      if (cancelled) return;
      console.warn('โหลดรายการคำขอไม่สำเร็จ:', err);
      onUpdated(getInitialFarmRequests());
    });

  return () => {
    cancelled = true;
  };
}

/**
 * Generate starter sample individual trees for approved farm
 */
function generateInitialTreesForFarm(farmCode: string, varieties: string[], count = 6): IndividualTree[] {
  const treeList: IndividualTree[] = [];
  const primaryVariety = varieties[0] || 'หมอนทอง';

  for (let i = 1; i <= count; i++) {
    const padded = String(i).padStart(3, '0');
    const varName = varieties[(i - 1) % varieties.length] || primaryVariety;
    treeList.push({
      id: `tree_${farmCode.toLowerCase()}_${padded}`,
      code: `${farmCode.toUpperCase()}-T${padded}`,
      name: `${varName} ต้นที่ ${i}`,
      variety: varName,
      category: i <= 4 ? 'durian_main' : 'durian_rare',
      categoryLabel: i <= 4 ? 'ทุเรียนสายพันธุ์หลัก' : 'ทุเรียนสายพันธุ์คัดพิเศษ',
      propagationType: 'grafted',
      propagationLabel: 'เสียบยอดพันธุ์แท้',
      propagationCode: i % 2 === 1 ? 'AUTO' : 'PHOTO',
      zone: `แปลง A (โซนหลัก)`,
      plantedDate: '10 พ.ค. 2558',
      ageYears: 8 + (i % 4),
      yieldFruitCount: 65 + i * 5,
      yieldWeightKg: 240 + i * 18,
      diariesCount: 42 + i * 3,
      rating: 9.2 + ((i * 2) % 8) / 10,
      reviewCount: 4 + i,
      healthStatus: 'excellent',
      sweetnessBrix: 32 + (i % 4),
      notes: 'ต้นสมบูรณ์ ได้รับมาตรฐานการรับรอง GAP',
      reviews: [],
    });
  }

  return treeList;
}

/**
 * Admin Action: Approve Request
 * - For Manager Role Application: Upgrades user role to 'manager' so they can register their farm later. Does NOT create an auto-published farm.
 * - For Farm Verification / Registration: Validates and saves the verified farm into /farms with verified credentials.
 */
export async function approveFarmRequest(
  request: FarmRegistrationRequest,
  adminName: string
): Promise<DurianFarm | null> {
  // งานทั้งหมดอยู่ฝั่ง server แล้ว -- สร้างหรือเขียนทับฟาร์ม เลื่อน role ผู้ยื่น
  // เป็นผู้จัดการสวน ผูกฟาร์มกับบัญชี และอัปเดตสถานะคำขอ ทำใน transaction เดียว
  //
  // เดิมโค้ดชุดนี้ประกอบข้อมูลฟาร์มเองในเบราว์เซอร์แล้วยิงเขียน 4 ที่ติดกัน
  // โดยแต่ละก้อนครอบ try/catch ที่กลืน error ทิ้ง ถ้าพังกลางทางจะได้สถานะ
  // ครึ่ง ๆ กลาง ๆ เช่นฟาร์มถูกสร้างแล้วแต่ผู้ใช้ยังเป็น user อยู่
  const { farm } = await api.post<{ farm: DurianFarm | null }>(
    `/farm-requests/${encodeURIComponent(request.id)}/approve`,
    { adminNotes: request.adminNotes ?? null }
  );

  // อัปเดตสำเนาใน localStorage ให้หน้าจอตรงกับของจริงทันที
  try {
    const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_REQUESTS_KEY) || '[]');
    const updated = local.map((r: FarmRegistrationRequest) =>
      r.id === request.id
        ? {
            ...r,
            status: 'approved',
            reviewedBy: adminName,
            reviewedAt: new Date().toISOString(),
            createdFarmId: farm ? farm.id : undefined,
          }
        : r
    );
    safeSetLocalRequests(updated);
  } catch {}

  return farm;
}

/**
 * Seed high quality sample Farm Registration & Manager Upgrade Requests for instant Admin evaluation
 */
export async function seedSampleManagerRequests(): Promise<FarmRegistrationRequest[]> {
  // Sample 1: Manager Role Application (คำขอสิทธิ์ Manager)
  const sample1: Omit<FarmRegistrationRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
    userId: 'usr_farmer_somchai_2026',
    userDisplayName: 'สมชาย วงศ์เกษตร',
    userEmailOrUsername: 'somchai.farm@duritrack.th',
    requestCategory: 'manager_application',
    requestType: 'new_farm',
    farmName: 'สวนทุเรียนลุงสมชาย จันทบุรี',
    farmNameEn: 'Somchai Chanthaburi Durian Orchard',
    farmerFullName: 'นายสมชาย วงศ์เกษตร',
    farmerIdCardNumber: '1229900341829',
    farmerIdCardPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
    farmerIdCardFileType: 'image',
    province: 'จันทบุรี',
    district: 'ท่าใหม่',
    locationAddress: '128 หมู่ 4 ต.เขาวัว อ.ท่าใหม่ จ.จันทบุรี 22120',
    areaRai: 35,
    totalTreesEstimate: 450,
    topVarieties: ['หมอนทอง', 'ก้านยาว', 'พวงมณี'],
    aboutStory: 'เกษตรกรชาวสวนทุเรียนจันทบุรี ต้องการขอรับสิทธิ์ Manager เพื่อบริหารจัดการแปลงทุเรียนและบันทึกประวัติต้น',
    contact: {
      phoneNumber: '081-492-8841',
      lineId: '@somchai_durian',
      facebook: 'สวนทุเรียนลุงสมชาย จันทบุรี',
    },
    gapCertNumber: 'GAP-TH-68-092281',
    certIssuedBy: 'สำนักวิจัยและพัฒนาการเกษตรเขตที่ 6 (กรมวิชาการเกษตร)',
    certValidUntil: '2028',
    certDocumentPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
  };

  // Sample 2: Farm Standard Verification (ขอตรวจสอบมาตรฐาน GAP & Organic)
  const sample2: Omit<FarmRegistrationRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
    userId: 'usr_farmer_maen_2026',
    userDisplayName: 'ยายแม้น การ์เด้น',
    userEmailOrUsername: 'maen.rayong@duritrack.th',
    requestCategory: 'farm_verification',
    requestType: 'new_farm',
    farmName: 'สวนยายแม้น ระยองการ์เด้น (อินทรีย์ปลอดสารเคมี)',
    farmNameEn: 'Grandma Maen Organic Rayong Durian',
    farmerFullName: 'นางแม้น จันทรศิริ',
    farmerIdCardNumber: '3210400192841',
    farmerIdCardPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
    farmerIdCardFileType: 'image',
    province: 'ระยอง',
    district: 'แกลง',
    locationAddress: '88 หมู่ 2 ต.วังหว้า อ.แกลง จ.ระยอง 21110',
    areaRai: 22,
    totalTreesEstimate: 280,
    topVarieties: ['มูซานคิง', 'นกหยิบ', 'หมอนทอง'],
    aboutStory: 'สวนทุเรียนสายพันธุ์หายาก เน้นวิถีเกษตรอินทรีย์ 100% ปราศจากสารเคมี มีลูกค้าระดับพรีเมียมจองข้ามปี ขอรับการตรวจสอบมาตรฐาน GAP และ Organic เพื่อเปิดแสดงในทำเนียบฟาร์ม',
    contact: {
      phoneNumber: '089-112-9904',
      lineId: '@maen_organic',
      facebook: 'สวนทุเรียนยายแม้น ระยอง',
    },
    gapCertNumber: 'GAP-TH-68-110432',
    certIssuedBy: 'กรมวิชาการเกษตร (กระทรวงเกษตรและสหกรณ์)',
    certValidUntil: '2029',
    certDocumentPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
    certificationList: [
      {
        name: 'GAP (Good Agricultural Practice)',
        shortCode: 'GAP',
        certNumber: 'GAP-TH-68-110432',
        issuedBy: 'กรมวิชาการเกษตร',
        validUntil: '2029',
        verified: true,
        documentPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
        fileType: 'image',
      },
      {
        name: 'Organic Thailand (มาตรฐานเกษตรอินทรีย์)',
        shortCode: 'ORGANIC',
        certNumber: 'ORG-TH-68-0091',
        issuedBy: 'มกอช.',
        validUntil: '2028',
        verified: true,
        documentPhoto: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
        fileType: 'image',
      }
    ],
    atmospherePhotos: [
      'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800&auto=format&fit=crop&q=80',
    ],
    hasSmartFarm: true,
    smartTechnologies: [
      { id: 'tech_1', name: 'ระบบน้ำอัจฉริยะ IoT', subtext: 'ควบคุมผ่านมือถือแม่นยำ', iconEmoji: '💧', active: true },
      { id: 'tech_2', name: 'เซนเซอร์วัดความชื้นในดิน', subtext: 'Soil Moisture 4 จุด', iconEmoji: '🌱', active: true },
    ],
    coordinates: { lat: 12.7781, lng: 101.6508 },
    googleMapsUrl: 'https://maps.google.com/?q=12.7781,101.6508',
  };

  const req1 = await submitFarmRegistrationRequest(sample1);
  const req2 = await submitFarmRegistrationRequest(sample2);
  return [req1, req2];
}

/**
 * Admin Action: Reject or Request Revision
 */
export async function rejectFarmRequest(
  requestId: string,
  adminName: string,
  adminNotes: string,
  action: 'rejected' | 'needs_revision' = 'needs_revision'
): Promise<void> {
  const now = new Date().toISOString();
  const notesToSave =
    adminNotes.trim() ||
    (action === 'rejected'
      ? 'เอกสารหรือข้อมูลไม่ผ่านเกณฑ์การตรวจสอบ'
      : 'กรุณาตรวจสอบและแนบเอกสารเพิ่มเติม');

  await api.post(`/farm-requests/${encodeURIComponent(requestId)}/reject`, {
    adminNotes: notesToSave,
    needsRevision: action === 'needs_revision',
  });

  try {
    const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_REQUESTS_KEY) || '[]');
    const updated = local.map((r: FarmRegistrationRequest) =>
      r.id === requestId
        ? { ...r, status: action, adminNotes: notesToSave, reviewedBy: adminName, reviewedAt: now }
        : r
    );
    safeSetLocalRequests(updated);
  } catch {}
}

/**
 * Admin Action: Reset Request back to Pending
 */
export async function resetFarmRequestToPending(
  requestId: string,
  adminName: string
): Promise<void> {
  const now = new Date().toISOString();

  await api.post(`/farm-requests/${encodeURIComponent(requestId)}/reset`, {});

  try {
    const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_REQUESTS_KEY) || '[]');
    const updated = local.map((r: FarmRegistrationRequest) =>
      r.id === requestId
        ? { ...r, status: 'pending', adminNotes: '', reviewedBy: adminName, reviewedAt: now }
        : r
    );
    safeSetLocalRequests(updated);
  } catch {}
}
