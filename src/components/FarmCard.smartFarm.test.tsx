import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FarmCard } from './FarmCard';
import type { DurianFarm, SmartTechItem } from '../types';

/**
 * ตรา Smart Farm ในมุมมองการ์ด
 *
 * การ์ดใช้ข้อมูลชุดเดียวกับ FarmRow จึงต้องแสดง Smart Farm ให้ตรงกัน
 * เกณฑ์เดียวกัน: มีอุปกรณ์ที่ยัง active อย่างน้อยหนึ่ง และ hasSmartFarm ไม่เป็น false
 */

const tech = (over: Partial<SmartTechItem> = {}): SmartTechItem => ({
  id: 'st-d1',
  name: 'ระบบน้ำหยดอัตโนมัติ',
  subtext: 'ควบคุมผ่านแอป',
  iconEmoji: '💧',
  active: true,
  ...over,
});

function makeFarm(over: Partial<DurianFarm> = {}): DurianFarm {
  return {
    id: 'farm-1',
    rank: 1,
    name: 'สวนทดสอบการ์ด',
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

const renderCard = (farm: DurianFarm) => render(<FarmCard farm={farm} onSelectFarm={vi.fn()} />);

describe('ตรา Smart Farm ในการ์ดฟาร์ม', () => {
  test('สวนที่มีอุปกรณ์ active ต้องขึ้นตรา', () => {
    renderCard(makeFarm({ smartTechnologies: [tech()] }));

    expect(screen.getByText('Smart Farm')).toBeInTheDocument();
  });

  test('สวนที่ไม่มีอุปกรณ์เลย ไม่ขึ้นตรา', () => {
    renderCard(makeFarm({ smartTechnologies: [] }));

    expect(screen.queryByText('Smart Farm')).not.toBeInTheDocument();
  });

  test('อุปกรณ์ที่ถูกปิด (active=false) ไม่นับ', () => {
    renderCard(makeFarm({ smartTechnologies: [tech({ active: false })] }));

    expect(screen.queryByText('Smart Farm')).not.toBeInTheDocument();
  });

  test('hasSmartFarm=false แม้มีอุปกรณ์ค้าง ก็ไม่ขึ้นตรา', () => {
    renderCard(makeFarm({ hasSmartFarm: false, smartTechnologies: [tech()] }));

    expect(screen.queryByText('Smart Farm')).not.toBeInTheDocument();
  });
});
