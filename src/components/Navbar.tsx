import React, { useState, useRef, useEffect } from 'react';
import { Sprout, User, Radio, Settings, LogOut, MoreVertical } from 'lucide-react';
import { UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: 'farms' | 'dashboard';
  onTabChange: (tab: 'farms' | 'dashboard') => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenNfcScanner: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentRole,
  onRoleChange,
  onOpenNfcScanner,
}) => {
  // isAdmin มาจาก context ซึ่งดูจาก role ที่ server ส่งมาเท่านั้น
  // ของเดิมเช็คเพิ่มว่า username เป็น 'admin' ด้วย แปลว่าใครก็ตามที่สมัคร
  // ด้วยชื่อ "admin" จะได้เห็นเมนูแอดมินทันที จึงเอาเงื่อนไขนั้นออก
  const { currentUser, signOutUser, isAdmin } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="bg-[#07190f]/95 border-b border-[#1c442c] px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between shrink-0 sticky top-0 z-40 backdrop-blur-md shadow-lg">
      {/* Left Column: Spacer or Desktop Tab Link */}
      <div className="flex items-center gap-2 w-1/4 sm:w-1/3 justify-start">
        {/* Desktop Tabs */}
        <div className="hidden md:flex items-center gap-1 text-xs font-bold text-[#83A893]">
          <button
            onClick={() => onTabChange('farms')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'farms'
                ? 'bg-[#E5A93C] text-[#1c1202] font-extrabold shadow-sm'
                : 'hover:bg-[#0e2619] text-[#83A893] hover:text-[#f3f6f4]'
            }`}
          >
            รายชื่อฟาร์ม
          </button>
          <button
            onClick={() => onTabChange('dashboard')}
            className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#E5A93C] text-[#1c1202] font-extrabold shadow-sm'
                : 'hover:bg-[#0e2619] text-[#83A893] hover:text-[#f3f6f4]'
            }`}
          >
            แดชบอร์ด
          </button>
        </div>
      </div>

      {/* Center Column: Centered Website Name & Brand Logo */}
      <div className="flex items-center justify-center gap-2 cursor-pointer select-none" onClick={() => onTabChange('farms')}>
        {/* Gold & Emerald Logo Badge */}
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-[#E5A93C] to-[#d89727] rounded-xl flex items-center justify-center text-[#1c1202] font-black text-sm sm:text-base tracking-tighter shadow-md">
          dt
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-base sm:text-lg font-black tracking-tight text-white lowercase font-sans">
            duritrack
          </span>
          <span className="text-[8px] sm:text-[9px] text-[#E5A93C] font-semibold tracking-widest uppercase -mt-0.5">
            luxury origin
          </span>
        </div>
      </div>

      {/* Right Column: Profile Avatar / 3 Dots menu */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 w-1/4 sm:w-1/3" ref={profileMenuRef}>
        {/* Profile Avatar Trigger */}
        <button
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className="flex items-center gap-1.5 p-1 sm:p-1.5 rounded-xl hover:bg-[#0e2619] transition-colors cursor-pointer border border-[#1c442c]"
          title="บัญชีผู้ใช้และเมนูตั้งค่า"
        >
          {currentUser?.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt={currentUser.displayName || 'User'}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#E5A93C] object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#143523] border border-[#E5A93C]/50 text-[#E5A93C] font-bold text-xs flex items-center justify-center shrink-0">
              {currentUser?.displayName?.charAt(0) || currentUser?.username?.charAt(0) || <User className="w-4 h-4" />}
            </div>
          )}
          <MoreVertical className="w-4 h-4 text-[#83A893]" />
        </button>

        {/* Profile Dropdown Menu with Sign Out inside */}
        {isProfileMenuOpen && (
          <div className="absolute right-3 sm:right-6 top-13 sm:top-15 w-64 bg-[#07190f] text-[#f3f6f4] rounded-2xl shadow-2xl border border-[#1c442c] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            {/* User Info Header */}
            <div className="px-4 py-3 border-b border-[#1c442c]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#143523] border border-[#E5A93C]/50 text-[#E5A93C] font-bold text-sm flex items-center justify-center shrink-0">
                  {currentUser?.displayName?.charAt(0) || currentUser?.username?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">
                    {currentUser?.displayName || currentUser?.username || 'ผู้ใช้งาน'}
                  </div>
                  <div className="text-[11px] text-[#83A893] truncate">
                    {currentUser?.email || 'เข้าสู่ระบบแล้ว'}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[10px] text-[#83A893] font-medium">สิทธิ์การใช้งาน:</span>
                {isAdmin ? (
                  <span className="text-[10px] font-bold bg-[#E5A93C]/20 text-[#F5D280] border border-[#E5A93C]/40 px-2 py-0.5 rounded-full">
                    👑 ผู้ดูแลระบบ (Admin)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-[#143523] text-[#4ADE80] border border-[#225538] px-2 py-0.5 rounded-full">
                    🌱 ผู้บริโภคทั่วไป
                  </span>
                )}
              </div>
            </div>

            {/* Role Switcher (Visible to Admin) */}
            {isAdmin && (
              <div className="px-3 py-2 border-b border-[#1c442c]">
                <span className="text-[10px] font-bold text-[#83A893] uppercase tracking-wider block mb-1.5 px-1">
                  สลับโหมดการทำงาน
                </span>
                <div className="grid grid-cols-2 gap-1 bg-[#0e2619] p-1 rounded-xl border border-[#1c442c]">
                  <button
                    onClick={() => {
                      onRoleChange('user');
                      setIsProfileMenuOpen(false);
                    }}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      currentRole === 'user'
                        ? 'bg-[#E5A93C] text-[#1c1202] shadow-xs'
                        : 'text-[#83A893] hover:text-white'
                    }`}
                  >
                    <User className="w-3 h-3" />
                    <span>ผู้บริโภค</span>
                  </button>
                  <button
                    onClick={() => {
                      onRoleChange('admin');
                      setIsProfileMenuOpen(false);
                    }}
                    className={`py-1.5 px-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      currentRole === 'admin'
                        ? 'bg-[#E5A93C] text-[#1c1202] shadow-xs'
                        : 'text-[#83A893] hover:text-white'
                    }`}
                  >
                    <Settings className="w-3 h-3" />
                    <span>แอดมิน</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="py-1">
              <button
                onClick={() => {
                  onOpenNfcScanner();
                  setIsProfileMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-xs font-semibold text-[#83A893] hover:bg-[#0e2619] hover:text-[#E5A93C] flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Radio className="w-4 h-4 text-[#E5A93C]" />
                <span>สแกน NFC ผลทุเรียน</span>
              </button>

              <button
                onClick={() => {
                  onTabChange('dashboard');
                  setIsProfileMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-xs font-semibold text-[#83A893] hover:bg-[#0e2619] hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Sprout className="w-4 h-4 text-[#4ADE80]" />
                <span>แดชบอร์ดภาพรวมการผลิต</span>
              </button>
            </div>

            {/* Logout Button */}
            <div className="pt-1 border-t border-[#1c442c]">
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  signOutUser();
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>ออกจากระบบ (Sign Out)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
