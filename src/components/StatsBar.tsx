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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
          <Award className="w-4 h-4 text-emerald-600" />
          <span>ฟาร์มในระบบ</span>
        </div>
        <div className="text-xl font-bold text-slate-800 tabular-nums">
          {farms.length}{' '}
          <span className="text-xs font-normal text-slate-400">แห่ง</span>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
          <Trees className="w-4 h-4 text-emerald-600" />
          <span>ต้นทุเรียนทั้งหมด</span>
        </div>
        <div className="text-xl font-bold text-slate-800 tabular-nums">
          {totalTrees.toLocaleString()}{' '}
          <span className="text-xs font-normal text-slate-400">ต้น</span>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
          <Sprout className="w-4 h-4 text-amber-600" />
          <span>ผลผลิตที่เก็บเกี่ยว</span>
        </div>
        <div className="text-xl font-bold text-slate-800 tabular-nums">
          {totalHarvested.toLocaleString()}{' '}
          <span className="text-xs font-normal text-slate-400">ลูก</span>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          <span>คะแนนเฉลี่ย</span>
        </div>
        <div className="text-xl font-bold text-slate-800 tabular-nums">
          {avgRating}{' '}
          <span className="text-xs font-normal text-slate-400">/10 ดาว</span>
        </div>
      </div>
    </div>
  );
};
