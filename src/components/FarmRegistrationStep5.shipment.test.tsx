import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FarmRegistrationStep5 } from './FarmRegistrationStep5';
import type { CertificationTypeOption } from '../services/certificationTypeService';
import type { CertificationDetail } from '../types';

/**
 * ช่องเลขที่เที่ยวขนส่งของใบรับรองระดับการขนส่งรายเที่ยว
 *
 * ใบอย่าง PHYTO ออกให้ต่อการส่งออกหนึ่งครั้ง ไม่ใช่ของสวนถาวร ตัวที่ทำให้ใบนี้
 * มีความหมายคือเลขที่เที่ยวขนส่งที่มันผูกอยู่ ถ้าไม่ถามก็เก็บไปแล้วอ้างอิงอะไร
 * ไม่ได้เลย
 *
 * และต้องบอกผู้ใช้ด้วยว่าใบนี้จะไม่ขึ้นเป็นตราบนหน้าสวน ไม่งั้นเขาจะกรอกมา
 * แล้วรอตราที่ไม่มีวันขึ้น ซึ่งเป็นอาการเดียวกับใบ GI ตอนก่อนแก้
 */

const TYPES: CertificationTypeOption[] = [
  { code: 'GAP', tier: 'farm', name: 'GAP', nameTh: 'มาตรฐาน GAP', requiresExpiry: true, sortOrder: 1 },
  { code: 'GI', tier: 'regional', name: 'GI', nameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์', requiresExpiry: true, sortOrder: 6 },
  { code: 'PHYTO', tier: 'shipment', name: 'PHYTO', nameTh: 'ใบรับรองสุขอนามัยพืช', requiresExpiry: true, sortOrder: 5 },
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

function renderStep(certs: CertificationDetail[], onUpdate = vi.fn()) {
  render(
    <FarmRegistrationStep5
      certificationList={certs}
      certificationTypes={TYPES}
      onAddCertificate={vi.fn()}
      onUpdateCertField={onUpdate}
      onSelectStandardOption={vi.fn()}
      onCertDocUpload={vi.fn()}
      onRemoveCertificate={vi.fn()}
      isUpdateMode={false}
      updateNotes=""
      onUpdateNotesChange={vi.fn()}
      onOpenPdf={vi.fn()}
    />
  );
  return onUpdate;
}

const shipmentBox = () => screen.getByLabelText(/เลขที่เที่ยวขนส่ง/);

describe('ช่องเลขที่เที่ยวขนส่ง', () => {
  test('เลือกใบระดับการขนส่ง ต้องมีช่องให้กรอก', async () => {
    renderStep([cert({ shortCode: 'PHYTO' })]);

    expect(shipmentBox()).toBeInTheDocument();
  });

  test('ใบของสวนตามปกติ ไม่ต้องมีช่องนี้', async () => {
    renderStep([cert({ shortCode: 'GAP' })]);

    expect(screen.queryByLabelText(/เลขที่เที่ยวขนส่ง/)).not.toBeInTheDocument();
  });

  test('ใบระดับโซน ก็ไม่ต้องมีช่องนี้', async () => {
    renderStep([cert({ shortCode: 'GI' })]);

    expect(screen.queryByLabelText(/เลขที่เที่ยวขนส่ง/)).not.toBeInTheDocument();
  });

  test('พิมพ์แล้วส่งค่าขึ้นไปที่ shipmentRef', async () => {
    const user = userEvent.setup();
    const onUpdate = renderStep([cert({ shortCode: 'PHYTO' })]);

    await user.type(shipmentBox(), 'C');

    expect(onUpdate).toHaveBeenCalledWith(0, 'shipmentRef', 'C');
  });

  test('แสดงค่าที่กรอกไว้แล้ว', async () => {
    renderStep([cert({ shortCode: 'PHYTO', shipmentRef: 'CN-2569-0451' })]);

    expect(shipmentBox()).toHaveValue('CN-2569-0451');
  });

  test('ช่องนี้ขึ้นเฉพาะใบที่เป็นระดับการขนส่ง ไม่ใช่ขึ้นทุกใบเมื่อมี PHYTO ปนอยู่', async () => {
    renderStep([cert({ shortCode: 'GAP' }), cert({ shortCode: 'PHYTO' })]);

    expect(screen.getAllByLabelText(/เลขที่เที่ยวขนส่ง/)).toHaveLength(1);
  });
});

describe('คำอธิบายของใบระดับการขนส่ง', () => {
  test('ต้องบอกว่าใบนี้จะไม่ขึ้นเป็นตราบนหน้าสวน', async () => {
    // ถ้าไม่บอก ผู้ใช้จะกรอกมาแล้วรอตราที่ไม่มีวันขึ้น
    renderStep([cert({ shortCode: 'PHYTO' })]);

    expect(screen.getByText(/ไม่ขึ้นเป็นตรา/)).toBeInTheDocument();
  });

  test('ใบของสวนตามปกติ ไม่ต้องมีคำอธิบายนี้', async () => {
    renderStep([cert({ shortCode: 'GAP' })]);

    expect(screen.queryByText(/ไม่ขึ้นเป็นตรา/)).not.toBeInTheDocument();
  });

  test('คำอธิบายของใบระดับโซนยังอยู่เหมือนเดิม ไม่ถูกแทนที่', async () => {
    renderStep([cert({ shortCode: 'GI' })]);

    expect(screen.getByText(/แอดมินจะเป็นผู้จับคู่สวนของคุณเข้ากับโซน/)).toBeInTheDocument();
  });
});
