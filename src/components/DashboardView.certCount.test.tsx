import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardView } from './DashboardView';
import type { DurianFarm, CertificationDetail } from '../types';

/**
 * ตัวนับฟาร์มมาตรฐานบนแดชบอร์ด
 *
 * เดิมนับจาก farm.certifications ซึ่งเป็น array ข้อความชุดเก่าที่ไม่มีสถานะ
 * การตรวจติดมาด้วย ตัวเลขจึงนับรวมฟาร์มที่ใบรับรองยังไม่ผ่านการตรวจของแอดมิน
 * เป็นข้อบกพร่องเดียวกับตราในหน้ารายชื่อและ FarmDetailModal ที่แก้ไปแล้ว
 *
 * ตัวเลขนี้อยู่บนแดชบอร์ดผู้บริหาร ถ้านับเกินจริงก็คือรายงานผิด
 */

const cert = (over: Partial<CertificationDetail>): CertificationDetail => ({
  name: 'GAP (Good Agricultural Practice)',
  nameTh: 'GAP (Good Agricultural Practice)',
  shortCode: 'GAP',
  certNumber: 'GAP-001',
  issuedBy: 'กรมวิชาการเกษตร',
  validUntil: '2029',
  approvalStatus: 'approved',
  verified: true,
  ...over,
});

function makeFarm(id: string, over: Partial<DurianFarm> = {}): DurianFarm {
  return {
    id,
    rank: 1,
    name: `สวน ${id}`,
    province: 'จันทบุรี',
    varietiesCount: 1,
    topVarieties: ['หมอนทอง'],
    totalTrees: 10,
    harvestedFruits: 100,
    rating: 9,
    reviewCount: 1,
    certifications: [],
    certificationDetails: [],
    contact: {},
    photos: [],
    treeVarieties: [],
    individualTrees: [],
    smartTechnologies: [],
    ...over,
  } as DurianFarm;
}

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'u1', displayName: 'ผู้ใช้', role: 'user' } }),
}));

vi.mock('../services/farmRequestService', () => ({
  subscribeAllFarmRequests: () => () => {},
  getInitialFarmRequests: () => [],
}));

const renderDashboard = (farms: DurianFarm[]) =>
  render(<DashboardView farms={farms} onSelectFarm={vi.fn()} />);

describe('ตัวนับฟาร์มมาตรฐานบนแดชบอร์ด', () => {
  test('นับเฉพาะฟาร์มที่มีใบรับรองผ่านการตรวจแล้ว', () => {
    renderDashboard([
      makeFarm('a', { certificationDetails: [cert({})] }),
      makeFarm('b', { certificationDetails: [cert({ approvalStatus: 'pending', verified: false })] }),
      makeFarm('c', { certificationDetails: [] }),
    ]);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/33% ได้รับการรับรอง/)).toBeInTheDocument();
  });

  test('ไม่นับจาก array ข้อความชุดเก่าอีกแล้ว', () => {
    // array ชุดเก่าไม่มีสถานะการตรวจ ถ้ายังนับอยู่ ตัวเลขจะเป็น 2 ทั้งที่
    // ไม่มีฟาร์มไหนมีใบที่ผ่านการตรวจเลย
    renderDashboard([
      makeFarm('a', { certifications: ['GAP', 'GI'], certificationDetails: [] }),
      makeFarm('b', { certifications: ['GAP'], certificationDetails: [] }),
    ]);

    // ยืนยันด้วยบรรทัดเปอร์เซ็นต์ซึ่งมีที่เดียว
    // เลข 0 โผล่หลายที่บนแดชบอร์ด (ผลผลิตเฉลี่ย ฯลฯ) จึงชี้เฉพาะไม่ได้
    expect(screen.getByText(/0% ได้รับการรับรอง/)).toBeInTheDocument();
  });

  test('ใบชุดเก่าที่ยังไม่มี approvalStatus ใช้ verified ตัดสินแทน', () => {
    renderDashboard([makeFarm('a', { certificationDetails: [cert({ approvalStatus: undefined })] })]);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  test('ฟาร์มที่มีทั้งใบผ่านและใบรอตรวจ นับเป็นหนึ่งฟาร์ม ไม่ใช่นับตามใบ', () => {
    renderDashboard([
      makeFarm('a', {
        certificationDetails: [
          cert({}),
          cert({ shortCode: 'GMP', approvalStatus: 'pending', verified: false }),
        ],
      }),
    ]);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/100% ได้รับการรับรอง/)).toBeInTheDocument();
  });
});

describe('ตรา Smart Farm บนลีดเดอร์บอร์ดแดชบอร์ด', () => {
  const smartTech = { id: 'st-d1', name: 'ระบบน้ำหยดอัตโนมัติ', subtext: '', iconEmoji: '💧', active: true };

  test('ฟาร์มที่มี Smart Farm ต้องมีตราในลีดเดอร์บอร์ด', () => {
    renderDashboard([makeFarm('a', { smartTechnologies: [smartTech] })]);

    expect(screen.getByLabelText('Smart Farm')).toBeInTheDocument();
  });

  test('ฟาร์มที่ไม่มี Smart Farm ต้องไม่มีตรา', () => {
    renderDashboard([makeFarm('a', { smartTechnologies: [] })]);

    expect(screen.queryByLabelText('Smart Farm')).not.toBeInTheDocument();
  });

  test('hasSmartFarm=false แม้มีอุปกรณ์ค้าง ก็ไม่ขึ้นตรา', () => {
    renderDashboard([makeFarm('a', { hasSmartFarm: false, smartTechnologies: [smartTech] })]);

    expect(screen.queryByLabelText('Smart Farm')).not.toBeInTheDocument();
  });
});
