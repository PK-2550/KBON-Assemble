import React from 'react';
import { Search, X, LayoutGrid, List, Plus, ChevronDown } from 'lucide-react';
import { SortField, UserRole } from '../types';

interface HeaderBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortField;
  onSortChange: (sort: SortField) => void;
  selectedProvince: string;
  onProvinceChange: (province: string) => void;
  provinces: string[];
  totalFarms: number;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onOpenAddModal: () => void;
  currentRole?: UserRole;
  onOpenNfcScanner?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  selectedProvince,
  onProvinceChange,
  provinces,
  totalFarms,
  viewMode,
  onViewModeChange,
  onOpenAddModal,
  currentRole = 'user',
}) => {
  const getSortLabel = (sort: SortField) => {
    switch (sort) {
      case 'harvested':
        return 'เรียงตามผลผลิต 📈';
      case 'rating':
        return 'เรียงตามคะแนน ⭐';
      case 'trees':
        return 'เรียงตามจำนวนต้น 🌳';
      case 'name':
        return 'เรียงตามชื่อ (ก-ฮ)';
      default:
        return 'เรียงลำดับ ☰';
    }
  };

  return (
    <header className="mb-3 space-y-2.5">
      {/* Title: รายชื่อฟาร์มทุเรียน */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>รายชื่อฟาร์มทุเรียน</span>
            <span className="text-[10px] font-mono font-bold bg-[#E5A93C]/20 text-[#F5D280] border border-[#E5A93C]/40 px-2 py-0.5 rounded-full">
              Verified
            </span>
          </h1>
          <p className="text-xs text-[#8DA796] mt-0.5">
            สแกนตรวจสอบย้อนกลับแหล่งกำเนิด และมาตรฐาน GI & GAP
          </p>
        </div>

        {/* Admin Quick Action */}
        {currentRole === 'admin' && (
          <button
            onClick={() => onOpenAddModal()}
            className="bg-[#E5A93C] text-[#241603] px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow-md hover:bg-[#d4992e] transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มฟาร์ม</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          id="farm-search-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ค้นหารายชื่อฟาร์ม, สายพันธุ์, หรือจังหวัด..."
          className="w-full pl-4 pr-10 py-2.5 text-sm bg-[#0e2619] border border-[#1c442c] rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-[#E5A93C]/40 focus:border-[#E5A93C] text-white placeholder-[#688d77] shadow-inner transition-all"
        />
        {searchQuery ? (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#83A893] hover:text-white p-1 cursor-pointer"
            title="ล้างคำค้นหา"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <Search className="w-4 h-4 text-[#E5A93C] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        )}
      </div>

      {/* Sort & View Mode Row */}
      <div className="flex items-center justify-between pt-0.5">
        {/* Total found text */}
        <span className="text-[11px] text-[#83A893] font-medium">
          พบ <strong className="text-white font-bold">{totalFarms}</strong> ฟาร์มมาตรฐาน
        </span>

        {/* Sort Selector in Thai */}
        <div className="flex items-center gap-2">
          <div className="relative inline-flex items-center bg-[#0e2619] border border-[#1c442c] rounded-xl px-1">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortField)}
              className="appearance-none bg-transparent text-[#F5D280] font-bold text-xs pl-1.5 pr-5 py-1 rounded-lg border-0 cursor-pointer focus:outline-hidden"
            >
              <option value="harvested" className="bg-[#0e2619] text-white">เรียงตามยอดผลผลิต 📈</option>
              <option value="rating" className="bg-[#0e2619] text-white">เรียงตามคะแนนรีวิว ⭐</option>
              <option value="trees" className="bg-[#0e2619] text-white">เรียงตามจำนวนต้น 🌳</option>
              <option value="name" className="bg-[#0e2619] text-white">เรียงตามชื่อ (ก-ฮ)</option>
            </select>
            <ChevronDown className="w-3 h-3 text-[#E5A93C] absolute right-1.5 pointer-events-none" />
          </div>

          {/* View Switcher */}
          <div className="flex items-center bg-[#0e2619] p-0.5 rounded-xl border border-[#1c442c]">
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#E5A93C] text-[#1c1202] shadow-xs font-bold'
                  : 'text-[#83A893] hover:text-white'
              }`}
              title="แบบรายการอันดับ"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#E5A93C] text-[#1c1202] shadow-xs font-bold'
                  : 'text-[#83A893] hover:text-white'
              }`}
              title="แบบการ์ด"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Province Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => onProvinceChange('')}
          className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer text-[11px] ${
            selectedProvince === ''
              ? 'bg-[#E5A93C] text-[#1c1202] shadow-md'
              : 'bg-[#0e2619] border border-[#1c442c] text-[#83A893] hover:text-white hover:border-[#235538]'
          }`}
        >
          ทุกจังหวัด
        </button>
        {provinces.map((prov) => (
          <button
            key={prov}
            onClick={() => onProvinceChange(prov)}
            className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer text-[11px] ${
              selectedProvince === prov
                ? 'bg-[#E5A93C] text-[#1c1202] shadow-md'
                : 'bg-[#0e2619] border border-[#1c442c] text-[#83A893] hover:text-white hover:border-[#235538]'
            }`}
          >
            {prov}
          </button>
        ))}
      </div>
    </header>
  );
};
