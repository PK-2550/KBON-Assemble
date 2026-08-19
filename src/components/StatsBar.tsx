import React from 'react';
import { Trees, Sprout, Star, Award } from 'lucide-react';
import { DurianFarm } from '../types';

interface StatsBarProps {
  farms: DurianFarm[];
}

export const StatsBar: React.FC<StatsBarProps> = ({ farms }) => {
  const totalTrees = farms.reduce((acc, f) => acc + f.totalTrees, 0);
  const totalHarvested = farms.reduce((acc, f) => acc + f.harvestedFruits, 0);
  const avgRating = farms.length > 0
    ? (farms.reduce((acc, f) => acc + f.rating, 0) / farms.length).toFixed(1)
    : '0.0';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
      <div className="bg-[#0e2619] p-3 rounded-2xl border border-[#1c442c] shadow-md text-white">
        <div className="flex items-center gap-1.5 text-[#83A893] text-xs font-medium mb-0.5">
          <Award className="w-3.5 h-3.5 text-[#E5A93C]" />
          <span>ฟาร์มในระบบ</span>
        </div>
        <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
          {farms.length}{' '}
          <span className="text-xs font-normal text-[#83A893]">แห่ง</span>
        </div>
      </div>

      <div className="bg-[#0e2619] p-3 rounded-2xl border border-[#1c442c] shadow-md text-white">
        <div className="flex items-center gap-1.5 text-[#83A893] text-xs font-medium mb-0.5">
          <Trees className="w-3.5 h-3.5 text-[#E5A93C]" />
          <span>ต้นทุเรียนทั้งหมด</span>
        </div>
        <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
          {totalTrees.toLocaleString()}{' '}
          <span className="text-xs font-normal text-[#83A893]">ต้น</span>
        </div>
      </div>

      <div className="bg-[#0e2619] p-3 rounded-2xl border border-[#1c442c] shadow-md text-white">
        <div className="flex items-center gap-1.5 text-[#83A893] text-xs font-medium mb-0.5">
          <Sprout className="w-3.5 h-3.5 text-[#E5A93C]" />
          <span>ผลผลิตที่เก็บเกี่ยว</span>
        </div>
        <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
          {totalHarvested.toLocaleString()}{' '}
          <span className="text-xs font-normal text-[#83A893]">ลูก</span>
        </div>
      </div>

      <div className="bg-[#0e2619] p-3 rounded-2xl border border-[#1c442c] shadow-md text-white">
        <div className="flex items-center gap-1.5 text-[#83A893] text-xs font-medium mb-0.5">
          <Star className="w-3.5 h-3.5 text-[#E5A93C] fill-[#E5A93C]" />
          <span>คะแนนเฉลี่ย</span>
        </div>
        <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
          {avgRating}{' '}
          <span className="text-xs font-normal text-[#83A893]">/10 ดาว</span>
        </div>
      </div>
    </div>
  );
};
