import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoogleSignInButton } from './GoogleSignInButton';

/**
 * ปุ่ม Google ตอนยังไม่ตั้งค่า OAuth
 *
 * ในสภาพแวดล้อมทดสอบไม่มี VITE_GOOGLE_CLIENT_ID จึงต้อง fallback เป็นปุ่มปิด
 * เดิม ไม่ใช่พยายามโหลดสคริปต์ GIS หรือพัง
 */

describe('GoogleSignInButton (ยังไม่ตั้งค่า client id)', () => {
  test('แสดงปุ่มปิดที่บอกว่ายังไม่เปิดใช้งาน', () => {
    render(<GoogleSignInButton onCredential={vi.fn()} />);

    const btn = screen.getByRole('button', { name: /ยังไม่เปิดใช้งาน/ });
    expect(btn).toBeDisabled();
  });

  test('ไม่เรียก onCredential เอง', () => {
    const onCredential = vi.fn();
    render(<GoogleSignInButton onCredential={onCredential} />);

    expect(onCredential).not.toHaveBeenCalled();
  });
});
