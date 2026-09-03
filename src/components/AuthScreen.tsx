import React, { useState } from 'react';
import {
  Trees,
  ShieldCheck,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validatePasswordSecurity, formatAuthErrorMessage } from '../services/userService';
import { SocialAuthButtons } from './SocialAuthButtons';

interface AuthScreenProps {
  onGuestAccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onGuestAccess }) => {
  const { signInWithUsername, signInWithGoogle, signInWithFacebook, registerWithUsername } =
    useAuth();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Live password security analysis
  const passwordSecurity = validatePasswordSecurity(password);

  const getStrengthColor = (score: number) => {
    if (score <= 1) return 'bg-red-500 text-red-600';
    if (score === 2) return 'bg-amber-500 text-amber-600';
    if (score === 3) return 'bg-blue-500 text-blue-600';
    return 'bg-emerald-500 text-emerald-600';
  };

  const getStrengthLabel = (score: number) => {
    if (score <= 1) return 'รหัสผ่านคาดเดาง่าย (ความปลอดภัยต่ำ)';
    if (score === 2) return 'รหัสผ่านปานกลาง';
    if (score === 3) return 'รหัสผ่านปลอดภัย';
    return 'รหัสผ่านปลอดภัยสูงมาก (Strong)';
  };


  /**
   * เข้าสู่ระบบด้วยบริการภายนอก
   *
   * ทั้งสองทางทำเหมือนกันหมดหลังได้ token มาแล้ว ต่างกันแค่ว่าเรียกฟังก์ชันไหน
   * สำเร็จแล้ว AuthProvider ตั้ง currentUser ให้ แอปจะพาออกจากหน้านี้เอง
   */
  const runSocialSignIn = async (signIn: () => Promise<unknown>) => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      await signIn();
    } catch (err) {
      setErrorMsg(formatAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUser = username.trim();
    if (!cleanUser) {
      setErrorMsg('กรุณากรอกชื่อผู้ใช้งาน (Username)');
      return;
    }
    if (cleanUser.length < 3) {
      setErrorMsg('ชื่อผู้ใช้งานต้องมีความยาวอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('กรุณากรอกรหัสผ่าน (Password)');
      return;
    }

    if (isRegisterMode) {
      if (password.length < 6) {
        setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรขึ้นไป');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }
      if (!agreedTerms) {
        setErrorMsg('กรุณายอมรับข้อกำหนดการใช้งานและความปลอดภัย');
        return;
      }

      setIsSubmitting(true);
      try {
        await registerWithUsername(cleanUser, password);
        setSuccessMsg(`สร้างบัญชี "${cleanUser}" สำเร็จเรียบร้อย! กรุณาเข้าสู่ระบบ`);
        setPassword('');
        setConfirmPassword('');
        // Switch to login mode
        setIsRegisterMode(false);
      } catch (err: any) {
        setErrorMsg(formatAuthErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Login Mode
      setIsSubmitting(true);
      try {
        await signInWithUsername(cleanUser, password);
      } catch (err: any) {
        setErrorMsg(formatAuthErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-full bg-well flex flex-col items-center justify-between p-3 sm:p-4 text-white font-sans overflow-hidden select-none relative">
      {/* Background Subtle Gold/Green Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#0e311f]/40 rounded-full blur-2xl pointer-events-none" />

      {/* Top Brand Header */}
      <div className="w-full max-w-xs sm:max-w-sm pt-1 text-center relative z-10">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-panel border border-[#1e5236] text-gold mb-1 shadow-lg">
          <Trees className="w-5 h-5" />
        </div>
        <div className="flex items-center justify-center gap-1">
          <span className="font-mono text-gold text-[9px] font-bold tracking-widest uppercase bg-panel px-2.5 py-0.5 rounded-full border border-line-soft">
            DURITRACK PRO
          </span>
        </div>
        <h1 className="text-sm sm:text-base font-bold text-white tracking-tight mt-1 leading-snug">
          ระบบตรวจสอบย้อนกลับทุเรียนไทย
        </h1>
        <p className="text-[10px] text-fg-3 mt-0.5">
          พาสปอร์ตต้นไม้และยืนยันผลผลิตผ่าน NFC
        </p>
      </div>

      {/* Main Glass / Luxury Dark Card */}
      <div className="w-full max-w-xs sm:max-w-sm relative z-10 bg-panel/95 border border-line-soft backdrop-blur-md rounded-2xl p-3.5 shadow-2xl text-white">
        {/* เข้าสู่ระบบด้วยบริการภายนอก -- Google (ID token) และ Facebook (access token)
            ปุ่มไหนยังไม่ได้ตั้งค่า OAuth จะขึ้นเป็นปุ่มปิดในทรงเดียวกัน */}
        <SocialAuthButtons
          onGoogleCredential={(credential) => runSocialSignIn(() => signInWithGoogle(credential))}
          onFacebookAccessToken={(token) => runSocialSignIn(() => signInWithFacebook(token))}
          onError={(msg) => setErrorMsg(msg)}
          disabled={isSubmitting}
        />

        {/* Divider */}
        <div className="relative my-2.5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line-soft" />
          </div>
          <div className="relative flex justify-center text-[9px] uppercase tracking-wider text-fg-3 font-semibold">
            <span className="bg-panel px-2">หรือใช้ชื่อผู้ใช้งาน</span>
          </div>
        </div>

        {/* Mode Switcher: Sign In vs Register */}
        <div className="grid grid-cols-2 p-0.5 bg-well rounded-lg mb-2 text-[10px] font-bold border border-line-soft">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(false);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-1 rounded-md transition-all cursor-pointer ${
              !isRegisterMode
                ? 'bg-gold text-gold-ink-2 shadow-xs'
                : 'text-fg-3 hover:text-white'
            }`}
          >
            เข้าสู่ระบบ (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(true);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`py-1 rounded-md transition-all cursor-pointer ${
              isRegisterMode
                ? 'bg-gold text-gold-ink-2 shadow-xs'
                : 'text-fg-3 hover:text-white'
            }`}
          >
            สมัครสมาชิก (Register)
          </button>
        </div>

        {/* Error & Success Alerts */}
        {errorMsg && (
          <div className="mb-2.5 p-2 bg-red-950/90 border border-red-500/80 rounded-xl text-red-200 text-xs flex items-center gap-2 shadow-lg shadow-red-950/50 animate-bounce-short">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-medium leading-tight">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-2.5 p-2 bg-[#0e311f] border border-[#22c55e] rounded-xl text-emerald-300 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#22c55e]" />
            <span className="font-medium leading-tight">{successMsg}</span>
          </div>
        )}

        {/* Username / Password Form */}
        <form onSubmit={handleSubmit} className="space-y-1.5">
          {/* Username Field */}
          <div>
            <label className="block text-[10px] font-bold text-fg-3 mb-0.5">
              ชื่อผู้ใช้งาน (Username)
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-fg-4 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="เช่น somchai"
                className="w-full pl-8 pr-2.5 py-1.5 bg-well border border-line-soft rounded-lg text-xs text-white placeholder-fg-4 focus:border-gold focus:bg-well outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-[10px] font-bold text-fg-3 mb-0.5">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-fg-4 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-8 pr-8 py-1.5 bg-well border border-line-soft rounded-lg text-xs text-white placeholder-fg-4 focus:border-gold focus:bg-well outline-hidden transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-4 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Password Strength Indicator (in Register Mode) */}
            {isRegisterMode && password.length > 0 && (
              <div className="mt-1 space-y-0.5 animate-in fade-in">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-fg-3">ระดับความปลอดภัย:</span>
                  <span className={`font-bold ${getStrengthColor(passwordSecurity.score).split(' ')[1]}`}>
                    {getStrengthLabel(passwordSecurity.score)}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-well h-1 rounded-full overflow-hidden flex gap-1 border border-line-soft">
                  <div className={`h-full flex-1 rounded-full ${passwordSecurity.score >= 1 ? 'bg-red-500' : 'bg-[#0e311f]'}`} />
                  <div className={`h-full flex-1 rounded-full ${passwordSecurity.score >= 2 ? 'bg-amber-500' : 'bg-[#0e311f]'}`} />
                  <div className={`h-full flex-1 rounded-full ${passwordSecurity.score >= 3 ? 'bg-blue-500' : 'bg-[#0e311f]'}`} />
                  <div className={`h-full flex-1 rounded-full ${passwordSecurity.score >= 4 ? 'bg-gold' : 'bg-[#0e311f]'}`} />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password (Only in Register Mode) */}
          {isRegisterMode && (
            <div>
              <label className="block text-[10px] font-bold text-fg-3 mb-0.5">
                ยืนยันรหัสผ่าน
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-fg-4 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-8 pr-2.5 py-1.5 bg-well border border-line-soft rounded-lg text-xs text-white placeholder-fg-4 focus:border-gold focus:bg-well outline-hidden transition-all"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[9px] text-red-400 mt-0.5">รหัสผ่านไม่ตรงกัน</p>
              )}
            </div>
          )}

          {/* Terms checkbox in Register mode */}
          {isRegisterMode && (
            <label className="flex items-start gap-1.5 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="rounded-sm border-line-soft bg-well text-gold focus:ring-gold mt-0.5"
              />
              <span className="text-[9px] text-fg-3 leading-tight">
                ยอมรับข้อกำหนดและความเป็นส่วนตัว DuriTrack
              </span>
            </label>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-gold hover:bg-gold-hi active:scale-[0.99] text-gold-ink-2 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50 mt-1"
          >
            {isSubmitting ? (
              <div className="w-3 h-3 border-2 border-gold-ink-2/40 border-t-[#241603] rounded-full animate-spin" />
            ) : (
              <>
                <span>{isRegisterMode ? 'ยืนยันสร้างบัญชี' : 'เข้าสู่ระบบ'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Bottom Actions: Guest Preview & Security */}
      <div className="w-full max-w-xs sm:max-w-sm pb-1 text-center space-y-1 relative z-10">
        {onGuestAccess && (
          <button
            type="button"
            onClick={() => onGuestAccess()}
            className="text-fg-3 hover:text-gold text-[10px] font-semibold underline underline-offset-2 transition-colors cursor-pointer"
          >
            เข้าชมตัวอย่างระบบชั่วคราว (Guest Preview)
          </button>
        )}

        <div className="flex items-center justify-center gap-1 text-fg-4 text-[9px]">
          <ShieldCheck className="w-3 h-3 text-gold" />
          <span>เข้ารหัสรหัสผ่านด้วย bcrypt · PostgreSQL</span>
        </div>
      </div>
    </div>
  );
};
