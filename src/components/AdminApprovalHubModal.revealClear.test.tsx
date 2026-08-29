import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminApprovalHubModal } from './AdminApprovalHubModal';
import type { FarmRegistrationRequest } from '../types';

/**
 * เลขบัตรที่เปิดเผยไว้ต้องกลับไปถูกปิดบังทันทีที่ปิดหน้าต่างดูเอกสาร
 *
 * เดิมล้างค่าเฉพาะตอนปิดศูนย์อนุมัติทั้งหน้าต่าง แอดมินที่กดดูเอกสารแล้วปิด
 * แค่หน้าต่างรูป จึงยังเห็นเลข 13 หลักค้างอยู่บนจอต่อไปเรื่อย ๆ
 * โดยไม่มีบันทึกการเข้าถึงเพิ่ม ทั้งที่ตั้งใจให้ทุกครั้งที่เห็นข้อมูลต้องมีบันทึก
 */

const REQUEST: FarmRegistrationRequest = {
  id: 'req_reveal_1',
  requestCategory: 'manager_application',
  userId: 'u-owner',
  userDisplayName: 'เจ้าของสวนทดสอบ',
  userEmailOrUsername: 'owner_test',
  farmName: 'สวนทดสอบการปิดบัง',
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
  farmerFullName: 'นายทดสอบ เปิดเผย',
  farmerIdCardMasked: 'X-XXXX-XXXXX-XX-8',
  hasIdCardPhoto: true,
};

const FULL_ID = '1229900341828';
const FULL_PHOTO = 'data:image/jpeg;base64,VEVTVF9QSE9UTw==';

const revealMock = vi.fn();

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
  revealFarmRequestIdCard: (...args: unknown[]) => revealMock(...args),
}));

async function openRequestAndReveal(user: ReturnType<typeof userEvent.setup>) {
  // เลือกคำขอจากรายการ -- ชื่อสวนโผล่หลายที่ (รายการซ้ายกับหัวข้อขวา) จึงเลือกตัวแรก
  const rows = await screen.findAllByText(REQUEST.farmName);
  await user.click(rows[0]);

  // ต้องเห็นค่าที่ปิดบังก่อน
  expect(await screen.findByText('X-XXXX-XXXXX-XX-8')).toBeInTheDocument();

  // กดเปิดดูเอกสารบัตร ซึ่งดึงทั้งเลขเต็มและรูปมาพร้อมกัน
  await user.click(screen.getByRole('button', { name: /เปิดดูเอกสารบัตร/ }));
  await waitFor(() => expect(screen.getByText(FULL_ID)).toBeInTheDocument());
}

describe('ปิดหน้าต่างดูเอกสารแล้วเลขบัตรต้องกลับไปถูกปิดบัง', () => {
  beforeEach(() => {
    revealMock.mockReset();
    revealMock.mockResolvedValue({
      farmerIdCardNumber: FULL_ID,
      farmerIdCardPhoto: FULL_PHOTO,
      farmerIdCardFileType: 'image',
    });
  });

  it('ปิดแค่หน้าต่างรูป เลขเต็มต้องหายไปทันที ไม่ต้องรอปิดศูนย์อนุมัติ', async () => {
    const user = userEvent.setup();
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    await openRequestAndReveal(user);

    // ปิดเฉพาะหน้าต่างดูเอกสาร
    await user.click(screen.getByRole('button', { name: /ปิดหน้าต่างเอกสาร/ }));

    await waitFor(() => {
      expect(screen.queryByText(FULL_ID)).not.toBeInTheDocument();
    });
    expect(screen.getByText('X-XXXX-XXXXX-XX-8')).toBeInTheDocument();
  });

  it('กดดูอีกครั้งต้องยิงขอใหม่ จึงมีบันทึกการเข้าถึงเพิ่มทุกครั้งที่เห็น', async () => {
    const user = userEvent.setup();
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    await openRequestAndReveal(user);
    expect(revealMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /ปิดหน้าต่างเอกสาร/ }));
    await waitFor(() => expect(screen.queryByText(FULL_ID)).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /เปิดดูเอกสารบัตร/ }));
    await waitFor(() => expect(screen.getByText(FULL_ID)).toBeInTheDocument());

    expect(revealMock).toHaveBeenCalledTimes(2);
  });
});
