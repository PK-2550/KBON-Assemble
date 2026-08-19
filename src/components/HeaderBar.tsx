import React from 'react';
import { Search, ArrowUpDown, X, LayoutGrid, List, Plus } from 'lucide-react';
import { SortField } from '../types';

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
}) => {
  return (
    <header className="mb-6 space-y-4">
      {/* Top Banner Row: Title + Add Farm Button matching Sleek Interface */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            รายชื่อฟาร์มทุเรียน
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            จัดการและติดตามสถานะฟาร์มทุเรียนในระบบทั้งหมดของคุณ
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'grid'
                  ? 'bg-emerald-50 text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="มุมมองการ์ด (Grid)"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">การ์ด</span>
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'list'
                  ? 'bg-emerald-50 text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="มุมมองอันดับ (Rank List)"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">อันดับ</span>
            </button>
          </div>

          {/* Add New Farm Button */}
          <button
            onClick={onOpenAddModal}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md shadow-emerald-200/60 hover:bg-emerald-700 hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มฟาร์มใหม่</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            id="farm-search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาฟาร์ม, จังหวัด, สายพันธุ์..."
            className="w-full pl-3.5 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 placeholder-slate-400 shadow-2xs transition-all"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              title="ล้างคำค้นหา"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-2xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-medium text-slate-500 hidden sm:inline">จัดเรียงตาม:</span>
          <select
            id="farm-sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortField)}
            className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer text-xs pr-1"
          >
            <option value="harvested">ผลผลิตเก็บเกี่ยว (Harvests)</option>
            <option value="trees">จำนวนต้นทุเรียน (Trees)</option>
            <option value="rating">คะแนนดาว (Rating)</option>
            <option value="rank">อันดับเดิม (Default Rank)</option>
            <option value="name">ชื่อฟาร์ม (Name)</option>
          </select>
        </div>
      </div>

      {/* Quick Province Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar text-xs">
        <button
          onClick={() => onProvinceChange('')}
          className={`px-3 py-1 rounded-full font-medium transition-all shrink-0 ${
            selectedProvince === ''
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          ทุกจังหวัด ({totalFarms})
        </button>
        {provinces.map((prov) => (
          <button
            key={prov}
            onClick={() => onProvinceChange(prov)}
            className={`px-3 py-1 rounded-full font-medium transition-all shrink-0 ${
              selectedProvince === prov
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {prov}
          </button>
        ))}
      </div>
    </header>
  );
};
