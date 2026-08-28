import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFarmRegistrationForm } from './useFarmRegistrationForm';

// hook เรียก useAuth เพื่อประกอบคีย์ของแบบร่าง จึงต้องมีผู้ใช้ปลอมให้คีย์คงที่
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'u1', displayName: 'สมชาย' } }),
}));

const DRAFT_KEY = 'durian_farm_registration_draft_u1';
const ID_CARD = '1229900341829';

/** แบบร่างที่ค้างอยู่ในเครื่องผู้ใช้ก่อนแพตช์นี้ -- มีเลขบัตรดิบปนอยู่ */
const legacyDraft = {
  agreedToCriteria: true,
  farmerFullName: 'นายสมชาย วงศ์เกษตร',
  farmerIdCardNumber: ID_CARD,
  farmName: 'สวนทุเรียนลุงสมชาย',
  farmNameEn: 'Lung Somchai Orchard',
  province: 'จันทบุรี',
  district: 'ท่าใหม่',
  areaRai: 12,
  totalTreesEstimate: 340,
  topVarietiesInput: 'หมอนทอง, ชะนี',
  phoneNumber: '0812345678',
  aboutStory: 'สวนเก่าแก่สามรุ่น',
};

const renderForm = () =>
  renderHook(() => useFarmRegistrationForm({ isOpen: true, mode: 'create' }));

describe('useFarmRegistrationForm -- เลขบัตรประชาชนกับแบบร่างใน localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ไม่กู้คืนเลขบัตรจากแบบร่างเดิม แต่ฟิลด์อื่นยังกู้คืนครบ', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(legacyDraft));

    const { result } = renderForm();

    expect(result.current.farmerIdCardNumber).toBe('');

    // ฟิลด์อื่นต้องไม่ได้รับผลกระทบ -- นี่คือจุดที่แพตช์นี้ต้องไม่ทำพัง
    expect(result.current.agreedToCriteria).toBe(true);
    expect(result.current.farmerFullName).toBe('นายสมชาย วงศ์เกษตร');
    expect(result.current.farmName).toBe('สวนทุเรียนลุงสมชาย');
    expect(result.current.farmNameEn).toBe('Lung Somchai Orchard');
    expect(result.current.province).toBe('จันทบุรี');
    expect(result.current.district).toBe('ท่าใหม่');
    expect(result.current.areaRai).toBe(12);
    expect(result.current.totalTreesEstimate).toBe(340);
    expect(result.current.topVarietiesInput).toBe('หมอนทอง, ชะนี');
    expect(result.current.phoneNumber).toBe('0812345678');
    expect(result.current.aboutStory).toBe('สวนเก่าแก่สามรุ่น');
  });

  it('ลบเลขบัตรที่ค้างอยู่ในแบบร่างเดิมออกจาก localStorage', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(legacyDraft));

    renderForm();

    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) as string);
    expect(stored).not.toHaveProperty('farmerIdCardNumber');
    // ล้างเฉพาะฟิลด์เดียว ไม่ได้ล้างทั้งแบบร่างทิ้ง
    expect(stored.farmName).toBe('สวนทุเรียนลุงสมชาย');
  });

  it('ไม่เขียนเลขบัตรลงแบบร่างเมื่อผู้ใช้พิมพ์', () => {
    const { result } = renderForm();

    act(() => {
      result.current.setFarmerIdCardNumber(ID_CARD);
      result.current.setFarmName('สวนใหม่');
    });

    const raw = localStorage.getItem(DRAFT_KEY) as string;
    expect(raw).not.toContain(ID_CARD);
    expect(JSON.parse(raw)).not.toHaveProperty('farmerIdCardNumber');
    // แบบร่างยังทำงานอยู่ ฟิลด์อื่นถูกบันทึกตามปกติ
    expect(JSON.parse(raw).farmName).toBe('สวนใหม่');
  });

  it('เลขบัตรยังอยู่ใน state ให้ส่งไปเซิร์ฟเวอร์ได้ตามปกติ', () => {
    const { result } = renderForm();

    act(() => {
      result.current.setFarmerIdCardNumber(ID_CARD);
    });

    expect(result.current.farmerIdCardNumber).toBe(ID_CARD);
  });
});
