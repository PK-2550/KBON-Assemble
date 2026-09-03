import React, { useEffect, useRef } from 'react';
import {
  SOCIAL_BUTTON_WIDTH,
  socialButtonBase,
  socialButtonDisabled,
} from './socialAuthStyles';

/**
 * ปุ่มเข้าสู่ระบบด้วย Google (Google Identity Services, flow แบบ ID token)
 *
 * โหลดสคริปต์ GIS แล้วให้ Google เรนเดอร์ปุ่มจริงลงในกล่องนี้ เมื่อผู้ใช้ยืนยัน
 * Google จะเรียก callback พร้อม credential (ID token JWT) ซึ่งเราส่งต่อขึ้นไป
 * ให้ผู้เรียกเอาไป verify ที่ server
 *
 * ถ้ายังไม่ได้ตั้ง VITE_GOOGLE_CLIENT_ID จะแสดงปุ่มปิดไว้แทน เพื่อให้ตอน dev
 * ที่ยังไม่ได้ตั้งค่า OAuth หน้าจอยังใช้งานส่วนอื่นได้ตามปกติ
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleIdConfig {
  client_id: string;
  callback: (res: { credential?: string }) => void;
}
interface GoogleButtonOptions {
  type?: string;
  theme?: string;
  size?: string;
  text?: string;
  shape?: string;
  width?: number;
  locale?: string;
}
interface GoogleAccountsId {
  initialize: (config: GoogleIdConfig) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

let gisLoadPromise: Promise<void> | null = null;

/** โหลดสคริปต์ GIS ครั้งเดียว ครั้งถัดไปคืน promise เดิม */
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('โหลดสคริปต์ Google ไม่สำเร็จ')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('โหลดสคริปต์ Google ไม่สำเร็จ'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onCredential,
  onError,
  disabled,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // เก็บ callback ล่าสุดไว้ใน ref เพื่อไม่ต้อง re-init GIS ทุกครั้งที่ prop เปลี่ยน
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const id = window.google?.accounts?.id;
        if (!id) return;
        id.initialize({
          client_id: CLIENT_ID,
          callback: (res) => {
            if (res.credential) onCredentialRef.current(res.credential);
            else onErrorRef.current?.('ไม่ได้รับข้อมูลยืนยันตัวตนจาก Google');
          },
        });
        containerRef.current.innerHTML = '';
        id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: SOCIAL_BUTTON_WIDTH,
          locale: 'th',
        });
      })
      .catch((err) => {
        if (!cancelled) onErrorRef.current?.(err instanceof Error ? err.message : 'โหลด Google ไม่สำเร็จ');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ยังไม่ตั้งค่า OAuth -- คงปุ่มปิดเดิมไว้
  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="ยังไม่เปิดใช้งานในระบบใหม่"
        style={{ width: SOCIAL_BUTTON_WIDTH }}
        className={`${socialButtonBase} ${socialButtonDisabled}`}
      >
        <GoogleIcon />
        <span>ลงชื่อเข้าใช้ด้วย Google (ยังไม่เปิดใช้งาน)</span>
      </button>
    );
  }

  return (
    <div
      style={{ width: SOCIAL_BUTTON_WIDTH }}
      className={`flex justify-center ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      aria-busy={disabled}
    >
      <div ref={containerRef} />
    </div>
  );
};

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);
