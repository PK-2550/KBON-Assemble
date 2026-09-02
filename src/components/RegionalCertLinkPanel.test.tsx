import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegionalCertLinkPanel } from './RegionalCertLinkPanel';
import type { RegionalCertRequest, RegionalZone } from '../services/regionalCertificationService';

/**
 * หน้าจับคู่คำขอใบรับรองระดับโซนในศูนย์อนุมัติ
 *
 * ใบอย่าง GI เป็นของโซนภูมิศาสตร์ สวนหลายแห่งใช้ใบเดียวกัน ระบบจึงไม่มีทางรู้เอง
 * ว่าสวนที่เพิ่งอนุมัติไปควรอยู่โซนไหน คำขอถูกเก็บไว้รอ แต่ก่อนหน้านี้ไม่มีหน้าจอ
 * ไหนเปิดดูได้เลย ต้องเปิด psql มาสั่ง SQL เอง ซึ่งจากมุมเจ้าของสวนก็คือใบหายไป
 * เฉย ๆ ตราไม่เคยขึ้น
 */

const ZONES: RegionalZone[] = [
  {
    id: 1,
    regionName: 'จันทบุรี',
    province: 'จันทบุรี',
    certNumber: 'GI-CTI-01',
    issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
    approvalStatus: 'approved',
    typeCode: 'GI',
    typeNameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
    validUntil: '2573',
    linkedFarmCount: 3,
  },
  {
    id: 5,
    regionName: 'ศรีสะเกษ',
    province: 'ศรีสะเกษ',
    certNumber: 'GI-SSK-01',
    issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
    approvalStatus: 'approved',
    typeCode: 'GI',
    typeNameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
    validUntil: '2573',
    linkedFarmCount: 1,
  },
  {
    id: 9,
    regionName: 'โซนของมาตรฐานอื่น',
    province: 'ระยอง',
    certNumber: '',
    issuingAuthority: '',
    approvalStatus: 'approved',
    typeCode: 'OTHER_REGION',
    typeNameTh: 'มาตรฐานระดับโซนอื่น',
    validUntil: '2573',
    linkedFarmCount: 0,
  },
];

const REQUEST: RegionalCertRequest = {
  id: 42,
  farmId: 'farm-abc',
  farmName: 'สวนทุเรียนทดสอบ',
  province: 'จันทบุรี',
  typeCode: 'GI',
  typeNameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
  certNumber: 'GI-2569-0042',
  issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
  status: 'pending',
  adminNotes: '',
  resolvedBy: '',
  resolvedAt: null,
  createdAt: '2026-08-30T04:00:00.000Z',
  regionalCertificationId: null,
  linkedRegionName: '',
};

const fetchZones = vi.fn();
const fetchRequests = vi.fn();
const linkRequest = vi.fn();
const rejectRequest = vi.fn();

vi.mock('../services/regionalCertificationService', () => ({
  fetchRegionalZones: () => fetchZones(),
  fetchPendingRegionalCertRequests: () => fetchRequests(),
  linkRegionalCertRequest: (...args: unknown[]) => linkRequest(...args),
  rejectRegionalCertRequest: (...args: unknown[]) => rejectRequest(...args),
}));

beforeEach(() => {
  fetchZones.mockReset().mockResolvedValue(ZONES);
  fetchRequests.mockReset().mockResolvedValue([REQUEST]);
  linkRequest.mockReset().mockResolvedValue({ ...REQUEST, status: 'linked' });
  rejectRequest.mockReset().mockResolvedValue({ ...REQUEST, status: 'rejected' });
});

/** รอให้โหลดข้อมูลเสร็จแล้วคืนการ์ดของคำขอที่กำลังทดสอบ */
async function cardOfRequest(): Promise<HTMLElement> {
  const name = await screen.findByText(REQUEST.farmName);
  return name.closest('[data-testid="regional-request-card"]') as HTMLElement;
}

describe('รายการคำขอที่รอจับคู่โซน', () => {
  test('แสดงข้อมูลที่แอดมินต้องใช้ตัดสินว่าคู่กับโซนไหน', async () => {
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();

    // ระบุแบบเจาะจง เพราะชื่อจังหวัดไปโผล่ในตัวเลือกโซนด้วย
    expect(within(card).getByText('จังหวัดจันทบุรี')).toBeInTheDocument();
    expect(within(card).getByText('GI-2569-0042')).toBeInTheDocument();
    expect(within(card).getByText(/กรมทรัพย์สินทางปัญญา/)).toBeInTheDocument();
  });

  test('ไม่มีคำขอค้าง ต้องบอกว่าไม่มี ไม่ใช่หน้าว่างเปล่า', async () => {
    fetchRequests.mockResolvedValue([]);
    render(<RegionalCertLinkPanel />);

    expect(await screen.findByText(/ไม่มีคำขอ/)).toBeInTheDocument();
  });
});

describe('ตัวเลือกโซน', () => {
  test('เลือกได้เฉพาะโซนที่เป็นใบประเภทเดียวกับคำขอ', async () => {
    // เซิร์ฟเวอร์กันการจับคู่ข้ามประเภทไว้แล้ว แต่ถ้าหน้าจอยังให้เลือกได้
    // แอดมินจะกดแล้วเจอ error โดยไม่รู้ว่าทำอะไรผิด
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    const select = within(card).getByRole('combobox');
    const values = [...select.querySelectorAll('option')]
      .map((o) => o.getAttribute('value'))
      .filter((v) => v);

    expect(values).toEqual(['1', '5']);
  });

  test('บอกจำนวนสวนที่ผูกอยู่แล้วในแต่ละโซน', async () => {
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    const select = within(card).getByRole('combobox');
    const labels = [...select.querySelectorAll('option')].map((o) => o.textContent ?? '');

    expect(labels.some((t) => t.includes('จันทบุรี') && t.includes('3'))).toBe(true);
  });
});

describe('จับคู่โซน', () => {
  test('ยังไม่เลือกโซน กดจับคู่ไม่ได้', async () => {
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    expect(within(card).getByRole('button', { name: /จับคู่/ })).toBeDisabled();
  });

  test('เลือกโซนแล้วกดจับคู่ ต้องส่งคำขอกับโซนที่เลือกไป', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    await user.selectOptions(within(card).getByRole('combobox'), '5');
    await user.click(within(card).getByRole('button', { name: /จับคู่/ }));

    await waitFor(() => expect(linkRequest).toHaveBeenCalledWith(42, 5));
  });

  test('จับคู่สำเร็จแล้วคำขอต้องหายจากรายการที่รอ', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    await user.selectOptions(within(card).getByRole('combobox'), '1');
    await user.click(within(card).getByRole('button', { name: /จับคู่/ }));

    await waitFor(() =>
      expect(screen.queryByText(REQUEST.farmName)).not.toBeInTheDocument()
    );
  });

  test('จับคู่ไม่สำเร็จ ต้องบอกเหตุผลและไม่ทิ้งคำขอออกจากรายการ', async () => {
    // ถ้าลบออกจากหน้าจอทั้งที่เซิร์ฟเวอร์ปฏิเสธ แอดมินจะเข้าใจว่าจัดการเสร็จแล้ว
    linkRequest.mockRejectedValue(new Error('คำขอนี้ถูกจัดการไปแล้ว'));
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    await user.selectOptions(within(card).getByRole('combobox'), '1');
    await user.click(within(card).getByRole('button', { name: /จับคู่/ }));

    expect(await screen.findByText(/คำขอนี้ถูกจัดการไปแล้ว/)).toBeInTheDocument();
    expect(screen.getByText(REQUEST.farmName)).toBeInTheDocument();
  });
});

describe('ปฏิเสธคำขอ', () => {
  test('ต้องกรอกเหตุผลก่อนจึงจะปฏิเสธได้', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    await user.click(within(card).getByRole('button', { name: /ปฏิเสธ/ }));

    const confirm = within(card).getByRole('button', { name: /ยืนยันการปฏิเสธ/ });
    expect(confirm).toBeDisabled();
    expect(rejectRequest).not.toHaveBeenCalled();
  });

  test('กรอกเหตุผลแล้วปฏิเสธได้ และส่งเหตุผลไปด้วย', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    await user.click(within(card).getByRole('button', { name: /ปฏิเสธ/ }));
    await user.type(within(card).getByRole('textbox'), 'เลขที่ใบไม่ตรงกับทะเบียน');
    await user.click(within(card).getByRole('button', { name: /ยืนยันการปฏิเสธ/ }));

    await waitFor(() =>
      expect(rejectRequest).toHaveBeenCalledWith(42, 'เลขที่ใบไม่ตรงกับทะเบียน')
    );
  });
});
