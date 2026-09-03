import React, { useRef, useState } from 'react';
import {
  SOCIAL_BUTTON_WIDTH,
  socialButtonBase,
  socialButtonDisabled,
  socialButtonEnabled,
} from './socialAuthStyles';

/**
 * ปุ่มเข้าสู่ระบบด้วย Facebook (Facebook Login for the Web)
 *
 * ต่างจาก Google ตรงที่ฝั่งเว็บของ Facebook ไม่มี ID token ให้ สิ่งที่ได้จาก
 * SDK คือ access token ธรรมดา ซึ่งเราส่งต่อขึ้นไปให้ server เป็นคนถาม Graph API
 * ว่า token นี้ใช้ได้จริงและออกให้แอปของเราหรือเปล่า (ดู server/oauth/facebook.ts)
 *
 * SDK ถูกโหลดตอน "กดปุ่มครั้งแรก" ไม่ใช่ตอนเปิดหน้า เพราะสคริปต์ของ Facebook
 * ตั้งคุกกี้และติดตามผู้ใช้ทันทีที่โหลด คนที่เข้าด้วยชื่อผู้ใช้งานตามปกติจึงไม่
 * ควรต้องโดนไปด้วยทั้งที่ไม่ได้จะใช้ปุ่มนี้
 *
 * ถ้ายังไม่ได้ตั้ง VITE_FACEBOOK_APP_ID จะแสดงปุ่มปิดไว้แทน เพื่อให้ตอน dev
 * ที่ยังไม่ได้ตั้งค่า OAuth หน้าจอยังใช้งานส่วนอื่นได้ตามปกติ
 */

const APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined;
const SDK_SRC = 'https://connect.facebook.net/th_TH/sdk.js';

/**
 * เวอร์ชัน Graph API ที่ฝั่งเบราว์เซอร์ใช้
 *
 * ควรขยับให้ตรงกับ GRAPH_VERSION ใน server/oauth/facebook.ts เวลาอัปเกรด
 */
const GRAPH_VERSION = 'v21.0';

interface FbAuthResponse {
  accessToken?: string;
}
interface FbLoginResponse {
  status?: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: FbAuthResponse | null;
}
interface FbSdk {
  init: (options: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
  login: (
    callback: (response: FbLoginResponse) => void,
    options?: { scope?: string }
  ) => void;
}
declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

let sdkLoadPromise: Promise<FbSdk> | null = null;

/** โหลดสคริปต์ SDK ครั้งเดียว ครั้งถัดไปคืน promise เดิม */
function loadFacebookSdk(appId: string): Promise<FbSdk> {
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<FbSdk>((resolve, reject) => {
    const ready = () => {
      const fb = window.FB;
      if (!fb) {
        reject(new Error('โหลดสคริปต์ Facebook ไม่สำเร็จ'));
        return;
      }
      // cookie: false -- session ของระบบเราออกเองจาก server อยู่แล้ว
      // ไม่ต้องให้ Facebook ตั้งคุกกี้ของตัวเองไว้ในโดเมนเราอีกชุด
      fb.init({ appId, cookie: false, xfbml: false, version: GRAPH_VERSION });
      resolve(fb);
    };

    if (window.FB) {
      ready();
      return;
    }

    // SDK เรียก fbAsyncInit ให้เองเมื่อพร้อมใช้งาน การรอแค่ event load ของ
    // script ไม่พอ เพราะตอนนั้น window.FB อาจยังตั้งไม่เสร็จ
    window.fbAsyncInit = ready;

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener('error', () =>
        reject(new Error('โหลดสคริปต์ Facebook ไม่สำเร็จ'))
      );
      return;
    }

    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('โหลดสคริปต์ Facebook ไม่สำเร็จ'));
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

interface FacebookSignInButtonProps {
  onAccessToken: (accessToken: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export const FacebookSignInButton: React.FC<FacebookSignInButtonProps> = ({
  onAccessToken,
  onError,
  disabled,
}) => {
  const [busy, setBusy] = useState(false);
  // กันกดซ้ำระหว่างที่หน้าต่างของ Facebook เปิดค้างอยู่
  const pendingRef = useRef(false);

  const handleClick = async () => {
    if (pendingRef.current || !APP_ID) return;
    pendingRef.current = true;
    setBusy(true);

    try {
      const fb = await loadFacebookSdk(APP_ID);
      fb.login(
        (response) => {
          pendingRef.current = false;
          setBusy(false);

          const token = response.authResponse?.accessToken;
          if (token) {
            onAccessToken(token);
            return;
          }
          if (response.status === 'not_authorized') {
            onError?.('ยังไม่ได้อนุญาตให้แอปเข้าถึงบัญชี Facebook นี้');
          }
          // status = unknown คือผู้ใช้ปิดหน้าต่างเอง ไม่ใช่ข้อผิดพลาด จึงเงียบไว้
        },
        { scope: 'public_profile,email' }
      );
    } catch (err) {
      pendingRef.current = false;
      setBusy(false);
      onError?.(err instanceof Error ? err.message : 'โหลด Facebook ไม่สำเร็จ');
    }
  };

  // ยังไม่ตั้งค่า OAuth -- แสดงปุ่มปิดที่ทรงเดียวกัน แถวปุ่มจึงไม่เบี้ยว
  if (!APP_ID) {
    return (
      <button
        type="button"
        disabled
        title="ยังไม่เปิดใช้งานในระบบใหม่"
        style={{ width: SOCIAL_BUTTON_WIDTH }}
        className={`${socialButtonBase} ${socialButtonDisabled}`}
      >
        <FacebookIcon />
        <span>ลงชื่อเข้าใช้ด้วย Facebook (ยังไม่เปิดใช้งาน)</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      aria-busy={busy}
      style={{ width: SOCIAL_BUTTON_WIDTH }}
      className={`${socialButtonBase} ${socialButtonEnabled}`}
    >
      {busy ? (
        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <FacebookIcon />
      )}
      <span>ลงชื่อเข้าใช้ด้วย Facebook</span>
    </button>
  );
};

/**
 * ตรา f ของ Facebook
 *
 * วางบนวงกลมสีแบรนด์ ตามแนวทางการใช้โลโก้บนพื้นหลังสีเข้ม
 */
const FacebookIcon: React.FC = () => (
  <span className="w-5 h-5 shrink-0 rounded-full bg-[#1877F2] flex items-center justify-center">
    <svg className="w-3 h-3" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#ffffff"
        d="M15.12 8.44h-2.2V7.02c0-.6.4-.74.68-.74h1.48V4.02L13 4.01c-2.3 0-2.82 1.72-2.82 2.82v1.61H8.7v2.33h1.48V17h2.74v-6.23h2l.2-2.33z"
      />
    </svg>
  </span>
);
