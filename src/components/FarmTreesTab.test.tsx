import React, { useState } from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FarmTreesTab, type TreeFilter, type TreeSort } from './FarmTreesTab';
import type { IndividualTree } from '../types';

function makeTree(over: Partial<IndividualTree> & { code: string }): IndividualTree {
  return {
    id: over.code,
    name: `ต้น ${over.code}`,
    variety: 'หมอนทอง',
    category: 'durian_main',
    categoryLabel: 'ทุเรียนหลัก',
    propagationType: 'grafted',
    propagationLabel: 'เสียบยอด',
    propagationCode: 'AUTO',
    zone: 'โซน A',
    plantedDate: '1 ม.ค. 2560',
    ageYears: 8,
    yieldFruitCount: 10,
    yieldWeightKg: 30,
    diariesCount: 5,
    rating: 9,
    reviewCount: 3,
    healthStatus: 'excellent',
    ...over,
  };
}

const TREES: IndividualTree[] = [
  makeTree({ code: 'VK-001', rating: 9.9, yieldFruitCount: 10 }),
  makeTree({ code: 'VK-002', rating: 9.5, yieldFruitCount: 90 }),
  makeTree({ code: 'VK-003', rating: 9.1, yieldFruitCount: 50 }),
];

/**
 * จำลองหน้าฟาร์มแบบย่อ ให้มีพฤติกรรมเดียวกับ FarmProfileView ตรงจุดที่สำคัญ
 *
 * จุดนั้นคือ early-return ที่แทนที่ทั้งหน้าเมื่อเลือกต้นไม้
 * ตัวหน้าแม่ยังคง mount อยู่ แต่ลูกทั้งหมดถูก unmount
 * สถานะที่เก็บไว้ในลูกจึงหายไป ส่วนสถานะที่เก็บไว้ในแม่ยังอยู่
 */
function FarmPageStub({ keepStateInParent }: { keepStateInParent: boolean }) {
  const [selectedTree, setSelectedTree] = useState<IndividualTree | null>(null);

  // สถานะชุดนี้อยู่ที่หน้าแม่ ซึ่งเป็นวิธีที่โค้ดจริงใช้
  const [filter, setFilter] = useState<TreeFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TreeSort>('rating');

  if (selectedTree) {
    return (
      <div>
        <div>หน้ารายละเอียดต้น {selectedTree.code}</div>
        <button onClick={() => setSelectedTree(null)}>กลับไปหน้าฟาร์ม</button>
      </div>
    );
  }

  // keepStateInParent=false จำลองทางเลือกที่เคยลองแล้วพัง
  // คือให้แท็บถือสถานะเอง ซึ่งจะหายทุกครั้งที่ถูก unmount
  return keepStateInParent ? (
    <FarmTreesTab
      trees={TREES}
      onSelectTree={setSelectedTree}
      filter={filter}
      onFilterChange={setFilter}
      search={search}
      onSearchChange={setSearch}
      sort={sort}
      onSortChange={setSort}
    />
  ) : (
    <TabWithOwnState onSelectTree={setSelectedTree} />
  );
}

/** แท็บที่ถือสถานะเอง ใช้เทียบให้เห็นว่าทำไมถึงเก็บไว้ที่แม่ */
function TabWithOwnState({ onSelectTree }: { onSelectTree: (t: IndividualTree) => void }) {
  const [filter, setFilter] = useState<TreeFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TreeSort>('rating');
  return (
    <FarmTreesTab
      trees={TREES}
      onSelectTree={onSelectTree}
      filter={filter}
      onFilterChange={setFilter}
      search={search}
      onSearchChange={setSearch}
      sort={sort}
      onSortChange={setSort}
    />
  );
}

/** ลำดับรหัสต้นที่แสดงอยู่ตอนนี้ อ่านจากข้อความบนหน้าจอ ไม่ได้อ่านจาก state */
function visibleCodes(): string[] {
  return TREES.map((t) => t.code).filter((code) => screen.queryByText(code) !== null);
}

describe('FarmTreesTab เก็บค่าการเรียงลำดับข้ามการเข้าดูต้นไม้', () => {
  test('ตั้งค่าเรียงลำดับ เข้าดูต้นไม้ ย้อนกลับ แล้วค่ายังเป็นค่าเดิม', async () => {
    const user = userEvent.setup();
    render(<FarmPageStub keepStateInParent />);

    const sortBox = screen.getByRole('combobox');
    expect(sortBox).toHaveValue('rating');

    await user.selectOptions(sortBox, 'yield');
    expect(sortBox).toHaveValue('yield');
    // เรียงตามผลผลิตแล้ว VK-002 (90 ลูก) ต้องมาก่อน
    expect(visibleCodes()).toEqual(['VK-001', 'VK-002', 'VK-003']);

    // เข้าดูต้นไม้ ทั้งหน้าถูกแทนที่ แท็บถูก unmount
    await user.click(screen.getByText('ต้น VK-002'));
    expect(screen.getByText('หน้ารายละเอียดต้น VK-002')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    // ย้อนกลับ แท็บถูก mount ใหม่
    await user.click(screen.getByRole('button', { name: 'กลับไปหน้าฟาร์ม' }));

    // นี่คือข้อที่จับ regression ตัวจริง
    // ถ้าย้ายสถานะลงไปไว้ในแท็บ ค่านี้จะกลับเป็น rating
    expect(screen.getByRole('combobox')).toHaveValue('yield');
  });

  test('ยืนยันว่าถ้าเก็บสถานะไว้ในแท็บ ค่าจะหายจริง จึงต้องเก็บไว้ที่หน้าแม่', async () => {
    const user = userEvent.setup();
    render(<FarmPageStub keepStateInParent={false} />);

    await user.selectOptions(screen.getByRole('combobox'), 'yield');
    expect(screen.getByRole('combobox')).toHaveValue('yield');

    await user.click(screen.getByText('ต้น VK-002'));
    await user.click(screen.getByRole('button', { name: 'กลับไปหน้าฟาร์ม' }));

    // แท็บถูกสร้างใหม่ ค่าจึงกลับไปเป็นค่าเริ่มต้น
    expect(screen.getByRole('combobox')).toHaveValue('rating');
  });
});

describe('FarmTreesTab กรอง ค้นหา และเรียงลำดับ', () => {
  test('ค้นหาแล้วเหลือเฉพาะต้นที่ตรง และล้างคำค้นแล้วกลับมาครบ', async () => {
    const user = userEvent.setup();
    render(<FarmPageStub keepStateInParent />);

    const box = screen.getByPlaceholderText(/ค้นหารหัสต้น/);
    await user.type(box, 'VK-002');
    expect(visibleCodes()).toEqual(['VK-002']);

    await user.clear(box);
    expect(visibleCodes()).toEqual(['VK-001', 'VK-002', 'VK-003']);
  });

  test('ค้นหาไม่เจอแล้วขึ้นข้อความบอก', async () => {
    const user = userEvent.setup();
    render(<FarmPageStub keepStateInParent />);

    await user.type(screen.getByPlaceholderText(/ค้นหารหัสต้น/), 'ไม่มีทางเจอ');
    expect(screen.getByText('ไม่พบรายชื่อต้นไม้ตามเงื่อนไขที่ค้นหา')).toBeInTheDocument();
  });

  test('เลือกต้นไม้แล้วส่งต้นที่ถูกกดขึ้นไปให้หน้าแม่', async () => {
    const user = userEvent.setup();
    render(<FarmPageStub keepStateInParent />);

    await user.click(screen.getByText('ต้น VK-003'));
    expect(screen.getByText('หน้ารายละเอียดต้น VK-003')).toBeInTheDocument();
  });
});
