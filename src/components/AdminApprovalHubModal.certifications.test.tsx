import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AdminApprovalHubModal } from './AdminApprovalHubModal';
import type { FarmRegistrationRequest } from '../types';
import type { CertificationTypeOption } from '../services/certificationTypeService';

/**
 * ใบรับรองทุกใบที่ผู้ใช้กรอกมา ต้องเห็นครบตอนแอดมินตรวจ
 *
 * ฟอร์มเปิดให้เลือกได้เจ็ดประเภทแล้ว แต่หน้าตรวจยังวางอยู่บนสมมติฐานเดิมว่ามีใบเดียว
 * คือ GAP ส่วนหัวข้อชุดสามช่อง (เลขที่ GAP / หน่วยงาน / ใช้ได้ถึงปี) อ่านจากคอลัมน์
 * เก่าที่รองรับใบเดียว ส่วนรายการใบที่แนบมาแสดงแค่รหัสกับเลขที่
 *
 * แอดมินจึงตัดสินใบ GMP หรือ GACC โดยไม่เห็นหน่วยงานผู้ออกและวันหมดอายุของใบนั้นเลย
 * ทั้งที่สองอย่างนี้คือสิ่งที่ใช้ตรวจว่าใบยังใช้ได้จริงหรือไม่
 *
 * และใบระดับโซนอย่าง GI ที่อนุมัติไปแล้วตราจะยังไม่ขึ้นจนกว่าจะจับคู่โซน
 * ถ้าหน้าตรวจไม่บอก แอดมินจะเข้าใจว่ากดอนุมัติแล้วจบ
 */

const TYPES: CertificationTypeOption[] = [
  { code: 'GAP', tier: 'farm', name: 'GAP', nameTh: 'GAP (Good Agricultural Practice)', requiresExpiry: true, sortOrder: 1 },
  { code: 'GMP', tier: 'packing_house', name: 'GMP', nameTh: 'มาตรฐาน GMP โรงคัดบรรจุ', requiresExpiry: true, sortOrder: 3 },
  { code: 'GI', tier: 'regional', name: 'GI', nameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์', requiresExpiry: true, sortOrder: 6 },
];

const BASE: FarmRegistrationRequest = {
  id: 'req_cert_view',
  requestCategory: 'manager_application',
  userId: 'u-owner',
  userDisplayName: 'เจ้าของสวนทดสอบ',
  userEmailOrUsername: 'owner_test',
  farmName: 'สวนทดสอบหน้าตรวจใบรับรอง',
  province: 'ศรีสะเกษ',
  district: 'กันทรลักษ์',
  areaRai: 12,
  totalTreesEstimate: 120,
  topVarieties: ['หมอนทอง'],
  aboutStory: 'เรื่องราวสวน',
  contact: { phoneNumber: '0812345678' },
  gapCertNumber: '',
  certIssuedBy: '',
  certValidUntil: '',
  status: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const WITH_LIST: FarmRegistrationRequest = {
  ...BASE,
  certificationList: [
    {
      name: 'GAP',
      shortCode: 'GAP',
      certNumber: 'กษ 01-7001-2569',
      issuedBy: 'กรมวิชาการเกษตร',
      validUntil: '2571',
      verified: false,
    },
    {
      name: 'GMP',
      shortCode: 'GMP',
      certNumber: 'GMP-2569-118',
      issuedBy: 'สำนักงานคณะกรรมการอาหารและยา',
      validUntil: '2570',
      verified: false,
    },
    {
      name: 'GI',
      shortCode: 'GI',
      certNumber: 'GI-SSK-2569-004',
      issuedBy: 'กรมทรัพย์สินทางปัญญา',
      validUntil: '2572',
      verified: false,
    },
  ],
};

/** คำขอรุ่นเก่าที่กรอกมาก่อนระบบรองรับหลายใบ เก็บไว้แค่คอลัมน์ GAP ชุดเดิม */
const LEGACY_ONLY: FarmRegistrationRequest = {
  ...BASE,
  id: 'req_cert_legacy',
  gapCertNumber: 'กษ 01-0001-2560',
  certIssuedBy: 'กรมวิชาการเกษตร',
  certValidUntil: '2568',
};

let current: FarmRegistrationRequest = WITH_LIST;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'admin-1', displayName: 'แอดมิน', role: 'admin' } }),
}));

vi.mock('../services/farmRequestService', () => ({
  subscribeAllFarmRequests: (cb: (r: FarmRegistrationRequest[]) => void) => {
    cb([current]);
    return () => {};
  },
  getInitialFarmRequests: () => [current],
  getReadRequestIds: () => new Set<string>(),
  subscribeReadRequestIds: () => () => {},
  markRequestsAsRead: () => {},
  approveFarmRequest: vi.fn(),
  rejectFarmRequest: vi.fn(),
  resetFarmRequestToPending: vi.fn(),
  seedSampleManagerRequests: vi.fn(),
  revealFarmRequestIdCard: vi.fn(),
}));

vi.mock('../services/certificationTypeService', () => ({
  fetchCertificationTypes: () => Promise.resolve(TYPES),
}));

vi.mock('../services/regionalCertificationService', () => ({
  fetchRegionalZones: () => Promise.resolve([]),
  fetchPendingRegionalCertRequests: () => Promise.resolve([]),
  linkRegionalCertRequest: vi.fn(),
  rejectRegionalCertRequest: vi.fn(),
}));

/** รอให้คำขอถูกเลือกแล้วคืนกล่องใบรับรองของใบที่ระบุ */
async function certRow(shortCode: string): Promise<HTMLElement> {
  const rows = await screen.findAllByTestId('request-cert-row');
  const found = rows.find((r) => within(r).queryByText(shortCode));
  if (!found) throw new Error(`ไม่พบแถวใบรับรอง ${shortCode}`);
  return found;
}

describe('รายการใบรับรองในหน้าตรวจคำขอ', () => {
  test('เห็นครบทุกใบที่ผู้ใช้กรอกมา ไม่ใช่แค่ GAP', async () => {
    current = WITH_LIST;
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    const rows = await screen.findAllByTestId('request-cert-row');
    expect(rows).toHaveLength(3);
  });

  test('แต่ละใบต้องเห็นหน่วยงานผู้ออกและวันหมดอายุของใบนั้นเอง', async () => {
    // เดิมเห็นแค่รหัสกับเลขที่ แอดมินจึงตัดสินใบ GMP โดยไม่รู้ว่าใครออกให้
    // และหมดอายุเมื่อไหร่ ซึ่งเป็นสองอย่างที่ใช้ตรวจว่าใบยังใช้ได้จริง
    current = WITH_LIST;
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    const gmp = await certRow('GMP');
    expect(within(gmp).getByText('GMP-2569-118')).toBeInTheDocument();
    expect(within(gmp).getByText(/สำนักงานคณะกรรมการอาหารและยา/)).toBeInTheDocument();
    expect(within(gmp).getByText(/2570/)).toBeInTheDocument();
  });

  test('ชื่อประเภทเป็นภาษาไทยจากฐาน ไม่ใช่รหัสย่ออย่างเดียว', async () => {
    current = WITH_LIST;
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    const gmp = await certRow('GMP');
    expect(within(gmp).getByText('มาตรฐาน GMP โรงคัดบรรจุ')).toBeInTheDocument();
  });

  test('ใบระดับโซนต้องเตือนว่าตราจะยังไม่ขึ้นจนกว่าจะจับคู่โซน', async () => {
    // อนุมัติแล้วใบ GI ไปรอที่คิวจับคู่โซน ถ้าหน้าตรวจไม่บอก
    // แอดมินจะเข้าใจว่ากดอนุมัติแล้วจบ แล้วคำขอก็ค้างอยู่อย่างนั้น
    current = WITH_LIST;
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    const gi = await certRow('GI');
    expect(within(gi).getByText(/จับคู่โซน/)).toBeInTheDocument();
  });

  test('ใบของสวนตามปกติไม่ต้องมีคำเตือนเรื่องโซน', async () => {
    current = WITH_LIST;
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    const gap = await certRow('GAP');
    expect(within(gap).queryByText(/จับคู่โซน/)).not.toBeInTheDocument();
  });
});

describe('คำขอรุ่นเก่าที่มีแต่ช่อง GAP ชุดเดิม', () => {
  test('ยังต้องเห็นข้อมูลใบที่กรอกไว้ ไม่ใช่หายไปทั้งใบ', async () => {
    current = LEGACY_ONLY;
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    // เจาะเฉพาะในกล่องรายละเอียด เพราะเลขที่ใบโผล่ในการ์ดรายการด้านซ้ายด้วย
    const legacy = await screen.findByTestId('legacy-cert-fields');
    expect(within(legacy).getByText('กษ 01-0001-2560')).toBeInTheDocument();
    expect(within(legacy).getByText('กรมวิชาการเกษตร')).toBeInTheDocument();
    expect(within(legacy).getByText('2568')).toBeInTheDocument();
  });

  test('คำขอที่มีรายการใบครบแล้ว ไม่ต้องแสดงช่อง GAP ชุดเดิมซ้ำอีก', async () => {
    // ตอนอนุมัติ เซิร์ฟเวอร์ใช้คอลัมน์ชุดเดิมเฉพาะตอนไม่มีรายการใบเท่านั้น
    // ถ้าหน้าจอยังโชว์ทั้งคู่ แอดมินจะเห็นช่องว่างเปล่าสามช่องโดยไม่รู้ว่าแปลว่าอะไร
    current = WITH_LIST;
    render(<AdminApprovalHubModal isOpen onClose={() => {}} />);

    await screen.findAllByTestId('request-cert-row');
    expect(screen.queryByText(/เลขที่ใบรับรอง GAP/)).not.toBeInTheDocument();
  });
});
