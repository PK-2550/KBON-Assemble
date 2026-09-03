import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FarmCertificationsTab } from './FarmCertificationsTab';
import type { DurianFarm } from '../types';
import type { ExportDocument } from '../services/exportDocumentService';

/**
 * เอกสารการส่งออกของสวน เห็นเฉพาะเจ้าของสวนกับผู้ดูแล
 *
 * ใบระดับการขนส่งรายเที่ยวอย่าง PHYTO ถูกกันออกจากตราสาธารณะโดยตั้งใจ
 * เพราะไม่ใช่คุณสมบัติถาวรของสวน แต่ถ้าเก็บแล้วไม่มีใครเห็นที่ไหนเลย
 * ก็เท่ากับใบหายเงียบ ๆ ซึ่งเป็นอาการเดียวกับใบ GI ตอนก่อนแก้
 *
 * และต้องไม่โผล่ให้คนทั่วไปเห็น เลขที่เที่ยวขนส่งกับเลขที่ใบเป็นข้อมูล
 * ทางการค้าของสวนนั้น ต่างจากตรา GAP ที่ตั้งใจให้ทุกคนเห็น
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

const doc = (over: Partial<ExportDocument> = {}): ExportDocument => ({
  id: 1,
  shortCode: 'PHYTO',
  nameTh: 'ใบรับรองสุขอนามัยพืช',
  certNumber: 'PC-2569-00812',
  issuedBy: 'กรมวิชาการเกษตร',
  shipmentRef: 'CN-SHT-2569-0451',
  validUntil: '2569-12-31',
  approvalStatus: 'approved',
  adminNotes: '',
  fileName: '',
  fileType: '',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const fetchExports = vi.fn();

vi.mock('../services/regionalCertificationService', () => ({
  fetchRegionalCertRequestsForFarm: () => Promise.resolve([]),
}));

vi.mock('../services/exportDocumentService', () => ({
  fetchExportDocuments: (...a: unknown[]) => fetchExports(...a),
}));

beforeEach(() => {
  fetchExports.mockReset().mockResolvedValue([doc()]);
});

function renderTab(isOwnerOrAdmin: boolean) {
  render(
    <FarmCertificationsTab farm={FARM} onViewDocument={vi.fn()} isOwnerOrAdmin={isOwnerOrAdmin} />
  );
}

describe('ใครเห็นเอกสารการส่งออกได้บ้าง', () => {
  test('เจ้าของสวนเห็น', async () => {
    renderTab(true);
    expect(await screen.findByText(/เอกสารการส่งออก/)).toBeInTheDocument();
  });

  test('คนทั่วไปไม่เห็น และต้องไม่ยิงขอข้อมูลด้วย', async () => {
    renderTab(false);

    await waitFor(() => expect(fetchExports).not.toHaveBeenCalled());
    expect(screen.queryByText(/เอกสารการส่งออก/)).not.toBeInTheDocument();
  });

  test('เลขที่เที่ยวขนส่งต้องไม่โผล่ให้คนทั่วไปเห็น', async () => {
    // ข้อมูลทางการค้าของสวน ไม่ใช่ตราที่ตั้งใจให้ทุกคนเห็น
    renderTab(false);

    await waitFor(() => expect(fetchExports).not.toHaveBeenCalled());
    expect(screen.queryByText(/CN-SHT-2569-0451/)).not.toBeInTheDocument();
  });

  test('สวนที่ไม่เคยยื่นใบระดับการขนส่ง ไม่ต้องขึ้นส่วนนี้มาให้รก', async () => {
    fetchExports.mockResolvedValue([]);
    renderTab(true);

    await waitFor(() => expect(fetchExports).toHaveBeenCalled());
    expect(screen.queryByText(/เอกสารการส่งออก/)).not.toBeInTheDocument();
  });

  test('ดึงข้อมูลไม่สำเร็จ ต้องไม่ทำให้แท็บใบรับรองทั้งแท็บพัง', async () => {
    fetchExports.mockRejectedValue(new Error('เครือข่ายมีปัญหา'));
    renderTab(true);

    await waitFor(() => expect(fetchExports).toHaveBeenCalled());
    expect(screen.getByText(/ใบรับรองมาตรฐานทางการเกษตร/)).toBeInTheDocument();
  });
});

describe('สิ่งที่เจ้าของสวนต้องเห็น', () => {
  test('เลขที่ใบและเลขที่เที่ยวขนส่ง', async () => {
    // เลขที่เที่ยวขนส่งคือสิ่งเดียวที่ทำให้ใบรายเที่ยวอ้างอิงได้
    renderTab(true);

    expect(await screen.findByText('PC-2569-00812')).toBeInTheDocument();
    expect(screen.getByText(/CN-SHT-2569-0451/)).toBeInTheDocument();
  });

  test('บอกว่าใบนี้ไม่ขึ้นเป็นตราบนหน้าสวน', async () => {
    // ไม่งั้นเจ้าของสวนจะสงสัยว่าทำไมกรอกไปแล้วตราไม่ขึ้น
    renderTab(true);

    expect(await screen.findByText(/ไม่ขึ้นเป็นตรา/)).toBeInTheDocument();
  });

  test('ใบที่ยังรอตรวจ ต้องบอกว่ายังรออยู่', async () => {
    fetchExports.mockResolvedValue([doc({ approvalStatus: 'pending' })]);
    renderTab(true);

    expect(await screen.findByText(/รอตรวจ/)).toBeInTheDocument();
  });

  test('ใบที่ไม่ผ่าน ต้องเห็นเหตุผล', async () => {
    fetchExports.mockResolvedValue([
      doc({ approvalStatus: 'rejected', adminNotes: 'เอกสารไม่ตรงกับเที่ยวขนส่ง' }),
    ]);
    renderTab(true);

    expect(await screen.findByText(/เอกสารไม่ตรงกับเที่ยวขนส่ง/)).toBeInTheDocument();
  });

  test('ไม่ได้กรอกเลขที่เที่ยวขนส่งมา ต้องไม่โชว์ช่องว่างลอย ๆ', async () => {
    fetchExports.mockResolvedValue([doc({ shipmentRef: '' })]);
    renderTab(true);

    expect(await screen.findByText('PC-2569-00812')).toBeInTheDocument();
    expect(screen.queryByTestId('export-shipment-ref')).not.toBeInTheDocument();
  });
});
