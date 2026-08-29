import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFarmRegistrationForm } from './useFarmRegistrationForm';
import type { FarmRegistrationRequest } from '../types';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'u1', displayName: 'ผู้ยื่นคำขอ' } }),
}));

/**
 * ฟอร์มต้องเตือนตั้งแต่ก่อนส่ง ถ้าเลขบัตรหลักตรวจสอบไม่ผ่าน
 *
 * เซิร์ฟเวอร์ปฏิเสธอยู่แล้ว แต่ถ้าปล่อยให้กรอกจนจบห้าขั้นแล้วค่อยโดนปฏิเสธ
 * ผู้ใช้จะเสียเวลาฟรีและไม่รู้ว่าผิดตรงไหน เตือนที่ขั้นที่ 2 ซึ่งเป็นขั้นที่กรอก
 */

const base: Partial<FarmRegistrationRequest> = {
  id: 'req_checksum_1',
  requestCategory: 'manager_application',
  status: 'pending',
  farmName: 'สวนทดสอบ checksum',
  province: 'จันทบุรี',
  farmerFullName: 'นายทดสอบ เช็คซัม',
  agreedToCriteria: true,
  hasIdCardPhoto: true,
  contact: { phoneNumber: '0812345678' },
};

const renderForm = () =>
  renderHook(() => useFarmRegistrationForm({ isOpen: true, mode: 'create', initialData: base }));

describe('ฟอร์มเตือนเลขบัตรที่หลักตรวจสอบไม่ผ่าน', () => {
  beforeEach(() => localStorage.clear());

  it('เลขครบ 13 หลักแต่หลักตรวจสอบผิด ต้องไม่ให้ผ่านขั้นที่ 2', () => {
    const { result } = renderForm();

    act(() => result.current.setStep(2));
    act(() => result.current.setFarmerIdCardNumber('1229900341829'));
    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(2);
    expect(result.current.errorMessage).toMatch(/ไม่ถูกต้อง|ตรวจสอบ/);
  });

  it('เลขที่ขึ้นต้นด้วยศูนย์ ต้องไม่ให้ผ่าน', () => {
    const { result } = renderForm();

    act(() => result.current.setStep(2));
    act(() => result.current.setFarmerIdCardNumber('0123456789012'));
    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(2);
  });

  it('เลขที่ถูกต้องผ่านได้ตามปกติ', () => {
    const { result } = renderForm();

    act(() => result.current.setStep(2));
    act(() => result.current.setFarmerIdCardNumber('1229900341828'));
    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(3);
    expect(result.current.errorMessage).toBe('');
  });

  it('พิมพ์ขีดคั่นมาด้วยก็ยังผ่าน', () => {
    const { result } = renderForm();

    act(() => result.current.setStep(2));
    act(() => result.current.setFarmerIdCardNumber('1-2299-00341-82-8'));
    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(3);
  });

  it('ไม่กรอกเลขบัตรเลย ยังผ่านได้ เพราะเป็นช่องไม่บังคับ', () => {
    const { result } = renderForm();

    act(() => result.current.setStep(2));
    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(3);
  });

  it('ยังเตือนเรื่องจำนวนหลักเหมือนเดิมถ้ากรอกไม่ครบ', () => {
    const { result } = renderForm();

    act(() => result.current.setStep(2));
    act(() => result.current.setFarmerIdCardNumber('12299'));
    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(2);
    expect(result.current.errorMessage).toContain('13 หลัก');
  });
});
