import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminApprovalHubModal } from './AdminApprovalHubModal';
import type { FarmRegistrationRequest } from '../types';
import type { RegionalCertRequest } from '../services/regionalCertificationService';

/**
 * ทางเข้าหน้าจับคู่ใบระดับโซนจากศูนย์อนุมัติ
 *
 * คำขอใบระดับโซนถูกเก็บค้างไว้ตั้งแต่ 014 แต่ไม่มีทางไหนในหน้าเว็บเปิดดูได้เลย
 * ต่อให้หน้าจับคู่ทำเสร็จ ถ้าไม่มีทางเข้า แอดมินก็ยังไม่รู้ว่ามีงานค้างอยู่
 * และเจ้าของสวนก็ยังไม่ได้ตราเหมือนเดิม
 */

const FARM_REQUEST: FarmRegistrationRequest = {
  id: 'req_regional_tab',
  requestCategory: 'manager_application',
  userId: 'u-owner',
  userDisplayName: 'เจ้าของสวนทดสอบ',
  userEmailOrUsername: 'owner_test',
  farmName: 'สวนทดสอบแท็บโซน',
  province: 'จันทบุรี',
  district: 'ท่าใหม่',
  areaRai: 10,
  totalTreesEstimate: 100,
  topVarieties: ['หมอนทอง'],
  aboutStory: 'เรื่องราวสวน',
  contact: { phoneNumber: '0812345678' },
  gapCertNumber: 'กษ1',
  certIssuedBy: 'กรมวิชาการเกษตร',
  certValidUntil: '2029',
  status: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const PENDING: RegionalCertRequest = {
  id: 7,
  farmId: 'farm-xyz',
  farmName: 'สวนที่รอจับคู่โซน',
  province: 'ศรีสะเกษ',
  typeCode: 'GI',
  typeNameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
  certNumber: 'GI-0007',
  issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
  status: 'pending',
  adminNotes: '',
  resolvedBy: '',
  resolvedAt: null,
  createdAt: '2026-08-30T04:00:00.000Z',
  regionalCertificationId: null,
  linkedRegionName: '',
};

const fetchRequests = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'admin-1', displayName: 'แอดมิน', role: 'admin' } }),
}));

vi.mock('../services/farmRequestService', () => ({
  subscribeAllFarmRequests: (cb: (r: FarmRegistrationRequest[]) => void) => {
    cb([FARM_REQUEST]);
    return () => {};
  },
  getInitialFarmRequests: () => [FARM_REQUEST],
  getReadRequestIds: () => new Set<string>(),
  subscribeReadRequestIds: () => () => {},
  markRequestsAsRead: () => {},
  approveFarmRequest: vi.fn(),
  rejectFarmRequest: vi.fn(),
  resetFarmRequestToPending: vi.fn(),
  seedSampleManagerRequests: vi.fn(),
  revealFarmRequestIdCard: vi.fn(),
}));

vi.mock('../services/regionalCertificationService', () => ({
  fetchRegionalZones: () => Promise.resolve([]),
  fetchPendingRegionalCertRequests: () => fetchRequests(),
  linkRegionalCertRequest: vi.fn(),
  rejectRegionalCertRequest: vi.fn(),
}));

beforeEach(() => {
  fetchRequests.mockReset().mockResolvedValue([PENDING]);
});

describe('แท็บจับคู่ใบระดับโซนในศูนย์อนุมัติ', () => {
  test('มีปุ่มเข้าหน้าจับคู่ พร้อมบอกจำนวนคำขอที่ค้าง', async () => {
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    expect(await screen.findByRole('button', { name: /จับคู่ใบระดับโซน \(1\)/ })).toBeInTheDocument();
  });

  test('กดแล้วเห็นคำขอที่รอจับคู่', async () => {
    const user = userEvent.setup();
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /จับคู่ใบระดับโซน/ }));

    expect(await screen.findByText(PENDING.farmName)).toBeInTheDocument();
  });

  test('เรียกดูรายการไม่สำเร็จ ก็ต้องไม่ทำให้ศูนย์อนุมัติทั้งหน้าพัง', async () => {
    // ผู้ใช้ที่ไม่ใช่แอดมินจะได้ 403 จาก endpoint นี้ ซึ่งไม่ควรลากหน้าทั้งหน้าไปด้วย
    fetchRequests.mockRejectedValue(new Error('ต้องมีสิทธิ์ผู้ดูแลระบบ'));
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /จับคู่ใบระดับโซน/ })).toBeInTheDocument()
    );
    expect(screen.getAllByText(FARM_REQUEST.farmName).length).toBeGreaterThan(0);
  });
});
