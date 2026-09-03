import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AdminApprovalHubModal } from './AdminApprovalHubModal';
import type { FarmRegistrationRequest } from '../types';
import type { CertificationTypeOption } from '../services/certificationTypeService';

/**
 * ศูนย์อนุมัติต้องเห็นเลขที่เที่ยวขนส่งของใบระดับการขนส่งรายเที่ยว
 *
 * ใบอย่าง PHYTO ออกให้ต่อการส่งออกหนึ่งครั้ง ตัวที่ทำให้ใบนี้มีความหมายคือ
 * เที่ยวขนส่งที่มันผูกอยู่ ถ้าแอดมินไม่เห็นค่านั้น ก็ตัดสินใบนี้โดยไม่เห็น
 * ข้อมูลชิ้นเดียวที่แยกมันออกจากใบอื่นได้
 */

const TYPES: CertificationTypeOption[] = [
  { code: 'GAP', tier: 'farm', name: 'GAP', nameTh: 'มาตรฐาน GAP', requiresExpiry: true, sortOrder: 1 },
  { code: 'PHYTO', tier: 'shipment', name: 'PHYTO', nameTh: 'ใบรับรองสุขอนามัยพืช', requiresExpiry: true, sortOrder: 5 },
];

const REQUEST: FarmRegistrationRequest = {
  id: 'req_shipment_ref',
  requestCategory: 'manager_application',
  userId: 'u-owner',
  userDisplayName: 'เจ้าของสวนทดสอบ',
  userEmailOrUsername: 'owner_test',
  farmName: 'สวนทดสอบใบส่งออก',
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
  certificationList: [
    {
      name: 'GAP',
      shortCode: 'GAP',
      certNumber: 'กษ 01-1',
      issuedBy: 'กรมวิชาการเกษตร',
      validUntil: '2571',
      verified: false,
    },
    {
      name: 'PHYTO',
      shortCode: 'PHYTO',
      certNumber: 'PC-2569-00812',
      issuedBy: 'กรมวิชาการเกษตร',
      validUntil: '2569-12-31',
      shipmentRef: 'CN-SHT-2569-0451',
      verified: false,
    },
  ],
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'admin-1', displayName: 'แอดมิน', role: 'admin' } }),
}));

vi.mock('../services/farmRequestService', () => ({
  subscribeAllFarmRequests: (cb: (r: FarmRegistrationRequest[]) => void) => {
    cb([REQUEST]);
    return () => {};
  },
  getInitialFarmRequests: () => [REQUEST],
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

async function certRow(shortCode: string): Promise<HTMLElement> {
  const rows = await screen.findAllByTestId('request-cert-row');
  const found = rows.find((r) => within(r).queryByText(shortCode));
  if (!found) throw new Error(`ไม่พบแถวใบรับรอง ${shortCode}`);
  return found;
}

describe('เลขที่เที่ยวขนส่งในหน้าตรวจคำขอ', () => {
  test('ใบระดับการขนส่ง ต้องเห็นเลขที่เที่ยวขนส่ง', async () => {
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    const phyto = await certRow('PHYTO');
    expect(within(phyto).getByText('CN-SHT-2569-0451')).toBeInTheDocument();
  });

  test('ใบของสวนตามปกติ ไม่ต้องมีช่องนี้', async () => {
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    const gap = await certRow('GAP');
    expect(within(gap).queryByText(/เลขที่เที่ยวขนส่ง/)).not.toBeInTheDocument();
  });

  test('ต้องเตือนว่าใบนี้จะไม่ขึ้นเป็นตราบนหน้าสวน', async () => {
    // แอดมินอนุมัติแล้วตราไม่ขึ้น ถ้าไม่บอกก็จะนึกว่าระบบพัง
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    const phyto = await certRow('PHYTO');
    expect(within(phyto).getByText(/ไม่ขึ้นเป็นตรา/)).toBeInTheDocument();
  });
});
