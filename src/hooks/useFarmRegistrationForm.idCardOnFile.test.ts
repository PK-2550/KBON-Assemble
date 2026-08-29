import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFarmRegistrationForm } from './useFarmRegistrationForm';
import type { FarmRegistrationRequest } from '../types';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'u1', displayName: 'ผู้ยื่นคำขอ' } }),
}));

/**
 * เจ้าของคำขอที่เคยแนบสำเนาบัตรไว้แล้ว ต้องแก้คำขอต่อได้โดยไม่ต้องแนบใหม่
 *
 * ตั้งแต่เซิร์ฟเวอร์เลิกส่งเลขบัตรและรูปบัตรกลับมาให้ใครทั้งสิ้น
 * ช่องแนบไฟล์ในฟอร์มจึงว่างเสมอเมื่อเปิดคำขอเดิมขึ้นมาแก้
 * แต่ด่านตรวจของขั้นที่ 2 ยังบังคับว่าต้องมีไฟล์แนบ เจ้าของจึงกดถัดไปไม่ได้เลย
 * ทั้งที่ไฟล์ยังอยู่ครบในฐานข้อมูลและเข้ารหัสไว้เรียบร้อย
 *
 * ตัวบอกว่ามีไฟล์อยู่แล้วคือ hasIdCardPhoto ซึ่งเซิร์ฟเวอร์ส่งมาแทนตัวไฟล์
 */

/** คำขอที่ยื่นไปแล้วและกำลังรอผลพิจารณา -- ไม่มีเลขบัตรและไฟล์บัตรติดมาด้วยโดยตั้งใจ */
const pendingRequest: Partial<FarmRegistrationRequest> = {
  id: 'req_pending_1',
  requestCategory: 'manager_application',
  status: 'pending',
  farmName: 'สวนทดสอบรอผลพิจารณา',
  province: 'จันทบุรี',
  district: 'ท่าใหม่',
  farmerFullName: 'นายทดสอบ รอผล',
  agreedToCriteria: true,
  farmerIdCardMasked: 'X-XXXX-XXXXX-XX-8',
  hasIdCardPhoto: true,
  contact: { phoneNumber: '0812345678' },
};

const renderForm = (initialData: Partial<FarmRegistrationRequest>) =>
  renderHook(() => useFarmRegistrationForm({ isOpen: true, mode: 'create', initialData }));

describe('เปิดคำขอเดิมที่แนบสำเนาบัตรไว้แล้วขึ้นมาแก้', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ช่องเลขบัตรและไฟล์บัตรว่าง เพราะเซิร์ฟเวอร์ไม่ส่งกลับมา', () => {
    const { result } = renderForm(pendingRequest);

    expect(result.current.farmerIdCardNumber).toBe('');
    expect(result.current.farmerIdCardPhoto).toBe('');
    // แต่ข้อมูลอื่นต้องมาครบ
    expect(result.current.farmerFullName).toBe('นายทดสอบ รอผล');
    expect(result.current.phoneNumber).toBe('0812345678');
  });

  it('กดถัดไปจากขั้นที่ 2 ได้ ทั้งที่ไม่ได้แนบไฟล์ใหม่', () => {
    const { result } = renderForm(pendingRequest);

    act(() => result.current.setStep(2));
    expect(result.current.step).toBe(2);

    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(3);
    expect(result.current.errorMessage).toBe('');
  });

  it('คำขอที่ยังไม่เคยแนบไฟล์เลย ต้องยังถูกบังคับให้แนบเหมือนเดิม', () => {
    const { result } = renderForm({ ...pendingRequest, hasIdCardPhoto: false });

    act(() => result.current.setStep(2));
    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(2);
    expect(result.current.errorMessage).toContain('แนบรูปถ่าย');
  });

  it('คำขอที่ส่งไฟล์บัตรมาพร้อมข้อมูลเดิม ก็ยังผ่านตามปกติ', () => {
    // เส้นทางนี้เกิดตอนแอดมินเปิดคำขอที่มีไฟล์แนบมาจริง ๆ ใน initialData
    const { result } = renderForm({
      ...pendingRequest,
      hasIdCardPhoto: false,
      farmerIdCardPhoto: 'data:image/jpeg;base64,TkVXX0ZJTEU=',
    });

    act(() => result.current.setStep(2));
    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(3);
    expect(result.current.errorMessage).toBe('');
  });

  it('เลขบัตรที่กรอกมาไม่ครบ 13 หลัก ยังถูกปฏิเสธเหมือนเดิม', () => {
    const { result } = renderForm(pendingRequest);

    act(() => result.current.setStep(2));
    act(() => result.current.setFarmerIdCardNumber('12299'));
    act(() => result.current.handleNextStep());

    expect(result.current.step).toBe(2);
    expect(result.current.errorMessage).toContain('13 หลัก');
  });
});
