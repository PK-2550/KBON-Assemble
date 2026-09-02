import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminApprovalHubModal } from './AdminApprovalHubModal';
import type { FarmRegistrationRequest } from '../types';
import type { DataRetentionReport } from '../services/dataRetentionService';

/**
 * ทางเข้ารายงานการล้างข้อมูลจากศูนย์อนุมัติ
 *
 * ศูนย์อนุมัติเป็นหน้าเดียวที่แอดมินเข้าถึงได้จากแถบนำทาง ถ้ารายงานนี้
 * ไม่มีทางเข้า ก็ยังไม่ต่างจากตอนที่อ่านได้ทาง SQL ทางเดียว
 */

const FARM_REQUEST: FarmRegistrationRequest = {
  id: 'req_retention_tab',
  requestCategory: 'manager_application',
  userId: 'u-owner',
  userDisplayName: 'เจ้าของสวนทดสอบ',
  userEmailOrUsername: 'owner_test',
  farmName: 'สวนทดสอบแท็บบันทึกการล้าง',
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

const REPORT: DataRetentionReport = {
  entries: [
    {
      id: 1,
      farmRequestId: 'req_old_999',
      fieldsCleared: ['farmer_full_name'],
      rejectedAt: '2026-05-01T00:00:00.000Z',
      purgedAt: '2026-08-01T00:00:00.000Z',
      triggerSource: 'auto',
    },
  ],
  summary: {
    retentionDays: 90,
    totalPurged: 1,
    lastPurgedAt: '2026-08-01T00:00:00.000Z',
    pendingCount: 0,
    overdueCount: 0,
    nextDueAt: null,
  },
};

const fetchReport = vi.fn();

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
  fetchRegionalCertRequests: () => Promise.resolve([]),
  linkRegionalCertRequest: vi.fn(),
  rejectRegionalCertRequest: vi.fn(),
  createRegionalZone: vi.fn(),
  updateRegionalZone: vi.fn(),
}));

vi.mock('../services/dataRetentionService', () => ({
  fetchDataRetentionReport: () => fetchReport(),
}));

beforeEach(() => {
  fetchReport.mockReset().mockResolvedValue(REPORT);
});

describe('แท็บบันทึกการล้างข้อมูลในศูนย์อนุมัติ', () => {
  test('มีปุ่มเข้ารายงาน', async () => {
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    expect(
      await screen.findByRole('button', { name: /บันทึกการล้างข้อมูล/ })
    ).toBeInTheDocument();
  });

  test('กดแล้วเห็นรายงาน', async () => {
    const user = userEvent.setup();
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /บันทึกการล้างข้อมูล/ }));

    expect(await screen.findByText('req_old_999')).toBeInTheDocument();
  });

  test('ยังไม่กดเข้าแท็บ ต้องไม่ยิงขอรายงาน', async () => {
    // รายงานนี้เปิดดูนาน ๆ ครั้ง ไม่ควรดึงมาทุกครั้งที่เปิดศูนย์อนุมัติ
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    await screen.findByRole('button', { name: /บันทึกการล้างข้อมูล/ });
    expect(fetchReport).not.toHaveBeenCalled();
  });

  test('กลับไปแท็บคำขอได้ตามปกติ', async () => {
    const user = userEvent.setup();
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /บันทึกการล้างข้อมูล/ }));
    await screen.findByText('req_old_999');

    await user.click(screen.getByRole('button', { name: /รอการตรวจสอบ/ }));

    expect(screen.getAllByText(FARM_REQUEST.farmName).length).toBeGreaterThan(0);
  });
});
