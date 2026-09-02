import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DataRetentionLogPanel } from './DataRetentionLogPanel';
import type { DataRetentionReport } from '../services/dataRetentionService';

/**
 * หน้ารายงานการล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธ
 *
 * 013 บันทึกไว้แล้วว่าล้างของแถวไหน เมื่อไหร่ ล้างฟิลด์อะไรบ้าง แต่อ่านได้
 * ทาง SQL ทางเดียว เวลามีคนถามว่าข้อมูลหายไปไหนจึงยังตอบไม่ได้อยู่ดี
 *
 * สิ่งที่หน้านี้ต้องตอบให้ได้มีสองเรื่อง คือเคยล้างอะไรไปบ้าง
 * และงานล้างยังทำงานอยู่หรือเปล่า เรื่องหลังสำคัญกว่า เพราะถ้างานหยุดไป
 * ข้อมูลส่วนตัวจะค้างอยู่เกินกำหนดโดยไม่มีใครรู้
 */

const report = (over: Partial<DataRetentionReport> = {}): DataRetentionReport => ({
  entries: [
    {
      id: 1,
      farmRequestId: 'req_123',
      fieldsCleared: ['farmer_full_name', 'payload'],
      rejectedAt: '2026-05-01T00:00:00.000Z',
      purgedAt: '2026-08-01T00:00:00.000Z',
      triggerSource: 'auto',
    },
  ],
  summary: {
    retentionDays: 90,
    totalPurged: 1,
    lastPurgedAt: '2026-08-01T00:00:00.000Z',
    pendingCount: 3,
    overdueCount: 0,
    nextDueAt: '2026-10-01T00:00:00.000Z',
  },
  ...over,
});

const fetchReport = vi.fn();

vi.mock('../services/dataRetentionService', () => ({
  fetchDataRetentionReport: () => fetchReport(),
}));

beforeEach(() => {
  fetchReport.mockReset().mockResolvedValue(report());
});

describe('สรุปสถานะของงานล้าง', () => {
  test('บอกกำหนดเวลาเก็บที่ระบบใช้จริง ไม่ใช่เลขที่เขียนไว้ในหน้าจอ', async () => {
    fetchReport.mockResolvedValue(report({ summary: { ...report().summary, retentionDays: 120 } }));
    render(<DataRetentionLogPanel />);

    expect(await screen.findByText(/120 วัน/)).toBeInTheDocument();
  });

  test('ทุกอย่างปกติ ต้องบอกว่าปกติ ไม่ใช่เงียบ', async () => {
    // ตารางว่างหรือไม่มีอะไรค้าง ตีความได้ทั้งปกติและพัง ต้องบอกให้ชัด
    render(<DataRetentionLogPanel />);

    expect(await screen.findByText(/ทำงานตามกำหนด/)).toBeInTheDocument();
  });

  test('มีรายการเลยกำหนดแล้วยังไม่ถูกล้าง ต้องเตือนให้เห็นชัด', async () => {
    // นี่คือสัญญาณว่าตัวตั้งเวลาไม่ได้ทำงาน ข้อมูลส่วนตัวกำลังค้างเกินกำหนด
    fetchReport.mockResolvedValue(
      report({ summary: { ...report().summary, overdueCount: 4, pendingCount: 7 } })
    );
    render(<DataRetentionLogPanel />);

    expect(await screen.findByTestId('retention-overdue-alert')).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });

  test('บอกจำนวนที่ยังถือข้อมูลอยู่และวันครบกำหนดถัดไป', async () => {
    render(<DataRetentionLogPanel />);

    await screen.findByText(/ทำงานตามกำหนด/);
    expect(screen.getByTestId('retention-pending-count')).toHaveTextContent('3');
    expect(screen.getByTestId('retention-next-due')).not.toHaveTextContent('-');
  });

  test('ไม่มีอะไรรอล้างเลย ช่องวันครบกำหนดต้องไม่โชว์วันที่มั่ว', async () => {
    fetchReport.mockResolvedValue(
      report({ summary: { ...report().summary, pendingCount: 0, nextDueAt: null } })
    );
    render(<DataRetentionLogPanel />);

    await waitFor(() =>
      expect(screen.getByTestId('retention-next-due')).toHaveTextContent('-')
    );
  });
});

describe('ประวัติการล้าง', () => {
  test('แสดงรหัสคำขอ วันที่ล้าง และฟิลด์ที่ถูกล้าง', async () => {
    render(<DataRetentionLogPanel />);

    expect(await screen.findByText('req_123')).toBeInTheDocument();
    expect(screen.getByText(/farmer_full_name/)).toBeInTheDocument();
  });

  test('บอกว่าล้างโดยตัวตั้งเวลาหรือคนสั่งเอง', async () => {
    render(<DataRetentionLogPanel />);
    expect(await screen.findByText(/ตัวตั้งเวลา/)).toBeInTheDocument();
  });

  test('ยังไม่เคยล้างอะไรเลย ต้องบอกว่ายังไม่มี ไม่ใช่หน้าว่าง', async () => {
    fetchReport.mockResolvedValue(
      report({ entries: [], summary: { ...report().summary, totalPurged: 0, lastPurgedAt: null } })
    );
    render(<DataRetentionLogPanel />);

    expect(await screen.findByText(/ยังไม่เคยมีการล้างข้อมูล/)).toBeInTheDocument();
  });
});

describe('เมื่อดึงข้อมูลไม่สำเร็จ', () => {
  test('ต้องบอกว่าโหลดไม่สำเร็จ ไม่ใช่แสดงเลขศูนย์เหมือนทุกอย่างปกติ', async () => {
    // ถ้าโหลดพังแล้วโชว์ค้าง 0 รายการ แอดมินจะเข้าใจว่าไม่มีอะไรต้องทำ
    fetchReport.mockRejectedValue(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
    render(<DataRetentionLogPanel />);

    expect(await screen.findByText(/เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/)).toBeInTheDocument();
    expect(screen.queryByText(/ทำงานตามกำหนด/)).not.toBeInTheDocument();
  });
});
