import React from 'react';
import { Plus, Sprout } from 'lucide-react';
import { DurianFarm } from '../types';
import { FarmRow } from './FarmRow';
import { FarmCard } from './FarmCard';

interface FarmListProps {
  farms: DurianFarm[];
  viewMode: 'grid' | 'list';
  onSelectFarm: (farm: DurianFarm) => void;
  onOpenAddModal: () => void;
}

export const FarmList: React.FC<FarmListProps> = ({
  farms,
  viewMode,
  onSelectFarm,
  onOpenAddModal,
}) => {
  if (farms.length === 0) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
        <div className="text-4xl mb-3">🌳</div>
        <h3 className="text-base font-semibold text-slate-800">ไม่พบฟาร์มทุเรียนที่ตรงกับเงื่อนไข</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">ลองเปลี่ยนคำค้นหาหรือตัวกรองจังหวัด</p>
        <button
          onClick={onOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          เพิ่มฟาร์มใหม่
        </button>
      </div>
    );
  }

  // Grid View (3 Columns matching the Sleek Interface design HTML)
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {farms.map((farm, index) => (
          <FarmCard
            key={farm.id}
            farm={farm}
            displayRank={index + 1}
            onSelectFarm={onSelectFarm}
          />
        ))}

        {/* Add Area / Dotted Card matching Sleek Interface theme */}
        <div
          onClick={onOpenAddModal}
          className="bg-emerald-50/60 rounded-2xl p-6 border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-emerald-100/60 hover:border-emerald-300 transition-all min-h-[260px] group"
        >
          <div className="w-12 h-12 bg-emerald-100 group-hover:bg-emerald-200 rounded-full flex items-center justify-center text-emerald-600 text-2xl font-bold mb-3 shadow-2xs transition-transform group-hover:scale-110">
            +
          </div>
          <span className="text-emerald-800 font-bold text-base">เพิ่มพื้นที่การเพาะปลูก</span>
          <span className="text-emerald-700/70 text-xs mt-1">ขยายฐานข้อมูลเกษตรกรและสวนทุเรียน</span>
        </div>
      </div>
    );
  }

  // Rank List View (2 Columns matching original screenshot with Sleek styling)
  const leftColumnFarms: { farm: DurianFarm; displayRank: number }[] = [];
  const rightColumnFarms: { farm: DurianFarm; displayRank: number }[] = [];

  farms.forEach((farm, index) => {
    const item = { farm, displayRank: index + 1 };
    if (index % 2 === 0) {
      leftColumnFarms.push(item);
    } else {
      rightColumnFarms.push(item);
    }
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Left Column */}
        <div className="flex flex-col">
          {leftColumnFarms.map(({ farm, displayRank }) => (
            <FarmRow
              key={farm.id}
              farm={farm}
              displayRank={displayRank}
              onSelectFarm={onSelectFarm}
            />
          ))}
        </div>

        {/* Right Column */}
        <div className="flex flex-col">
          {rightColumnFarms.map(({ farm, displayRank }) => (
            <FarmRow
              key={farm.id}
              farm={farm}
              displayRank={displayRank}
              onSelectFarm={onSelectFarm}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
