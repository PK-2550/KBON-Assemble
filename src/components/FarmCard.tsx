import React from 'react';
import { Star, Trees, Sprout } from 'lucide-react';
import { DurianFarm } from '../types';
import { FarmLogo } from './FarmLogo';

interface FarmCardProps {
  farm: DurianFarm;
  displayRank?: number;
  onSelectFarm: (farm: DurianFarm) => void;
}

export const FarmCard: React.FC<FarmCardProps> = ({ farm, displayRank, onSelectFarm }) => {
  const currentRank = displayRank ?? farm.rank;

  return (
    <div
      id={`farm-card-${farm.id}`}
      className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-emerald-300 transition-all duration-200 group"
    >
      <div>
        {/* Top Card Header */}
        <div className="flex justify-between items-start mb-4 gap-3">
          <div className="flex items-start gap-3">
            <FarmLogo
              name={farm.name}
              rank={farm.rank}
              bgColor={farm.logoBgColor}
              textColor={farm.logoTextColor}
            />
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">
                อันดับ #{currentRank} • {farm.province}
              </span>
              <h2 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-emerald-800 transition-colors">
                {farm.name}
              </h2>
            </div>
          </div>

          {/* Rating Badge matching design */}
          <div className="flex items-center gap-1 bg-amber-50/90 border border-amber-200/60 px-2.5 py-1 rounded-md shrink-0">
            <span className="text-amber-500 text-xs">★</span>
            <span className="text-amber-700 text-xs font-bold tabular-nums">
              {farm.rating.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Highlight text if any */}
        {farm.highlight && (
          <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            {farm.highlight}
          </p>
        )}

        {/* Metrics List matching design */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500 flex items-center gap-1.5">
              <Trees className="w-4 h-4 text-emerald-600" />
              จำนวนต้นทุเรียน
            </span>
            <span className="text-sm font-bold text-slate-800 tabular-nums">
              {farm.totalTrees.toLocaleString()} ต้น
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500 flex items-center gap-1.5">
              <Sprout className="w-4 h-4 text-emerald-600" />
              ผลผลิตที่เก็บเกี่ยว
            </span>
            <span className="text-sm font-bold text-emerald-600 tabular-nums">
              {farm.harvestedFruits.toLocaleString()} ลูก
            </span>
          </div>

          <div className="flex justify-between items-center py-1.5">
            <span className="text-xs text-slate-400">สายพันธุ์เด่น</span>
            <span className="text-xs font-medium text-slate-600 truncate max-w-[160px]">
              {farm.topVarieties.slice(0, 2).join(', ')}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onSelectFarm(farm)}
        className="w-full mt-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 transition-all cursor-pointer shadow-2xs"
      >
        ดูรายละเอียด
      </button>
    </div>
  );
};
