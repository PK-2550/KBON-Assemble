import React, { useState, useRef, useEffect } from 'react';
import {
  Sprout,
  User,
  Radio,
  Settings,
  LogOut,
  MoreVertical,
  ShieldCheck,
  Award,
  Sparkles,
  Building2,
  TreePine,
  ArrowRight,
  Clock,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { UserRole, DurianFarm, FarmRegistrationRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../services/authService';
import {
  subscribeAllFarmRequests,
  subscribeUserFarmRequest,
  getReadRequestIds,
  subscribeReadRequestIds,
} from '../services/farmRequestService';

interface NavbarProps {
  activeTab: 'farms' | 'dashboard';
  onTabChange: (tab: 'farms' | 'dashboard') => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onOpenNfcScanner: () => void;
  onOpenRegisterFarm?: (existingRequest?: FarmRegistrationRequest) => void;
  onOpenAdminApproval?: (tab?: 'manager_application' | 'farm_verification') => void;
  farms?: DurianFarm[];
  onSelectFarm?: (farm: DurianFarm) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  currentRole,
  onRoleChange,
  onOpenNfcScanner,
  onOpenRegisterFarm,
  onOpenAdminApproval,
  farms = [],
  onSelectFarm,
}) => {
  const { currentUser, signOutUser } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [allRequests, setAllRequests] = useState<FarmRegistrationRequest[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadRequestIds());
  const [userRequests, setUserRequests] = useState<FarmRegistrationRequest[]>([]);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = isUserAdmin(currentUser);
  const isManager = currentUser?.role === 'manager';

  // Find manager's farm if exists
  const managedFarm = isManager
    ? farms.find((f) => f.managerId === currentUser?.uid || f.id === currentUser?.managedFarmId)
    : null;

  // Listen to pending requests count and read IDs for Admin badge
  useEffect(() => {
    if (!isAdmin) return;
    const unsubReqs = subscribeAllFarmRequests((reqs) => {
      setAllRequests(reqs);
    });
    const unsubRead = subscribeReadRequestIds((ids) => {
      setReadIds(new Set(ids));
    });
    return () => {
      unsubReqs();
      unsubRead();
    };
  }, [isAdmin]);

  const isMgr = (r: FarmRegistrationRequest) =>
    r.requestCategory === 'manager_application' ||
    (!r.requestCategory && !r.targetFarmId && r.requestType !== 'update_farm' && Boolean(r.farmerIdCardNumber));

  // Count unread pending requests
  const pendingManagerCount = allRequests.filter(
    (r) => isMgr(r) && r.status === 'pending' && !readIds.has(r.id)
  ).length;

  const pendingFarmCount = allRequests.filter(
    (r) => !isMgr(r) && r.status === 'pending' && !readIds.has(r.id)
  ).length;

  const totalPendingCount = pendingManagerCount + pendingFarmCount;

  // Listen to user's own farm verification requests
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribe = subscribeUserFarmRequest(currentUser.uid, (reqs) => {
      setUserRequests(reqs);
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  const latestRequest = userRequests[0];

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
      <div
        className="flex items-center justify-center gap-2 cursor-pointer select-none"
        onClick={() => onTabChange('farms')}
      >
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

      {/* Right Column: Admin Hub Button + Profile Avatar */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 w-1/4 sm:w-1/3" ref={profileMenuRef}>
        {/* Admin Quick Approval Hub Button (Placed right beside Profile avatar as requested) */}
        {isAdmin && onOpenAdminApproval && (
          <button
            onClick={() => onOpenAdminApproval()}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-gradient-to-r from-[#E5A93C] to-[#c78b23] hover:from-[#f0b548] hover:to-[#d4992e] text-[#1c1202] rounded-xl text-xs font-black transition-transform active:scale-95 cursor-pointer shadow-md"
            title="ศูนย์อนุมัติและตรวจสอบมาตรฐานฟาร์ม (Admin Approval Hub)"
          >
            <ShieldCheck className="w-4 h-4 text-[#1c1202]" />
            <span className="text-[11px] sm:text-xs">ศูนย์อนุมัติ & ตรวจมาตรฐาน</span>
            {totalPendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-black animate-pulse">
                {totalPendingCount}
              </span>
            )}
          </button>
        )}

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

        {/* Profile Dropdown Menu */}
        {isProfileMenuOpen && (
          <div className="absolute right-3 sm:right-6 top-13 sm:top-15 w-72 bg-[#07190f] text-[#f3f6f4] rounded-2xl shadow-2xl border border-[#1c442c] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
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
                  <span className="text-[10px] font-bold bg-[#E5A93C]/20 text-[#F5D280] border border-[#E5A93C]/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    👑 ผู้ดูแลระบบ (Admin)
                  </span>
                ) : isManager ? (
                  <span className="text-[10px] font-bold bg-[#143523] text-[#4ADE80] border border-[#235b3a] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Award className="w-3 h-3 text-[#4ADE80]" />
                    ผู้จัดการสวน (Manager)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-[#143523] text-[#83A893] border border-[#1c442c] px-2 py-0.5 rounded-full">
                    🌱 ผู้บริโภคทั่วไป (User)
                  </span>
                )}
              </div>
            </div>

            {/* Manager Action: View My Farm (Only if the farm exists and has been approved/registered) */}
            {isManager && managedFarm && onSelectFarm && (
              <div className="p-2 border-b border-[#1c442c] space-y-1.5">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onSelectFarm(managedFarm);
                  }}
                  className="w-full p-2.5 bg-gradient-to-r from-[#0d2e1b] to-[#123e25] hover:from-[#133e24] hover:to-[#174e2e] border border-[#4ADE80]/40 rounded-xl text-left transition-all cursor-pointer group flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#4ADE80]">
                      <TreePine className="w-3.5 h-3.5" />
                      <span className="truncate">ดูสวนของฉัน: {managedFarm.name}</span>
                    </div>
                    <p className="text-[10px] text-[#83A893] mt-0.5 truncate">
                      จัดการภาพถ่ายบรรยากาศและบันทึกต้นทุเรียน
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#4ADE80] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}

            {/* Farm Owner Application / Verification for Managers without an active registered farm or standard Users */}
            {!isAdmin && (!managedFarm || latestRequest?.status === 'pending' || latestRequest?.status === 'needs_revision') && onOpenRegisterFarm && (
              <div className="p-2 border-b border-[#1c442c]">
                {latestRequest?.status === 'pending' ? (
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onOpenRegisterFarm(latestRequest);
                    }}
                    className="w-full p-2.5 bg-gradient-to-r from-[#1c1808] via-[#141206] to-[#1c1808] hover:from-[#24200b] hover:to-[#1a1708] border border-amber-500/40 rounded-xl text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                        <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span>สถานะคำขอ: รอผลพิจารณาจาก admin</span>
                      </div>
                      <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded-md font-bold">
                        Pending
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-300/70 mt-1 truncate">
                      ส่งข้อมูลสวน "{latestRequest.farmName || 'ข้อมูลสวน'}" แล้ว รอ Admin อนุมัติเพื่อเปิดสู่สาธารณะ
                    </p>
                  </button>
                ) : latestRequest?.status === 'needs_revision' ? (
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onOpenRegisterFarm(latestRequest);
                    }}
                    className="w-full p-2.5 bg-gradient-to-r from-[#1c0c0c] via-[#140808] to-[#1c0c0c] hover:from-[#241010] hover:to-[#1c0c0c] border border-rose-500/40 rounded-xl text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                        <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                        <span>คำขอต้องการการแก้ไข (Revision)</span>
                      </div>
                      <span className="text-[9px] bg-rose-500/30 text-rose-300 px-1.5 py-0.2 rounded-md font-bold">
                        แก้ไข
                      </span>
                    </div>
                    <p className="text-[10px] text-rose-300/80 mt-1 truncate">
                      {latestRequest.adminNotes || 'โปรดแก้ไขข้อมูลเอกสาร'}
                    </p>
                  </button>
                ) : isManager ? (
                  /* Manager who hasn't registered a farm yet */
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onOpenRegisterFarm();
                    }}
                    className="w-full p-2.5 bg-gradient-to-r from-[#0e2a1b] to-[#123824] hover:from-[#133924] hover:to-[#17462d] border border-[#E5A93C]/40 rounded-xl text-left transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-[#F5D280]">
                      <Sprout className="w-3.5 h-3.5 text-[#E5A93C] group-hover:scale-110 transition-transform" />
                      <span>ลงทะเบียนสวนทุเรียนของคุณ</span>
                    </div>
                    <p className="text-[10px] text-[#83A893] mt-0.5 leading-relaxed">
                      บันทึกข้อมูลแปลงสวน & ส่งให้ Admin ตรวจสอบเพื่อเปิดหน้าฟาร์ม
                    </p>
                  </button>
                ) : (
                  /* Standard User (ผู้บริโภคทั่วไป) */
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onOpenRegisterFarm();
                    }}
                    className="w-full p-2.5 bg-gradient-to-r from-[#0e2a1b] to-[#123824] hover:from-[#133924] hover:to-[#17462d] border border-[#E5A93C]/40 rounded-xl text-left transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-[#F5D280]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#E5A93C] group-hover:scale-110 transition-transform" />
                      <span>ยื่นเรื่องขอสิทธิ์ผู้จัดการสวน (Manager)</span>
                    </div>
                    <p className="text-[10px] text-[#83A893] mt-0.5 leading-relaxed">
                      ยื่นเอกสารเจ้าของสวนเพื่อรับสิทธิ์ Manager & เปิดหน้าฟาร์ม
                    </p>
                  </button>
                )}
              </div>
            )}

            {/* Admin Hub Shortcut Menu Item (Unified Hub) */}
            {isAdmin && onOpenAdminApproval && (
              <div className="py-1 border-b border-[#1c442c] space-y-0.5">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenAdminApproval();
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-bold text-[#E5A93C] hover:bg-[#0e2619] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#E5A93C]" />
                    <span>ศูนย์อนุมัติ & ตรวจสอบมาตรฐานฟาร์ม</span>
                  </div>
                  {totalPendingCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-black">
                      {totalPendingCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Role Switcher (Visible to Admin) */}
            {isAdmin && (
              <div className="px-3 py-2 border-b border-[#1c442c]">
                <span className="text-[10px] font-bold text-[#83A893] uppercase tracking-wider block mb-1.5 px-1">
                  สลับโหมดการทำงาน (Admin Switcher)
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
