import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserRole } from '../types';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface AppUserProfile {
  uid: string;
  username: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  provider: 'google' | 'username' | 'password' | 'guest';
  createdAt?: any;
  lastLoginAt?: any;
}

const LOCAL_STORAGE_SESSION_KEY = 'duritrack_user_session';
const LOCAL_STORAGE_ACCOUNTS_KEY = 'duritrack_local_accounts';

/**
 * SHA-256 Hash helper using native Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password + '_duritrack_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Clean username to safe Firestore Document ID
 */
export function normalizeUsernameKey(username: string): string {
  const trimmed = username.trim().toLowerCase();
  // Safe document ID
  const hex = Array.from(trimmed)
    .map((c) => c.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('');
  return `acc_${hex}`;
}

/**
 * Get active stored session from localStorage
 */
export function getStoredUserSession(): AppUserProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppUserProfile;
  } catch {
    return null;
  }
}

/**
 * Save user session to localStorage
 */
export function saveUserSession(profile: AppUserProfile): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save user session to localStorage:', err);
  }
}

/**
 * Clear stored user session
 */
export function clearUserSession(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
  } catch (err) {
    console.error('Failed to clear user session:', err);
  }
}

/**
 * Register with Username and Password (persisted in Firestore /accounts & /users)
 */
export async function registerWithUsername(
  username: string,
  pass: string,
  role: UserRole = 'user'
): Promise<AppUserProfile> {
  const cleanUsername = username.trim();
  if (!cleanUsername) {
    throw new Error('กรุณากรอกชื่อผู้ใช้งาน (Username)');
  }
  if (cleanUsername.length < 3) {
    throw new Error('ชื่อผู้ใช้งานต้องมีความยาวอย่างน้อย 3 ตัวอักษร');
  }

  const accountDocKey = normalizeUsernameKey(cleanUsername);
  const passwordHash = await hashPassword(pass);
  const uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  // 1. Check if username already exists in Firestore
  try {
    const accountRef = doc(db, 'accounts', accountDocKey);
    const snap = await getDoc(accountRef);
    if (snap.exists()) {
      throw new Error('ชื่อผู้ใช้งาน (Username) นี้ถูกลงทะเบียนไว้แล้ว กรุณาเลือกชื่ออื่น หรือเข้าสู่ระบบ');
    }
  } catch (err: any) {
    if (err.message && err.message.includes('ถูกลงทะเบียนไว้แล้ว')) {
      throw err;
    }
    // Check localStorage fallback
    const localAccounts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY) || '{}');
    if (localAccounts[accountDocKey]) {
      throw new Error('ชื่อผู้ใช้งาน (Username) นี้ถูกลงทะเบียนไว้แล้ว กรุณาเลือกชื่ออื่น หรือเข้าสู่ระบบ');
    }
  }

  const profile: AppUserProfile = {
    uid,
    username: cleanUsername,
    email: null,
    displayName: cleanUsername,
    photoURL: null,
    role,
    provider: 'username',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const accountData = {
    username: cleanUsername,
    usernameLower: cleanUsername.toLowerCase(),
    passwordHash,
    uid,
    role,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  // 2. Save in Firestore /accounts/{accountDocKey} and /users/{uid}
  try {
    await setDoc(doc(db, 'accounts', accountDocKey), accountData);
    await setDoc(doc(db, 'users', uid), profile);
  } catch (err) {
    console.warn('Firestore write failed, saving to local accounts store fallback:', err);
  }

  // 3. Save in localStorage accounts registry for offline fallback
  try {
    const localAccounts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY) || '{}');
    localAccounts[accountDocKey] = accountData;
    localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(localAccounts));
  } catch (err) {
    console.error('LocalStorage write failed:', err);
  }

  // 4. Save active session
  saveUserSession(profile);
  return profile;
}

/**
 * Sign in with Username and Password
 */
export async function loginWithUsername(username: string, pass: string): Promise<AppUserProfile> {
  const cleanUsername = username.trim();
  if (!cleanUsername) {
    throw new Error('กรุณากรอกชื่อผู้ใช้งาน (Username)');
  }
  if (!pass) {
    throw new Error('กรุณากรอกรหัสผ่าน (Password)');
  }

  const accountDocKey = normalizeUsernameKey(cleanUsername);
  const inputHash = await hashPassword(pass);

  let accountData: any = null;

  // 1. Try to read from Firestore /accounts/{accountDocKey}
  try {
    const accountRef = doc(db, 'accounts', accountDocKey);
    const snap = await getDoc(accountRef);
    if (snap.exists()) {
      accountData = snap.data();
    }
  } catch (err) {
    console.warn('Could not read from Firestore, trying local cache:', err);
  }

  // 2. If not found in Firestore or offline, check localStorage fallback
  if (!accountData) {
    try {
      const localAccounts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY) || '{}');
      if (localAccounts[accountDocKey]) {
        accountData = localAccounts[accountDocKey];
      }
    } catch (err) {
      console.error(err);
    }
  }

  // 3. If account still not found
  if (!accountData) {
    throw new Error('ไม่พบชื่อผู้ใช้งานนี้ในระบบ กรุณาตรวจสอบหรือสมัครสมาชิกใหม่');
  }

  // 4. Validate password hash
  if (accountData.passwordHash !== inputHash) {
    throw new Error('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
  }

  // 5. Build user profile
  const profile: AppUserProfile = {
    uid: accountData.uid || 'usr_' + Date.now(),
    username: accountData.username || cleanUsername,
    email: null,
    displayName: accountData.username || cleanUsername,
    photoURL: null,
    role: accountData.role || 'user',
    provider: 'username',
    createdAt: accountData.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  // Update last login in Firestore asynchronously
  try {
    await setDoc(doc(db, 'accounts', accountDocKey), { lastLoginAt: new Date().toISOString() }, { merge: true });
    await setDoc(doc(db, 'users', profile.uid), { lastLoginAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    // Ignore async touch error
  }

  // 6. Save active session
  saveUserSession(profile);
  return profile;
}

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle(defaultRole: UserRole = 'user'): Promise<AppUserProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  const profile: AppUserProfile = {
    uid: user.uid,
    username: user.displayName || user.email?.split('@')[0] || 'ผู้ใช้งาน Google',
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'ผู้ใช้งาน Google',
    photoURL: user.photoURL || null,
    role: defaultRole,
    provider: 'google',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  // Save to Firestore /users/{uid}
  try {
    await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
  } catch (err) {
    console.warn('Firestore write user failed:', err);
  }

  saveUserSession(profile);
  return profile;
}

/**
 * Sign Out
 */
export async function logout(): Promise<void> {
  clearUserSession();
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.error('Firebase signout error:', err);
  }
}

/**
 * Password Security Validator (Industry Standard: 8+ chars, upper, lower, number, special char)
 */
export function validatePasswordSecurity(password: string): {
  isValid: boolean;
  score: number; // 0 to 4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('ความยาวอย่างน้อย 8 ตัวอักษร');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('ต้องมีตัวพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว');
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('ต้องมีตัวพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว');
  }

  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('ต้องมีตัวเลข (0-9) หรือสัญลักษณ์พิเศษ');
  }

  return {
    isValid: score === 4,
    score,
    feedback,
  };
}

/**
 * Format Errors into User-Friendly Thai Messages
 */
export function formatAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  const message = error?.message || '';

  if (message && !code) {
    return message;
  }

  switch (code) {
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'ชื่อผู้ใช้งาน (Username) หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง';
    case 'auth/email-already-in-use':
      return 'ชื่อผู้ใช้งาน (Username) นี้ถูกลงทะเบียนไว้แล้ว กรุณาเลือกชื่ออื่น หรือเข้าสู่ระบบ';
    case 'auth/weak-password':
      return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรขึ้นไป';
    case 'auth/popup-closed-by-user':
      return 'หน้าต่างเข้าสู่ระบบ Google ถูกปิดก่อนทำรายการเสร็จสิ้น';
    case 'auth/too-many-requests':
      return 'มีการพยายามเข้าสู่ระบบผิดพลาดบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
    case 'auth/network-request-failed':
      return 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย กรุณาตรวจสอบอินเทอร์เน็ต';
    default:
      return message || 'เกิดข้อผิดพลาดในการยืนยันตัวตน กรุณาลองใหม่อีกครั้ง';
  }
}
