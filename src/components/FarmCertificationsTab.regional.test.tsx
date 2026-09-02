import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FarmCertificationsTab } from './FarmCertificationsTab';
import type { DurianFarm } from '../types';
import type { RegionalCertRequest } from '../services/regionalCertificationService';

/**
 * เจ้าของสวนเห็นสถานะใบระดับโซนของตัวเอง
 *
 * ใบอย่าง GI ไม่ได้ขึ้นตราทันทีที่อนุมัติคำขอสมัคร แต่ไปรอให้แอดมินจับคู่โซนก่อน
 * ถ้าถูกปฏิเสธ เหตุผลถูกบันทึกไว้ตั้งแต่ต้น แต่ไม่เคยมีทางไหนให้เจ้าของสวนได้อ่าน
 *
 * จากมุมเจ้าของสวนคือกรอกครบ รอไปเรื่อย ๆ แล้วตราไม่เคยขึ้น โดยไม่รู้ว่า
 * ติดอยู่ที่ขั้นไหนหรือถูกปฏิเสธไปแล้ว
 *
 * ส่วนนี้ต้องไม่โผล่ให้คนทั่วไปเห็น หน้าโปรไฟล์สวนใครเปิดดูก็ได้
 */

const FARM = {
  id: 'farm-abc',
  name: 'สวนทดสอบ',
  certificationDetails: [
    {
      name: 'GAP',
      shortCode: 'GAP',
      certNumber: 'กษ 01-1',
      issuedBy: 'กรมวิชาการเกษตร',
      validUntil: '2571',
      verified: true,
    },
  ],
} as unknown as DurianFarm;

const req = (over: Partial<RegionalCertRequest>): RegionalCertRequest => ({
  id: 1,
  farmId: 'farm-abc',
  farmName: 'สวนทดสอบ',
  province: 'จันทบุรี',
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

const fetchForFarm = vi.fn();

vi.mock('../services/regionalCertificationService', () => ({
  fetchRegionalCertRequestsForFarm: (...a: unknown[]) => fetchForFarm(...a),
}));

beforeEach(() => {
  fetchForFarm.mockReset().mockResolvedValue([req({})]);
});

function renderTab(isOwnerOrAdmin: boolean) {
  render(
    <FarmCertificationsTab
      farm={FARM}
      onViewDocument={vi.fn()}
      isOwnerOrAdmin={isOwnerOrAdmin}
    />
  );
}

describe('ใครเห็นส่วนนี้ได้บ้าง', () => {
  test('เจ้าของสวนเห็น', async () => {
    renderTab(true);
    expect(await screen.findByText(/ใบรับรองระดับโซน/)).toBeInTheDocument();
  });

  test('คนทั่วไปไม่เห็น และต้องไม่ยิงขอข้อมูลด้วย', async () => {
    // ยิงแล้วได้ 403 ก็จริง แต่การไม่ยิงเลยชัดกว่า และไม่ทำให้ console
    // เต็มไปด้วย error ทุกครั้งที่มีคนเปิดดูหน้าสวน
    renderTab(false);

    await waitFor(() => expect(fetchForFarm).not.toHaveBeenCalled());
    expect(screen.queryByText(/ใบรับรองระดับโซน/)).not.toBeInTheDocument();
  });

  test('สวนที่ไม่เคยยื่นใบระดับโซน ไม่ต้องขึ้นส่วนนี้มาให้รก', async () => {
    fetchForFarm.mockResolvedValue([]);
    renderTab(true);

    await waitFor(() => expect(fetchForFarm).toHaveBeenCalled());
    expect(screen.queryByText(/ใบรับรองระดับโซน/)).not.toBeInTheDocument();
  });

  test('ดึงข้อมูลไม่สำเร็จ ต้องไม่ทำให้แท็บใบรับรองทั้งแท็บพัง', async () => {
    fetchForFarm.mockRejectedValue(new Error('เครือข่ายมีปัญหา'));
    renderTab(true);

    await waitFor(() => expect(fetchForFarm).toHaveBeenCalled());
    expect(screen.getByText(/ใบรับรองมาตรฐานทางการเกษตร/)).toBeInTheDocument();
  });
});

describe('สถานะที่เจ้าของสวนต้องอ่านออก', () => {
  test('รอจับคู่ ต้องบอกว่ากำลังรออะไรอยู่ ไม่ใช่เงียบ', async () => {
    renderTab(true);
    expect(await screen.findByText(/รอผู้ดูแลจับคู่/)).toBeInTheDocument();
  });

  test('ถูกปฏิเสธ ต้องเห็นเหตุผล', async () => {
    // เหตุผลถูกบันทึกไว้ตั้งแต่ต้นแต่ไม่เคยมีใครได้อ่าน นี่คือทั้งหมดของงานนี้
    fetchForFarm.mockResolvedValue([
      req({ status: 'rejected', adminNotes: 'เลขที่ใบไม่ตรงกับทะเบียน GI' }),
    ]);
    renderTab(true);

    expect(await screen.findByText(/เลขที่ใบไม่ตรงกับทะเบียน GI/)).toBeInTheDocument();
  });

  test('ถูกปฏิเสธโดยไม่ได้บันทึกเหตุผล ก็ยังต้องบอกว่าถูกปฏิเสธ', async () => {
    fetchForFarm.mockResolvedValue([req({ status: 'rejected', adminNotes: '' })]);
    renderTab(true);

    expect(await screen.findByText(/ไม่ผ่านการตรวจ/)).toBeInTheDocument();
  });

  test('จับคู่แล้ว ต้องบอกว่าอยู่โซนไหน', async () => {
    fetchForFarm.mockResolvedValue([
      req({ status: 'linked', linkedRegionName: 'ทุเรียนภูเขาไฟศรีสะเกษ' }),
    ]);
    renderTab(true);

    expect(await screen.findByText(/ทุเรียนภูเขาไฟศรีสะเกษ/)).toBeInTheDocument();
  });

  test('เห็นเลขที่ใบของคำขอนั้นด้วย จะได้รู้ว่าพูดถึงใบไหน', async () => {
    fetchForFarm.mockResolvedValue([
      req({ certNumber: 'GI-2569-0042' }),
      req({ id: 2, certNumber: 'GI-2570-0100', status: 'rejected', adminNotes: 'ซ้ำกับใบก่อน' }),
    ]);
    renderTab(true);

    expect(await screen.findByText('GI-2569-0042')).toBeInTheDocument();
    expect(screen.getByText('GI-2570-0100')).toBeInTheDocument();
  });
});
