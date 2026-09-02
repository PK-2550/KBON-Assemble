import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegionalCertLinkPanel } from './RegionalCertLinkPanel';
import type { RegionalCertRequest, RegionalZone } from '../services/regionalCertificationService';

/**
 * สร้างและแก้ไขโซนจากในหน้าจับคู่
 *
 * หน้าจับคู่เดิมจับได้เฉพาะโซนที่มีอยู่แล้ว ถ้าใบที่สวนยื่นมาไม่ตรงโซนไหนเลย
 * แอดมินทำได้แค่ปฏิเสธ ทั้งที่ใบอาจถูกต้องทุกอย่าง แค่ระบบยังไม่รู้จักโซนนั้น
 *
 * ทางเข้าอยู่ในการ์ดคำขอ ไม่ใช่หน้าแยก เพราะนั่นคือนาทีที่แอดมินเพิ่งรู้ตัว
 * และข้อมูลที่ต้องกรอกทั้งหมดอยู่ตรงหน้าอยู่แล้ว
 */

const ZONE_CHANTHABURI: RegionalZone = {
  id: 1,
  regionName: 'จันทบุรี',
  province: 'จันทบุรี',
  certNumber: 'GI-TH-20088',
  issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
  approvalStatus: 'approved',
  typeCode: 'GI',
  typeNameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
  linkedFarmCount: 1,
  validUntil: '2573',
};

const REQUEST: RegionalCertRequest = {
  id: 42,
  farmId: 'farm-abc',
  farmName: 'สวนทุเรียนทดสอบ',
  province: 'ตราด',
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

const NEW_ZONE: RegionalZone = {
  id: 77,
  regionName: 'ทุเรียนตราด',
  province: 'ตราด',
  certNumber: 'GI-2569-0042',
  issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
  approvalStatus: 'approved',
  typeCode: 'GI',
  typeNameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
  linkedFarmCount: 0,
  validUntil: '',
};

const fetchZones = vi.fn();
const fetchRequests = vi.fn();
const linkRequest = vi.fn();
const rejectRequest = vi.fn();
const createZone = vi.fn();
const updateZone = vi.fn();

vi.mock('../services/regionalCertificationService', () => ({
  fetchRegionalZones: () => fetchZones(),
  fetchPendingRegionalCertRequests: () => fetchRequests(),
  linkRegionalCertRequest: (...a: unknown[]) => linkRequest(...a),
  rejectRegionalCertRequest: (...a: unknown[]) => rejectRequest(...a),
  createRegionalZone: (...a: unknown[]) => createZone(...a),
  updateRegionalZone: (...a: unknown[]) => updateZone(...a),
}));

beforeEach(() => {
  fetchZones.mockReset().mockResolvedValue([ZONE_CHANTHABURI]);
  fetchRequests.mockReset().mockResolvedValue([REQUEST]);
  linkRequest.mockReset().mockResolvedValue({ ...REQUEST, status: 'linked' });
  rejectRequest.mockReset().mockResolvedValue({ ...REQUEST, status: 'rejected' });
  createZone.mockReset().mockResolvedValue({ ok: true, zone: NEW_ZONE });
  updateZone.mockReset().mockResolvedValue({ ok: true, zone: ZONE_CHANTHABURI });
});

async function cardOfRequest(): Promise<HTMLElement> {
  const name = await screen.findByText(REQUEST.farmName);
  return name.closest('[data-testid="regional-request-card"]') as HTMLElement;
}

describe('สร้างโซนใหม่จากการ์ดคำขอ', () => {
  test('การ์ดคำขอต้องมีทางสร้างโซนใหม่', async () => {
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    expect(within(card).getByRole('button', { name: /สร้างโซนใหม่/ })).toBeInTheDocument();
  });

  test('ฟอร์มเปิดมาพร้อมข้อมูลจากคำขอนั้น ไม่ต้องพิมพ์ใหม่', async () => {
    // ถ้าต้องจำแล้วไปพิมพ์ใหม่ นั่นคือทางที่ทำให้พิมพ์ผิดจนเกิดโซนซ้ำ
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    await user.click(within(card).getByRole('button', { name: /สร้างโซนใหม่/ }));

    expect(await screen.findByLabelText(/จังหวัด/)).toHaveValue(REQUEST.province);
    expect(screen.getByLabelText(/เลขที่ใบรับรอง/)).toHaveValue(REQUEST.certNumber);
    expect(screen.getByLabelText(/หน่วยงานผู้ออก/)).toHaveValue(REQUEST.issuingAuthority);
  });

  test('สร้างเสร็จแล้วโซนใหม่ต้องเลือกได้ทันที โดยไม่ต้องโหลดหน้าใหม่', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    await user.click(within(card).getByRole('button', { name: /สร้างโซนใหม่/ }));
    await user.type(await screen.findByLabelText(/ชื่อโซน/), 'ทุเรียนตราด');
    await user.click(screen.getByRole('button', { name: /บันทึก/ }));

    const select = await within(await cardOfRequest()).findByRole('combobox');
    await waitFor(() => {
      const values = [...select.querySelectorAll('option')].map((o) => o.getAttribute('value'));
      expect(values).toContain(String(NEW_ZONE.id));
    });
  });

  test('สร้างเสร็จแล้วเลือกโซนใหม่ไว้ให้เลย กดจับคู่ต่อได้ทันที', async () => {
    // แอดมินเพิ่งสร้างโซนนี้เพื่อคำขอนี้โดยเฉพาะ ไม่มีเหตุผลให้ต้องไปเลือกซ้ำ
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    const card = await cardOfRequest();
    await user.click(within(card).getByRole('button', { name: /สร้างโซนใหม่/ }));
    await user.type(await screen.findByLabelText(/ชื่อโซน/), 'ทุเรียนตราด');
    await user.click(screen.getByRole('button', { name: /บันทึก/ }));

    const after = await cardOfRequest();
    await waitFor(() =>
      expect(within(after).getByRole('combobox')).toHaveValue(String(NEW_ZONE.id))
    );
    expect(within(after).getByRole('button', { name: /จับคู่/ })).toBeEnabled();
  });
});

describe('จัดการโซนที่มีอยู่', () => {
  test('มีทางเข้าไปดูรายชื่อโซนทั้งหมด', async () => {
    render(<RegionalCertLinkPanel />);

    expect(await screen.findByRole('button', { name: /จัดการโซน/ })).toBeInTheDocument();
  });

  test('เปิดแล้วเห็นโซนพร้อมจำนวนสวนที่ผูกอยู่', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    await user.click(await screen.findByRole('button', { name: /จัดการโซน/ }));

    const row = (await screen.findByText(ZONE_CHANTHABURI.regionName)).closest(
      '[data-testid="zone-row"]'
    ) as HTMLElement;
    expect(within(row).getByText(/1/)).toBeInTheDocument();
  });

  test('แก้ชื่อโซนได้จากตรงนั้น', async () => {
    const user = userEvent.setup();
    render(<RegionalCertLinkPanel />);

    await user.click(await screen.findByRole('button', { name: /จัดการโซน/ }));
    const row = (await screen.findByText(ZONE_CHANTHABURI.regionName)).closest(
      '[data-testid="zone-row"]'
    ) as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /แก้ไข/ }));

    const nameBox = await screen.findByLabelText(/ชื่อโซน/);
    await user.clear(nameBox);
    await user.type(nameBox, 'ทุเรียนจันทบุรี');
    await user.click(screen.getByRole('button', { name: /บันทึก/ }));

    await waitFor(() =>
      expect(updateZone).toHaveBeenCalledWith(
        ZONE_CHANTHABURI.id,
        expect.objectContaining({ regionName: 'ทุเรียนจันทบุรี' })
      )
    );
  });
});
