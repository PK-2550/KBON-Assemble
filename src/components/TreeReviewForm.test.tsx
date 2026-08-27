import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreeReviewForm } from './TreeReviewForm';
import type { NfcScannedFruit } from '../types';
import * as farmService from '../services/farmService';

const FRUIT: NfcScannedFruit = {
  tagId: 'NFC Tag: #VK-001-F001',
  treeCode: 'VK-001',
  treeName: 'ต้นทดสอบ',
  farmName: 'สวนทดสอบ',
  variety: 'หมอนทอง',
  weightKg: 3.4,
  harvestDate: '1 ส.ค. 2569',
  verified: true,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('TreeReviewForm', () => {
  test('แสดงรหัสแท็กและน้ำหนักของผลที่สแกนมา', () => {
    render(<TreeReviewForm treeCode="VK-001" scannedFruit={FRUIT} onSubmitted={vi.fn()} />);
    expect(screen.getByText('NFC Tag: #VK-001-F001')).toBeInTheDocument();
    expect(screen.getByText(/3\.4 กก\./)).toBeInTheDocument();
  });

  test('ไม่ให้ส่งถ้ายังไม่ให้คะแนน', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(farmService, 'createTreeReview');
    render(<TreeReviewForm treeCode="VK-001" scannedFruit={FRUIT} onSubmitted={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /ส่งรีวิว/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาให้คะแนนก่อนส่งรีวิว');
    expect(spy).not.toHaveBeenCalled();
  });

  test('ไม่ให้ส่งถ้าไม่ได้เขียนความคิดเห็น', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(farmService, 'createTreeReview');
    render(<TreeReviewForm treeCode="VK-001" scannedFruit={FRUIT} onSubmitted={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'ให้ 4 ดาว' }));
    await user.click(screen.getByRole('button', { name: /ส่งรีวิว/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาเขียนความคิดเห็น');
    expect(spy).not.toHaveBeenCalled();
  });

  test('ส่งรีวิวพร้อมคะแนนสเกล 10 คำบรรยาย และข้อมูลแท็กของผล', async () => {
    const user = userEvent.setup();
    const created = { id: 'r1', authorName: 'someone' } as never;
    const spy = vi.spyOn(farmService, 'createTreeReview').mockResolvedValue(created);
    const onSubmitted = vi.fn();

    render(<TreeReviewForm treeCode="VK-001" scannedFruit={FRUIT} onSubmitted={onSubmitted} />);

    await user.click(screen.getByRole('button', { name: 'ให้ 4 ดาว' }));
    await user.type(screen.getByLabelText('ความคิดเห็น'), 'หวานมัน เนื้อละเอียด');
    await user.click(screen.getByRole('button', { name: 'เม็ดลีบ' }));

    await user.click(screen.getByRole('button', { name: /ส่งรีวิว/ }));

    expect(spy).toHaveBeenCalledWith('VK-001', {
      // สี่ดาวบนหน้าจอ เก็บเป็น 8 เต็ม 10 ให้ตรงกับสเกลที่ API และรีวิวเดิมใช้
      rating: 8,
      comment: 'หวานมัน เนื้อละเอียด',
      tastingNotes: ['เม็ดลีบ'],
      nfcFruitTag: 'NFC Tag: #VK-001-F001',
      nfcFruitWeightKg: 3.4,
      verifiedNfc: true,
    });
    expect(onSubmitted).toHaveBeenCalledWith(created);
  });

  test('ล้างฟอร์มหลังส่งสำเร็จ', async () => {
    const user = userEvent.setup();
    vi.spyOn(farmService, 'createTreeReview').mockResolvedValue({ id: 'r1' } as never);

    render(<TreeReviewForm treeCode="VK-001" scannedFruit={FRUIT} onSubmitted={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'ให้ 5 ดาว' }));
    const box = screen.getByLabelText('ความคิดเห็น');
    await user.type(box, 'อร่อยมาก');
    await user.click(screen.getByRole('button', { name: /ส่งรีวิว/ }));

    expect(box).toHaveValue('');
  });

  test('แสดงข้อความจาก API เมื่อส่งไม่สำเร็จ และไม่ล้างสิ่งที่พิมพ์ไว้', async () => {
    const user = userEvent.setup();
    vi.spyOn(farmService, 'createTreeReview').mockRejectedValue(
      new Error('ไม่พบต้นไม้รหัสนี้ในระบบ')
    );

    render(<TreeReviewForm treeCode="VK-001" scannedFruit={FRUIT} onSubmitted={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'ให้ 3 ดาว' }));
    const box = screen.getByLabelText('ความคิดเห็น');
    await user.type(box, 'ข้อความที่ไม่ควรหาย');
    await user.click(screen.getByRole('button', { name: /ส่งรีวิว/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบต้นไม้รหัสนี้ในระบบ');
    expect(box).toHaveValue('ข้อความที่ไม่ควรหาย');
  });

  test('กดคำบรรยายซ้ำเป็นการยกเลิกการเลือก', async () => {
    const user = userEvent.setup();
    render(<TreeReviewForm treeCode="VK-001" scannedFruit={FRUIT} onSubmitted={vi.fn()} />);

    const chip = screen.getByRole('button', { name: 'หวานจัด' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });
});
