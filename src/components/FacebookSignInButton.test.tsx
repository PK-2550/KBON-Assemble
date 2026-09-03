import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FacebookSignInButton } from './FacebookSignInButton';

/**
 * ปุ่ม Facebook ตอนยังไม่ตั้งค่า OAuth
 *
 * ในสภาพแวดล้อมทดสอบไม่มี VITE_FACEBOOK_APP_ID จึงต้องขึ้นเป็นปุ่มปิด
 * ไม่ใช่พยายามโหลด SDK ของ Facebook (ซึ่งจะยิงออกเน็ตจริงระหว่างเทสต์)
 */

describe('FacebookSignInButton (ยังไม่ตั้งค่า app id)', () => {
  test('แสดงปุ่มปิดที่บอกว่ายังไม่เปิดใช้งาน', () => {
    render(<FacebookSignInButton onAccessToken={vi.fn()} />);

    const btn = screen.getByRole('button', { name: /ยังไม่เปิดใช้งาน/ });
    expect(btn).toBeDisabled();
  });

  test('ไม่โหลดสคริปต์ของ Facebook และไม่เรียก onAccessToken เอง', async () => {
    const onAccessToken = vi.fn();
    render(<FacebookSignInButton onAccessToken={onAccessToken} />);

    await userEvent.click(screen.getByRole('button', { name: /ยังไม่เปิดใช้งาน/ }));

    expect(onAccessToken).not.toHaveBeenCalled();
    expect(
      document.querySelector('script[src*="connect.facebook.net"]')
    ).toBeNull();
  });
});
