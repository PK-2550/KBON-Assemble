/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth 2.0 Client ID (Web) สำหรับปุ่มเข้าสู่ระบบด้วย Google ฝั่งเบราว์เซอร์ */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
