import React from 'react';
import { Star, Trees, Sparkles } from 'lucide-react';
import { DurianFarm } from '../types';
import { FarmLogo } from './FarmLogo';

interface FarmRowProps {
  farm: DurianFarm;
  displayRank?: number;
  onSelectFarm: (farm: DurianFarm) => void;
}

export const FarmRow: React.FC<FarmRowProps> = ({ farm, displayRank, onSelectFarm }) => {
  const currentRank = displayRank ?? farm.rank;

  return (
    <div
      onClick={() => onSelectFarm(farm)}
      id={`farm-item-${farm.id}`}
      className="group flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-emerald-50/50 cursor-pointer transition-all duration-150 border-b border-slate-100/90 last:border-b-0"
    >
      {/* Left side: Rank + Logo + Name & Subtitle */}
      <div className="flex items-center gap-3 min-w-0 pr-2">
        {/* Rank Number */}
        <span className="w-6 text-center text-sm font-semibold text-slate-400 group-hover:text-emerald-700 shrink-0 tabular-nums">
          {currentRank}
        </span>

        {/* Farm Logo */}
        <FarmLogo
          name={farm.name}
          rank={farm.rank}
          bgColor={farm.logoBgColor}
          textColor={farm.logoTextColor}
        />

        {/* Farm Name & Info */}
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-[15px] text-slate-800 group-hover:text-emerald-800 tracking-tight truncate">
              {farm.name}
            </h3>
            {farm.certifications?.includes('GI') && (
              <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-sm">
                GI แท้
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="flex items-center gap-1 text-slate-600">
              <span className="inline-block w-3.5 text-center">🇹🇭</span>
              <span className="font-medium text-slate-700">{farm.province}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="truncate text-slate-500">
              {farm.varietiesCount} สายพันธุ์ ({farm.topVarieties.slice(0, 2).join(', ')})
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Trees count + Harvest count + Star rating */}
      <div className="flex items-center gap-4 sm:gap-6 shrink-0 text-right pl-2">
        {/* จำนวนต้นทุเรียน (Trees / Diaries) */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1 text-slate-700 font-semibold text-sm">
            <Trees className="w-3.5 h-3.5 text-emerald-600" />
            <span className="tabular-nums">{farm.totalTrees.toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">ต้นทุเรียน</span>
        </div>

        {/* รีวิวดาว + จำนวนลูกที่เก็บเกี่ยว (Rating & Harvests) */}
        <div className="flex flex-col items-end min-w-[76px]">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="font-bold text-slate-800 text-sm tabular-nums">
              {farm.rating.toFixed(1)}
              <span className="text-slate-400 font-normal text-xs">/10</span>
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium tabular-nums mt-0.5">
            {farm.harvestedFruits.toLocaleString()}{' '}
            <span className="text-slate-400 font-normal">ลูก</span>
          </div>
        </div>
      </div>
    </div>
  );
};
