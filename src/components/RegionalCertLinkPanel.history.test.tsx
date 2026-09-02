import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegionalCertLinkPanel } from './RegionalCertLinkPanel';
import type { RegionalCertRequest, RegionalZone } from '../services/regionalCertificationService';

/**
 * ดูคำขอใบระดับโซนที่จัดการไปแล้ว
 *
 * เซิร์ฟเวอร์รองรับการกรองตามสถานะมาตั้งแต่ต้น แต่หน้าจอเรียกแค่ที่ยังค้าง
 * พอแอดมินจับคู่หรือปฏิเสธไป คำขอก็หายไปจากหน้าจอตลอดกาล
 *
 * ผลคือไม่มีทางย้อนดูว่าใบใบหนึ่งเคยถูกตัดสินไปว่าอย่างไร ใครตัดสิน และเพราะอะไร
 * ซึ่งสำคัญตอนเจ้าของสวนโทรมาถามว่าทำไมตรายังไม่ขึ้น
 */

const ZONE: RegionalZone = {
  id: 1,
  regionName: 'จันทบุรี',
  province: 'จันทบุรี',
  certNumber: 'GI-TH-20088',
  issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
  approvalStatus: 'approved',
  typeCode: 'GI',
  typeNameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
  validUntil: '2573',
  linkedFarmCount: 1,
};

const base = (over: Partial<RegionalCertRequest>): RegionalCertRequest => ({
  id: 1,
  farmId: 'farm-a',
  farmName: 'สวนรอจับคู่',
  province: 'ตราด',
  typeCode: 'GI',
  typeNameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
  certNumber: 'GI-0001',
  issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
  status: 'pending',
  adminNotes: '',
  resolvedBy: '',
  resolvedAt: null,
  createdAt: '2026-08-30T04:00:00.000Z',
  regionalCertificationId: null,
  linkedRegionName: '',
  ...over,
});

const PENDING = base({ id: 1, farmName: 'สวนรอจับคู่' });

const LINKED = base({
  id: 2,
  farmName: 'สวนจับคู่แล้ว',
  status: 'linked',
  regionalCertificationId: 1,
  linkedRegionName: 'จันทบุรี',
  resolvedBy: 'แอดมินเอ',
  resolvedAt: '2026-08-31T04:00:00.000Z',
});

const REJECTED = base({
  id: 3,
  farmName: 'สวนถูกปฏิเสธ',
  status: 'rejected',
  adminNotes: 'เลขที่ใบไม่ตรงกับทะเบียน GI ของกรมทรัพย์สินทางปัญญา',
  resolvedBy: 'แอดมินบี',
  resolvedAt: '2026-09-01T04:00:00.000Z',
});

const fetchRequests = vi.fn();

vi.mock('../services/regionalCertificationService', () => ({
  fetchRegionalZones: () => Promise.resolve([ZONE]),
  fetchRegionalCertRequests: (...a: unknown[]) => fetchRequests(...a),
  linkRegionalCertRequest: vi.fn(),
  rejectRegionalCertRequest: vi.fn(),
  createRegionalZone: vi.fn(),
  updateRegionalZone: vi.fn(),
}));

beforeEach(() => {
  fetchRequests.mockReset().mockImplementation((status?: string) => {
    if (status === 'linked') return Promise.resolve([LINKED]);
    if (status === 'rejected') return Promise.resolve([REJECTED]);
    return Promise.resolve([PENDING]);
  });
});

const cardOf = async (name: string): Promise<HTMLElement> =>
  (await screen.findByText(name)).closest('[data-testid="regional-request-card"]') as HTMLElement;

describe('สลับดูคำขอตามสถานะ', () => {
  test('ค่าตั้งต้นคือคำขอที่ยังค้าง เพราะนั่นคือกองงานที่ต้องเคลียร์', async () => {
    render(<RegionalCertLinkPanel />);

    expect(await screen.findByText(PENDING.farmName)).toBeInTheDocument();
    expect(fetchRequests).toHaveBeenCalledWith('pending');
  });

  test('กดดูที่จับคู่แล้ว ต้องดึงคำขอสถานะนั้นมา', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);
    await screen.findByText(PENDING.farmName);

    await user.click(screen.getByRole('button', { name: /จับคู่แล้ว/ }));

    expect(await screen.findByText(LINKED.farmName)).toBeInTheDocument();
    expect(fetchRequests).toHaveBeenLastCalledWith('linked');
  });

  test('กดดูที่ปฏิเสธแล้ว ต้องดึงคำขอสถานะนั้นมา', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);
    await screen.findByText(PENDING.farmName);

    await user.click(screen.getByRole('button', { name: /ปฏิเสธแล้ว/ }));

    expect(await screen.findByText(REJECTED.farmName)).toBeInTheDocument();
    expect(fetchRequests).toHaveBeenLastCalledWith('rejected');
  });
});

describe('สิ่งที่ต้องเห็นในคำขอที่จัดการไปแล้ว', () => {
  test('คำขอที่จับคู่แล้ว ต้องบอกว่าไปอยู่โซนไหน ใครจับคู่ และเมื่อไร', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);
    await screen.findByText(PENDING.farmName);
    await user.click(screen.getByRole('button', { name: /จับคู่แล้ว/ }));

    const card = await cardOf(LINKED.farmName);
    expect(within(card).getByText(/จันทบุรี/)).toBeInTheDocument();
    expect(within(card).getByText(/แอดมินเอ/)).toBeInTheDocument();
  });

  test('คำขอที่ถูกปฏิเสธ ต้องเห็นเหตุผลที่บันทึกไว้', async () => {
    // นี่คือสิ่งที่ต้องตอบได้ตอนเจ้าของสวนโทรมาถามว่าทำไมตรายังไม่ขึ้น
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);
    await screen.findByText(PENDING.farmName);
    await user.click(screen.getByRole('button', { name: /ปฏิเสธแล้ว/ }));

    const card = await cardOf(REJECTED.farmName);
    expect(within(card).getByText(/เลขที่ใบไม่ตรงกับทะเบียน/)).toBeInTheDocument();
    expect(within(card).getByText(/แอดมินบี/)).toBeInTheDocument();
  });

  test('คำขอที่จัดการไปแล้ว ต้องไม่มีปุ่มจับคู่หรือปฏิเสธให้กดซ้ำ', async () => {
    // เซิร์ฟเวอร์ตอบ 409 อยู่แล้ว แต่ปุ่มที่กดแล้วขึ้น error เสมอไม่ควรมีตั้งแต่แรก
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);
    await screen.findByText(PENDING.farmName);
    await user.click(screen.getByRole('button', { name: /จับคู่แล้ว/ }));

    const card = await cardOf(LINKED.farmName);
    expect(within(card).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /จับคู่โซน/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /^ปฏิเสธ$/ })).not.toBeInTheDocument();
  });

  test('คำขอที่ยังค้าง ยังต้องมีปุ่มจัดการอยู่เหมือนเดิม', async () => {
    render(<RegionalCertLinkPanel />);

    const card = await cardOf(PENDING.farmName);
    expect(within(card).getByRole('combobox')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /จับคู่โซน/ })).toBeInTheDocument();
  });
});

describe('ไม่มีรายการในสถานะที่เลือก', () => {
  test('ข้อความว่างต้องบอกให้ตรงกับสถานะที่กำลังดูอยู่', async () => {
    // ถ้าขึ้นว่า ไม่มีคำขอที่รอจับคู่ ทั้งที่กำลังดูรายการที่ปฏิเสธไปแล้ว
    // แอดมินจะเข้าใจผิดว่าไม่เคยปฏิเสธใครเลย
    fetchRequests.mockImplementation((status?: string) =>
      Promise.resolve(status === 'pending' ? [PENDING] : [])
    );

    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);
    await screen.findByText(PENDING.farmName);

    await user.click(screen.getByRole('button', { name: /ปฏิเสธแล้ว/ }));

    await waitFor(() =>
      expect(screen.getByText(/ยังไม่มีคำขอที่ถูกปฏิเสธ/)).toBeInTheDocument()
    );
  });
});
