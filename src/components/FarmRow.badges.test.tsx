import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FarmRow } from './FarmRow';
import type { DurianFarm, CertificationDetail, SmartTechItem } from '../types';

/**
 * ตราใบรับรองในหน้ารายชื่อฟาร์ม
 *
 * เดิมแถวนี้แสดงป้าย GI ใบเดียว โดยดูจาก farm.certifications ซึ่งเป็น array
 * ข้อความชุดเก่าที่ไม่มีสถานะการตรวจติดมาด้วย ป้ายจึงขึ้นแม้ใบนั้นจะยังไม่ผ่าน
 * การตรวจของแอดมิน เป็นข้อบกพร่องแบบเดียวกับ FarmDetailModal ที่เพิ่งถูกลบทิ้ง
 *
 * ตราต้องมาจาก certificationDetails ที่มีสถานะจริง และขึ้นเฉพาะใบที่อนุมัติแล้ว
 * ให้ตรงกับแถบตราในหน้ารายละเอียดฟาร์ม
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

function makeFarm(over: Partial<DurianFarm> = {}): DurianFarm {
  return {
    id: 'farm-1',
    rank: 1,
    name: 'สวนทดสอบตรา',
    province: 'จันทบุรี',
    varietiesCount: 3,
    topVarieties: ['หมอนทอง'],
    totalTrees: 100,
    harvestedFruits: 500,
    rating: 9.5,
    reviewCount: 20,
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

const renderRow = (farm: DurianFarm) =>
  render(<FarmRow farm={farm} onSelectFarm={vi.fn()} />);

describe('ตราใบรับรองในแถวรายชื่อฟาร์ม', () => {
  test('แสดงตราของใบที่อนุมัติแล้ว', () => {
    renderRow(makeFarm({ certificationDetails: [cert({}), cert({ shortCode: 'GI' })] }));

    expect(screen.getAllByText('GAP').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GI').length).toBeGreaterThan(0);
  });

  test('ใบที่ยังรอตรวจต้องไม่ขึ้นเป็นตรา', () => {
    renderRow(
      makeFarm({
        certificationDetails: [
          cert({}),
          cert({ shortCode: 'GMP', approvalStatus: 'pending', verified: false }),
        ],
      })
    );

    expect(screen.getAllByText('GAP').length).toBeGreaterThan(0);
    expect(screen.queryByText('GMP')).not.toBeInTheDocument();
  });

  test('ใบที่ถูกปฏิเสธหรือถูกตีกลับก็ไม่ขึ้น', () => {
    renderRow(
      makeFarm({
        certificationDetails: [
          cert({ shortCode: 'GMP', approvalStatus: 'rejected', verified: false }),
          cert({ shortCode: 'GACC', approvalStatus: 'needs_revision', verified: false }),
        ],
      })
    );

    expect(screen.queryByText('GMP')).not.toBeInTheDocument();
    expect(screen.queryByText('GACC')).not.toBeInTheDocument();
  });

  test('ไม่พึ่ง farm.certifications ชุดเก่าอีกแล้ว', () => {
    // array ข้อความชุดเก่าไม่มีสถานะการตรวจ ถ้ายังอ่านอยู่ ตราจะขึ้นทั้งที่
    // ไม่มีใบไหนผ่านการตรวจเลย
    renderRow(makeFarm({ certifications: ['GAP กรมวิชาการเกษตร', 'GI'], certificationDetails: [] }));

    expect(screen.queryByText('GAP')).not.toBeInTheDocument();
    expect(screen.queryByText('GI')).not.toBeInTheDocument();
  });

  test('ฟาร์มที่ไม่มีใบรับรองเลย ยังแสดงชื่อและจังหวัดได้ปกติ', () => {
    renderRow(makeFarm({ certificationDetails: [] }));

    expect(screen.getByText('สวนทดสอบตรา')).toBeInTheDocument();
    expect(screen.getAllByText('จันทบุรี').length).toBeGreaterThan(0);
  });

  test('ใบเยอะเกินไปต้องไม่ดันชื่อฟาร์มจนตกขอบ', () => {
    // แถวในหน้ารายชื่อแคบ ถ้าปล่อยให้ตราขึ้นทุกใบ ชื่อฟาร์มจะถูกบีบจนอ่านไม่ออก
    // จึงแสดงแค่ไม่กี่ใบแล้วบอกจำนวนที่เหลือ
    renderRow(
      makeFarm({
        certificationDetails: [
          cert({ shortCode: 'GAP' }),
          cert({ shortCode: 'GI' }),
          cert({ shortCode: 'GMP' }),
          cert({ shortCode: 'GACC' }),
        ],
      })
    );

    expect(screen.getAllByText('+1').length).toBeGreaterThan(0);
    expect(screen.queryByText('GACC')).not.toBeInTheDocument();
  });
});

const tech = (over: Partial<SmartTechItem> = {}): SmartTechItem => ({
  id: 'st-d1',
  name: 'ระบบน้ำหยดอัตโนมัติ',
  subtext: 'ควบคุมผ่านแอป',
  iconEmoji: '💧',
  active: true,
  ...over,
});

describe('ตรา Smart Farm ในแถวรายชื่อฟาร์ม', () => {
  test('สวนที่มีอุปกรณ์ Smart Farm ที่ยัง active ต้องขึ้นตรา', () => {
    renderRow(makeFarm({ smartTechnologies: [tech()] }));

    expect(screen.getAllByText('Smart Farm').length).toBeGreaterThan(0);
  });

  test('สวนที่ไม่มีอุปกรณ์เลย ไม่ขึ้นตรา', () => {
    renderRow(makeFarm({ smartTechnologies: [] }));

    expect(screen.queryByText('Smart Farm')).not.toBeInTheDocument();
  });

  test('อุปกรณ์ที่ถูกปิด (active=false) ไม่นับ ไม่ขึ้นตรา', () => {
    renderRow(makeFarm({ smartTechnologies: [tech({ active: false })] }));

    expect(screen.queryByText('Smart Farm')).not.toBeInTheDocument();
  });

  test('hasSmartFarm=false แม้ยังมีอุปกรณ์ค้าง ก็ไม่ขึ้นตรา', () => {
    renderRow(makeFarm({ hasSmartFarm: false, smartTechnologies: [tech()] }));

    expect(screen.queryByText('Smart Farm')).not.toBeInTheDocument();
  });
});
