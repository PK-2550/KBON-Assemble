import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FarmRegistrationStep5 } from './FarmRegistrationStep5';
import type { CertificationTypeOption } from '../services/certificationTypeService';
import type { CertificationDetail } from '../types';

/**
 * ตัวเลือกประเภทใบรับรองในฟอร์มยื่นคำขอ
 *
 * เดิมรายการนี้ฝังไว้ในโค้ดฝั่งหน้าเว็บและไม่เคยตรงกับตาราง certification_types
 * Q-Mark กับ ISO เลือกได้แต่ไม่มีในฐาน จึงถูกบันทึกเป็น อื่น ๆ ย้ายมาจากระบบเดิม
 * ส่วน GMP กับ GACC มีในฐานตั้งแต่ 005 แต่เลือกไม่ได้เลย
 *
 * ใบระดับโซนอย่าง GI ต้องบอกผู้ใช้ด้วยว่าแอดมินจะเป็นคนจับคู่โซนให้
 * ไม่ใช่ปล่อยให้กรอกไปโดยไม่รู้ว่าตราจะยังไม่ขึ้นทันที
 */

const TYPES: CertificationTypeOption[] = [
  { code: 'GAP', tier: 'farm', name: 'GAP', nameTh: 'มาตรฐาน GAP', requiresExpiry: true, sortOrder: 1 },
  { code: 'GMP', tier: 'packing_house', name: 'GMP', nameTh: 'มาตรฐาน GMP โรงคัดบรรจุ', requiresExpiry: true, sortOrder: 3 },
  { code: 'GACC', tier: 'packing_house', name: 'GACC', nameTh: 'ขึ้นทะเบียน GACC', requiresExpiry: true, sortOrder: 4 },
  { code: 'GI', tier: 'regional', name: 'GI', nameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์', requiresExpiry: true, sortOrder: 6 },
  { code: 'Q_MARK', tier: 'farm', name: 'Q Mark', nameTh: 'เครื่องหมายคุณภาพ Q', requiresExpiry: true, sortOrder: 7 },
];

const cert = (over: Partial<CertificationDetail> = {}): CertificationDetail => ({
  name: 'GAP',
  shortCode: 'GAP',
  certNumber: '',
  issuedBy: '',
  validUntil: '',
  verified: false,
  ...over,
});

function renderStep(certs: CertificationDetail[], onSelect = vi.fn()) {
  render(
    <FarmRegistrationStep5
      certificationList={certs}
      certificationTypes={TYPES}
      onAddCertificate={vi.fn()}
      onUpdateCertField={vi.fn()}
      onSelectStandardOption={onSelect}
      onCertDocUpload={vi.fn()}
      onRemoveCertificate={vi.fn()}
      isUpdateMode={false}
      updateNotes=""
      onUpdateNotesChange={vi.fn()}
      onOpenPdf={vi.fn()}
    />
  );
  return onSelect;
}

describe('ตัวเลือกประเภทใบรับรองในฟอร์ม', () => {
  test('ตัวเลือกมาจากรายการที่ส่งเข้ามา ไม่ใช่รายการที่ฝังไว้ในโค้ด', () => {
    renderStep([cert()]);

    const select = screen.getByRole('combobox');
    const codes = [...select.querySelectorAll('option')].map((o) => o.getAttribute('value'));

    expect(codes).toEqual(['GAP', 'GMP', 'GACC', 'GI', 'Q_MARK']);
  });

  test('GMP กับ GACC เลือกได้แล้ว', async () => {
    const onSelect = renderStep([cert()]);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'GMP');

    expect(onSelect).toHaveBeenCalledWith(0, 'GMP');
  });

  test('เลือกใบระดับโซน ต้องบอกผู้ใช้ว่าแอดมินจะจับคู่โซนให้', () => {
    renderStep([cert({ shortCode: 'GI' })]);

    expect(screen.getByText(/แอดมินจะเป็นผู้จับคู่สวนของคุณเข้ากับโซน/)).toBeInTheDocument();
  });

  test('ใบของสวนตามปกติ ไม่ต้องมีคำอธิบายเรื่องโซน', () => {
    renderStep([cert({ shortCode: 'GAP' })]);

    expect(screen.queryByText(/แอดมินจะเป็นผู้จับคู่สวนของคุณเข้ากับโซน/)).not.toBeInTheDocument();
  });

  test('คำอธิบายขึ้นเฉพาะใบที่เป็นระดับโซน ไม่ใช่ขึ้นทุกใบเมื่อมี GI อยู่ในรายการ', () => {
    renderStep([cert({ shortCode: 'GAP' }), cert({ shortCode: 'GI' })]);

    expect(screen.getAllByText(/แอดมินจะเป็นผู้จับคู่สวนของคุณเข้ากับโซน/)).toHaveLength(1);
  });
});
