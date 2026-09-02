import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegionalZoneForm } from './RegionalZoneForm';
import type { RegionalZone } from '../services/regionalCertificationService';

/**
 * ฟอร์มสร้างและแก้ไขโซนใบรับรองระดับภูมิภาค
 *
 * เปิดจากการ์ดคำขอในหน้าจับคู่ ซึ่งเป็นนาทีที่แอดมินเพิ่งรู้ตัวว่าไม่มีโซนไหนตรง
 * ข้อมูลที่ต้องกรอกอยู่ตรงหน้าอยู่แล้วทั้งหมด ถ้าให้จำแล้วไปพิมพ์ใหม่ที่อื่น
 * นั่นคือทางที่ทำให้พิมพ์ผิดจนเกิดโซนซ้ำ
 */

const ZONE: RegionalZone = {
  id: 5,
  regionName: 'ศรีสะเกษ',
  province: 'ศรีสะเกษ',
  certNumber: 'GI-TH-10088',
  issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
  approvalStatus: 'approved',
  typeCode: 'GI',
  typeNameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
  linkedFarmCount: 1,
  validUntil: '2573',
};

const createZone = vi.fn();
const updateZone = vi.fn();

vi.mock('../services/regionalCertificationService', () => ({
  createRegionalZone: (...a: unknown[]) => createZone(...a),
  updateRegionalZone: (...a: unknown[]) => updateZone(...a),
}));

const onSaved = vi.fn();

beforeEach(() => {
  createZone.mockReset().mockResolvedValue({ ok: true, zone: { ...ZONE, id: 99 } });
  updateZone.mockReset().mockResolvedValue({ ok: true, zone: ZONE });
  onSaved.mockReset();
});

function renderCreate(overrides: Record<string, unknown> = {}) {
  render(
    <RegionalZoneForm
      mode="create"
      typeCode="GI"
      typeNameTh="GI สิ่งบ่งชี้ทางภูมิศาสตร์"
      initial={{
        regionName: '',
        province: 'จันทบุรี',
        certNumber: 'GI-REQ-001',
        issuingAuthority: 'กรมทรัพย์สินทางปัญญา',
        validUntil: '2573',
      }}
      existingZones={[ZONE]}
      onSaved={onSaved}
      onCancel={vi.fn()}
      {...overrides}
    />
  );
}

const nameBox = () => screen.getByLabelText(/ชื่อโซน/);
const saveButton = () => screen.getByRole('button', { name: /บันทึก/ });

describe('ฟอร์มสร้างโซนใหม่', () => {
  test('เปิดมาพร้อมข้อมูลจากคำขอที่กำลังดูอยู่', async () => {
    // ทั้งจังหวัด เลขที่ใบ และหน่วยงาน อยู่ในคำขอตรงหน้าอยู่แล้ว
    renderCreate();

    expect(screen.getByLabelText(/จังหวัด/)).toHaveValue('จันทบุรี');
    expect(screen.getByLabelText(/เลขที่ใบรับรอง/)).toHaveValue('GI-REQ-001');
    expect(screen.getByLabelText(/หน่วยงานผู้ออก/)).toHaveValue('กรมทรัพย์สินทางปัญญา');
    expect(screen.getByLabelText(/ใช้ได้ถึง/)).toHaveValue('2573');
  });

  test('ยังไม่ตั้งชื่อโซน บันทึกไม่ได้', async () => {
    renderCreate();
    expect(saveButton()).toBeDisabled();
  });

  test('ชื่อที่มีแต่ช่องว่าง ก็ยังบันทึกไม่ได้', async () => {
    const user = userEvent.setup();
    renderCreate();

    await user.type(nameBox(), '    ');

    expect(saveButton()).toBeDisabled();
  });

  test('กรอกครบแล้วบันทึก ส่งค่าไปพร้อมประเภทใบของคำขอ', async () => {
    const user = userEvent.setup();
    renderCreate();

    await user.type(nameBox(), 'ทุเรียนจันทบุรี');
    await user.click(saveButton());

    await waitFor(() =>
      expect(createZone).toHaveBeenCalledWith(
        expect.objectContaining({
          certificationTypeCode: 'GI',
          regionName: 'ทุเรียนจันทบุรี',
          province: 'จันทบุรี',
          certNumber: 'GI-REQ-001',
        })
      )
    );
  });

  test('สร้างสำเร็จแล้วส่งโซนใหม่กลับให้ผู้เรียก', async () => {
    const user = userEvent.setup();
    renderCreate();

    await user.type(nameBox(), 'ทุเรียนจันทบุรี');
    await user.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 99 })));
  });
});

describe('เตือนโซนที่มีอยู่แล้วก่อนพิมพ์', () => {
  test('เลือกจังหวัดที่มีโซนอยู่แล้ว ต้องเห็นทันทีว่ามีอะไรอยู่', async () => {
    // ดักตั้งแต่ก่อนพิมพ์ ซ้ำส่วนใหญ่จะไม่ถูกพิมพ์ตั้งแต่แรก
    const user = userEvent.setup();
    renderCreate();

    await user.selectOptions(screen.getByLabelText(/จังหวัด/), 'ศรีสะเกษ');

    expect(await screen.findByText(/ศรีสะเกษ/, { selector: 'li, li *' })).toBeInTheDocument();
  });

  test('จังหวัดที่ยังไม่มีโซน ไม่ต้องขึ้นคำเตือน', async () => {
    const user = userEvent.setup();
    renderCreate();

    await user.selectOptions(screen.getByLabelText(/จังหวัด/), 'ตราด');

    expect(screen.queryByTestId('existing-zone-hint')).not.toBeInTheDocument();
  });
});

describe('เซิร์ฟเวอร์ตอบว่าอาจซ้ำ', () => {
  test('ต้องแสดงโซนที่มีอยู่ และยังบันทึกไม่ได้จนกว่าจะยืนยัน', async () => {
    createZone.mockResolvedValue({
      ok: false,
      code: 'SIMILAR_ZONE_EXISTS',
      error: 'จังหวัดจันทบุรีมีโซนของมาตรฐานนี้อยู่แล้ว 1 โซน',
      zones: [{ id: 1, regionName: 'จันทบุรี', province: 'จันทบุรี', certNumber: 'GI-TH-20088', linkedFarmCount: 1 }],
    });

    const user = userEvent.setup();
    renderCreate();

    await user.type(nameBox(), 'ทุเรียนจันทบุรีสายพันธุ์ใหม่');
    await user.click(saveButton());

    expect(await screen.findByText(/มีโซนของมาตรฐานนี้อยู่แล้ว/)).toBeInTheDocument();
    expect(screen.getByText('GI-TH-20088')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();

    // ปุ่มบันทึกต้องยังกดไม่ได้จนกว่าจะติ๊กยืนยัน ไม่ใช่กดซ้ำแล้วผ่านไปเอง
    expect(saveButton()).toBeDisabled();
  });

  test('ติ๊กยืนยันแล้วบันทึกอีกครั้ง ส่งการยืนยันไปด้วย', async () => {
    createZone.mockResolvedValueOnce({
      ok: false,
      code: 'SIMILAR_ZONE_EXISTS',
      error: 'จังหวัดจันทบุรีมีโซนของมาตรฐานนี้อยู่แล้ว 1 โซน',
      zones: [{ id: 1, regionName: 'จันทบุรี', province: 'จันทบุรี', certNumber: '', linkedFarmCount: 1 }],
    });

    const user = userEvent.setup();
    renderCreate();

    await user.type(nameBox(), 'ทุเรียนจันทบุรีสายพันธุ์ใหม่');
    await user.click(saveButton());
    await screen.findByText(/มีโซนของมาตรฐานนี้อยู่แล้ว/);

    await user.click(screen.getByRole('checkbox', { name: /ยืนยัน/ }));
    await user.click(saveButton());

    await waitFor(() =>
      expect(createZone).toHaveBeenLastCalledWith(
        expect.objectContaining({ confirmDuplicate: true })
      )
    );
  });
});

describe('เซิร์ฟเวอร์ตอบว่าซ้ำจริง', () => {
  test('ชื่อซ้ำ ต้องบอกเหตุผล และไม่มีทางข้ามด้วยการยืนยัน', async () => {
    // คำเตือนเรื่องจังหวัดเป็นด่านอ่อนที่คนข้ามได้ ส่วนชื่อซ้ำเป็นด่านแข็ง
    createZone.mockResolvedValue({
      ok: false,
      code: 'DUPLICATE_NAME',
      error: 'มีโซนชื่อ จันทบุรี อยู่แล้ว กรุณาตั้งชื่ออื่น',
    });

    const user = userEvent.setup();
    renderCreate();

    await user.type(nameBox(), 'จันทบุรี');
    await user.click(saveButton());

    expect(await screen.findByText(/มีโซนชื่อ จันทบุรี อยู่แล้ว/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /ยืนยัน/ })).not.toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  test('เลขทะเบียนซ้ำ ต้องบอกว่าไปชนกับโซนไหน', async () => {
    createZone.mockResolvedValue({
      ok: false,
      code: 'DUPLICATE_CERT_NUMBER',
      error: 'เลขที่ใบรับรอง GI-TH-20088 ถูกใช้กับโซน จันทบุรี แล้ว',
    });

    const user = userEvent.setup();
    renderCreate();

    await user.type(nameBox(), 'ชื่อไม่ซ้ำแต่เลขซ้ำ');
    await user.click(saveButton());

    expect(await screen.findByText(/ถูกใช้กับโซน จันทบุรี แล้ว/)).toBeInTheDocument();
  });
});

describe('โหมดแก้ไขโซนเดิม', () => {
  function renderEdit() {
    render(
      <RegionalZoneForm
        mode="edit"
        zoneId={ZONE.id}
        typeCode={ZONE.typeCode}
        typeNameTh={ZONE.typeNameTh}
        initial={{
          regionName: ZONE.regionName,
          province: ZONE.province,
          certNumber: ZONE.certNumber,
          issuingAuthority: ZONE.issuingAuthority,
          validUntil: ZONE.validUntil,
        }}
        existingZones={[ZONE]}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />
    );
  }

  test('เปิดมาพร้อมค่าปัจจุบันของโซน', () => {
    renderEdit();

    expect(nameBox()).toHaveValue('ศรีสะเกษ');
    expect(screen.getByLabelText(/เลขที่ใบรับรอง/)).toHaveValue('GI-TH-10088');
  });

  test('แก้ชื่อแล้วบันทึก เรียกเส้นทางแก้ไขพร้อม id ของโซน', async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.clear(nameBox());
    await user.type(nameBox(), 'ทุเรียนภูเขาไฟศรีสะเกษ');
    await user.click(saveButton());

    await waitFor(() =>
      expect(updateZone).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ regionName: 'ทุเรียนภูเขาไฟศรีสะเกษ' })
      )
    );
    expect(createZone).not.toHaveBeenCalled();
  });

  test('โซนของตัวเองไม่ถูกนับเป็นโซนที่มีอยู่ในจังหวัดเดียวกัน', async () => {
    // ไม่งั้นทุกครั้งที่เปิดฟอร์มแก้ไขจะขึ้นคำเตือนว่าจังหวัดนี้มีโซนอยู่แล้ว
    // ซึ่งก็คือตัวมันเอง
    renderEdit();

    expect(screen.queryByTestId('existing-zone-hint')).not.toBeInTheDocument();
  });
});
