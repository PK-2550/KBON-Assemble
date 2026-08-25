import React from 'react';
import { Plus } from 'lucide-react';
import { DurianFarm, UserRole } from '../types';
import { FarmRow } from './FarmRow';
import { FarmCard } from './FarmCard';

interface FarmListProps {
  farms: DurianFarm[];
  viewMode: 'grid' | 'list';
  onSelectFarm: (farm: DurianFarm) => void;
  onOpenAddModal: () => void;
  currentRole?: UserRole;
}

export const FarmList: React.FC<FarmListProps> = ({
  farms,
  viewMode,
  onSelectFarm,
  onOpenAddModal,
  currentRole = 'user',
}) => {
  if (farms.length === 0) {
    return (
      <div className="py-12 text-center bg-surface rounded-3xl border border-line p-6 shadow-xl text-fg">
        <div className="text-3xl mb-2">🌳</div>
        <h3 className="text-sm font-bold text-white">ไม่พบฟาร์มทุเรียนที่ตรงกับเงื่อนไข</h3>
        <p className="text-xs text-fg-2 mt-1 mb-3">ลองเปลี่ยนคำค้นหาหรือตัวกรองจังหวัด</p>
        {currentRole === 'admin' && (
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-gold text-gold-ink text-xs font-bold rounded-xl hover:bg-[#d89727] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่มฟาร์มใหม่
          </button>
        )}
      </div>
    );
  }

  // Grid View
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {farms.map((farm, index) => (
          <FarmCard
            key={farm.id}
            farm={farm}
            displayRank={index + 1}
            onSelectFarm={onSelectFarm}
          />
        ))}

        {currentRole === 'admin' && (
          <div
            onClick={onOpenAddModal}
            className="bg-surface/60 rounded-2xl p-5 border-2 border-dashed border-line flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-2 hover:border-gold/50 transition-all min-h-[180px] group"
          >
            <div className="w-10 h-10 bg-surface-2 group-hover:bg-line rounded-full flex items-center justify-center text-gold text-xl font-bold mb-2 transition-transform group-hover:scale-110 border border-[#235538]">
              +
            </div>
            <span className="text-white font-bold text-sm">เพิ่มพื้นที่การเพาะปลูก</span>
            <span className="text-fg-2 text-[11px] mt-0.5">ขยายฐานข้อมูลเกษตรกรและสวนทุเรียน</span>
          </div>
        )}
      </div>
    );
  }

  // Rank List View (Sequential 1, 2, 3, 4...)
  return (
    <div className="bg-surface rounded-3xl border border-line shadow-2xl overflow-hidden divide-y divide-line">
      {farms.map((farm, index) => (
        <FarmRow
          key={farm.id}
          farm={farm}
          displayRank={index + 1}
          onSelectFarm={onSelectFarm}
        />
      ))}
    </div>
  );
};
