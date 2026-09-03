import React from 'react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { FacebookSignInButton } from './FacebookSignInButton';

/**
 * แถวปุ่มเข้าสู่ระบบด้วยบริการภายนอก
 *
 * มีไว้เพื่อให้ "การจัดวาง" อยู่ที่เดียว ตัวปุ่มแต่ละอันรู้แค่เรื่องของบริการ
 * ตัวเอง ส่วนความกว้าง ระยะห่าง และลำดับ เป็นเรื่องของแถว ไม่ใช่ของปุ่ม
 *
 * เรียงจากบนลงล่าง ไม่ใช่วางข้างกัน เพราะปุ่มของ Google เรนเดอร์เองด้วยความกว้าง
 * เป็น px ตายตัว บีบให้แคบลงตามจอไม่ได้ ถ้าวางสองปุ่มข้างกันบนมือถือจะล้นทันที
 */

interface SocialAuthButtonsProps {
  onGoogleCredential: (credential: string) => void;
  onFacebookAccessToken: (accessToken: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  onGoogleCredential,
  onFacebookAccessToken,
  onError,
  disabled,
}) => (
  <div className="flex flex-col items-center gap-2">
    <GoogleSignInButton
      onCredential={onGoogleCredential}
      onError={onError}
      disabled={disabled}
    />
    <FacebookSignInButton
      onAccessToken={onFacebookAccessToken}
      onError={onError}
      disabled={disabled}
    />
  </div>
);
