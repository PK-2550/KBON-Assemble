import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppUserProfile,
  fetchCurrentUser,
  loginWithUsername as apiLogin,
  registerWithUsername as apiRegister,
  logout as apiLogout,
  getPreferredRole,
  setPreferredRole,
} from '../services/userService';
import { UserRole } from '../types';

interface AuthContextType {
  currentUser: AppUserProfile | null;
  userProfile: AppUserProfile | null;
  loading: boolean;
  /** โหมดที่กำลังดูอยู่ -- ไม่ใช่สิทธิ์จริง สิทธิ์จริงอยู่ที่ currentUser.role */
  roleMode: UserRole;
  /** เป็นแอดมินจริงหรือไม่ ตัดสินจาก role ที่ server ส่งมาเท่านั้น */
  isAdmin: boolean;
  /** ติดต่อ server ไม่ได้ -- คนละเรื่องกับการยังไม่ได้ล็อกอิน */
  connectionError: string | null;
  retryConnection: () => void;
  /**
   * ดึงโปรไฟล์ล่าสุดจาก server ใหม่
   *
   * ใช้แทน onSnapshot ของ Firestore ที่เดิมคอยฟังการเปลี่ยน role แบบ realtime
   * (เช่นตอนแอดมินอนุมัติให้ผู้ใช้เป็นผู้จัดการสวน)
   * ให้เรียกหลังทำรายการที่อาจเปลี่ยนสิทธิ์ของตัวเอง
   */
  refreshUser: () => Promise<void>;
  signInWithUsername: (username: string, pass: string) => Promise<AppUserProfile>;
  registerWithUsername: (username: string, pass: string) => Promise<AppUserProfile>;
  signOutUser: () => Promise<void>;
  setRoleMode: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleMode, setRoleModeState] = useState<UserRole>('user');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const isAdmin = currentUser?.role === 'admin';

  /**
   * ตอนเปิดแอปต้องถาม server ว่ามี session อยู่ไหม
   *
   * ของเดิมอ่านโปรไฟล์จาก localStorage ได้ทันทีโดยไม่ต้องถามใคร ซึ่งเร็วกว่า
   * แต่แปลว่าใครก็แก้ localStorage ให้ตัวเองเป็น admin ได้
   * ตอนนี้ token อยู่ใน httpOnly cookie ที่ JavaScript อ่านไม่ได้
   * จึงต้องให้ server เป็นคนบอกว่าเราเป็นใคร
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchCurrentUser()
      .then((profile) => {
        if (cancelled) return;
        setCurrentUser(profile);
        setConnectionError(null);
        // คืนค่าโหมดที่เคยเลือกไว้ แต่เฉพาะคนที่เป็นแอดมินจริงเท่านั้น
        setRoleModeState(profile?.role === 'admin' ? getPreferredRole('user') : 'user');
      })
      .catch((err) => {
        if (cancelled) return;
        setCurrentUser(null);
        setConnectionError(
          err instanceof Error ? err.message : 'ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const retryConnection = () => setRetryCount((n) => n + 1);

  const refreshUser = async () => {
    try {
      const profile = await fetchCurrentUser();
      setCurrentUser(profile);
      if (profile?.role !== 'admin') setRoleModeState('user');
    } catch (err) {
      // ดึงไม่สำเร็จก็ใช้โปรไฟล์เดิมต่อไป ไม่ต้องเตะผู้ใช้ออกจากระบบ
      console.warn('ดึงโปรไฟล์ล่าสุดไม่สำเร็จ:', err);
    }
  };

  const signInWithUsername = async (username: string, pass: string) => {
    const profile = await apiLogin(username, pass);
    setCurrentUser(profile);
    setRoleModeState(profile.role === 'admin' ? getPreferredRole('user') : 'user');
    return profile;
  };

  const registerWithUsername = async (username: string, pass: string) => {
    // ไม่ตั้ง currentUser เพื่อให้ผู้ใช้ยังอยู่ที่หน้าเข้าสู่ระบบ (พฤติกรรมเดิมของแอป)
    return apiRegister(username, pass);
  };

  const signOutUser = async () => {
    try {
      await apiLogout();
    } finally {
      setCurrentUser(null);
      setRoleModeState('user');
    }
  };

  /**
   * สลับโหมดการแสดงผล -- ไม่ได้เปลี่ยนสิทธิ์
   *
   * ของเดิมฟังก์ชันนี้เขียน role ลง Firestore ตรง ๆ จากเบราว์เซอร์
   * ผู้ใช้ทั่วไปจึงตั้งตัวเองเป็นแอดมินได้ ตอนนี้เปลี่ยนได้แค่มุมมอง
   * ส่วนสิทธิ์จริงต้องให้คนดูแลระบบรันคำสั่ง npm run make:admin
   */
  const setRoleMode = (role: UserRole) => {
    if (!isAdmin && role === 'admin') return;
    setRoleModeState(role);
    setPreferredRole(role);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile: currentUser,
        loading,
        roleMode,
        isAdmin,
        connectionError,
        retryConnection,
        refreshUser,
        signInWithUsername,
        registerWithUsername,
        signOutUser,
        setRoleMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
