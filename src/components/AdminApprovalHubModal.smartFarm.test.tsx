import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminApprovalHubModal } from './AdminApprovalHubModal';
import type { FarmRegistrationRequest } from '../types';
import type { CertificationTypeOption } from '../services/certificationTypeService';

/**
 * ศูนย์อนุมัติต้องแสดง Smart Farm ที่เกษตรกรระบุมา
 *
 * หัวข้อ Section 4 บอกว่ามี Tech อยู่แล้ว แต่ก่อนหน้านี้ไม่เคยแสดงจริง
 * แอดมินจึงตัดสินคำขอที่อ้างว่ามีระบบ IoT โดยไม่เห็นว่าคืออะไรบ้าง
 * เป็นอาการเดียวกับใบ GI ตอนก่อนแก้ที่ข้อมูลมีอยู่แต่ไม่โผล่ให้เห็น
 */

const TYPES: CertificationTypeOption[] = [
  { code: 'GAP', tier: 'farm', name: 'GAP', nameTh: 'มาตรฐาน GAP', requiresExpiry: true, sortOrder: 1 },
];

function makeRequest(over: Partial<FarmRegistrationRequest> = {}): FarmRegistrationRequest {
  return {
    id: 'req_smart_farm',
    requestCategory: 'manager_application',
    userId: 'u-owner',
    userDisplayName: 'เจ้าของสวนทดสอบ',
    userEmailOrUsername: 'owner_test',
    farmName: 'สวนทดสอบสมาร์ทฟาร์ม',
    province: 'จันทบุรี',
    district: 'ท่าใหม่',
    areaRai: 10,
    totalTreesEstimate: 100,
    topVarieties: ['หมอนทอง'],
    aboutStory: 'เรื่องราวสวน',
    contact: { phoneNumber: '0812345678' },
    gapCertNumber: '',
    certIssuedBy: '',
    certValidUntil: '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hasSmartFarm: true,
    smartTechnologies: [
      { id: 'st-d1', name: 'ระบบน้ำหยดอัตโนมัติ (Smart Irrigation)', subtext: 'ควบคุมปริมาณน้ำผ่านสมาร์ทโฟน', iconEmoji: '💧', active: true },
      { id: 'st-d3', name: 'โดรนพ่นปุ๋ยและสำรวจแปลงทุเรียน (Agricultural Drone)', subtext: 'ประเมินสุขภาพใบและลดสารเคมี 40%', iconEmoji: '🚁', active: true },
    ],
    ...over,
  } as FarmRegistrationRequest;
}

// ตัวถือคำขอปัจจุบัน แต่ละ render อ่านค่านี้ตอน subscribe ใหม่
let current: FarmRegistrationRequest = makeRequest();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'admin-1', displayName: 'แอดมิน', role: 'admin' } }),
}));

vi.mock('../services/farmRequestService', () => ({
  subscribeAllFarmRequests: (cb: (r: FarmRegistrationRequest[]) => void) => {
    cb([current]);
    return () => {};
  },
  getInitialFarmRequests: () => [current],
  getReadRequestIds: () => new Set<string>(),
  subscribeReadRequestIds: () => () => {},
  markRequestsAsRead: () => {},
  approveFarmRequest: vi.fn(),
  rejectFarmRequest: vi.fn(),
  resetFarmRequestToPending: vi.fn(),
  seedSampleManagerRequests: vi.fn(),
  revealFarmRequestIdCard: vi.fn(),
}));

vi.mock('../services/certificationTypeService', () => ({
  fetchCertificationTypes: () => Promise.resolve(TYPES),
}));

vi.mock('../services/regionalCertificationService', () => ({
  fetchRegionalZones: () => Promise.resolve([]),
  fetchRegionalCertRequests: () => Promise.resolve([]),
  linkRegionalCertRequest: vi.fn(),
  rejectRegionalCertRequest: vi.fn(),
  createRegionalZone: vi.fn(),
  updateRegionalZone: vi.fn(),
}));

vi.mock('../services/dataRetentionService', () => ({
  fetchDataRetentionReport: () => Promise.resolve({ entries: [], summary: {} }),
}));

function renderHub(request: FarmRegistrationRequest) {
  current = request;
  render(<AdminApprovalHubModal isOpen onClose={() => {}} />);
}

describe('Smart Farm ในหน้าตรวจคำขอ', () => {
  test('คำขอที่ระบุ Smart Farm ต้องเห็นชื่ออุปกรณ์ที่เลือก', async () => {
    renderHub(makeRequest());

    expect(await screen.findByText(/ระบบน้ำหยดอัตโนมัติ/)).toBeInTheDocument();
    expect(screen.getByText(/โดรนพ่นปุ๋ยและสำรวจแปลงทุเรียน/)).toBeInTheDocument();
    expect(screen.getByText(/ประเมินสุขภาพใบและลดสารเคมี 40%/)).toBeInTheDocument();
  });

  test('บอกจำนวนระบบที่เลือก', async () => {
    renderHub(makeRequest());

    expect(await screen.findByText(/Smart Farm \(2 ระบบ\)/)).toBeInTheDocument();
  });

  test('คำขอที่ไม่มี Smart Farm ต้องไม่ขึ้นส่วนนี้', async () => {
    renderHub(makeRequest({ hasSmartFarm: false, smartTechnologies: [] }));

    expect(await screen.findByText(/พันธุ์ทุเรียน & ภาพบรรยากาศ/)).toBeInTheDocument();
    expect(screen.queryByText(/Smart Farm \(/)).not.toBeInTheDocument();
  });

  test('ระบุว่ามี Smart Farm แต่ไม่ได้เลือกอุปกรณ์ ต้องบอกให้รู้', async () => {
    renderHub(makeRequest({ hasSmartFarm: true, smartTechnologies: [] }));

    expect(await screen.findByText(/ไม่ได้เลือกอุปกรณ์/)).toBeInTheDocument();
  });
});
