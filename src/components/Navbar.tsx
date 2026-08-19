import React from 'react';
import { Sprout } from 'lucide-react';

interface NavbarProps {
  activeTab: 'farms' | 'dashboard';
  onTabChange: (tab: 'farms' | 'dashboard') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex justify-between items-center shrink-0 sticky top-0 z-40 shadow-xs">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200/80 text-white shrink-0">
          <Sprout className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent block leading-none">
            DuriTrack Pro
          </span>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">
            ระบบบริหารและจัดอันดับฟาร์มทุเรียน
          </span>
        </div>
      </div>

      {/* Center Navigation Tabs (Only 'ฟาร์มทุเรียน' and 'แดชบอร์ด') */}
      <div className="flex gap-6 sm:gap-8 text-sm font-semibold text-slate-500 h-full items-center">
        <button
          onClick={() => onTabChange('farms')}
          className={`h-16 flex items-center transition-colors cursor-pointer ${
            activeTab === 'farms'
              ? 'text-emerald-600 border-b-2 border-emerald-600 font-bold'
              : 'hover:text-emerald-600'
          }`}
        >
          ฟาร์มทุเรียน
        </button>
        <button
          onClick={() => onTabChange('dashboard')}
          className={`h-16 flex items-center transition-colors cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-emerald-600 border-b-2 border-emerald-600 font-bold'
              : 'hover:text-emerald-600'
          }`}
        >
          แดชบอร์ด
        </button>
      </div>

      {/* Right User Status */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200/60">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>ระบบพร้อมใช้งาน</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 shadow-2xs">
          DT
        </div>
      </div>
    </nav>
  );
};
