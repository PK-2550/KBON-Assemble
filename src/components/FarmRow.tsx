import React from 'react';
import { Star } from 'lucide-react';
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
      className="group flex items-center justify-between py-3.5 px-3.5 sm:px-5 hover:bg-[#143523] cursor-pointer transition-colors border-b border-[#1c442c] last:border-b-0"
    >
      {/* Left side: Rank Number + Logo + Name & Subtitle */}
      <div className="flex items-center gap-3 min-w-0 pr-2">
        {/* Rank Number (1, 2, 3...) */}
        <span className={`w-5 sm:w-6 text-center text-xs sm:text-sm font-bold shrink-0 tabular-nums ${
          currentRank <= 3 ? 'text-[#E5A93C]' : 'text-[#83A893]'
        }`}>
          {currentRank <= 3 ? `👑 ${currentRank}` : currentRank}
        </span>

        {/* Square Farm Logo */}
        <div className="shrink-0">
          <FarmLogo
            name={farm.name}
            rank={farm.rank}
            bgColor={farm.logoBgColor}
            textColor={farm.logoTextColor}
          />
        </div>

        {/* Farm Name & Subtitle (สายพันธุ์ / จังหวัด) */}
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-[#E5A93C] tracking-tight truncate max-w-[140px] sm:max-w-[240px] transition-colors">
              {farm.name}
            </h3>
            {farm.certifications?.includes('GI') && (
              <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold bg-[#E5A93C]/20 text-[#F5D280] border border-[#E5A93C]/40 rounded-sm">
                GI
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#83A893] mt-0.5">
            <span className="inline-block">🇹🇭</span>
            <span className="font-medium text-[#c8dcd0]">
              {farm.varietiesCount || farm.topVarieties?.length || 4} สายพันธุ์
            </span>
            <span className="text-[#1c442c]">•</span>
            <span className="text-[#83A893] truncate">{farm.province}</span>
          </div>
        </div>
      </div>

      {/* Right side: Star Rating (8.8 /10) + Harvests Count (2,873 ผลผลิต) */}
      <div className="flex flex-col items-end shrink-0 text-right pl-2 min-w-[80px] sm:min-w-[100px]">
        {/* Rating ★ 9.8 /10 */}
        <div className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E5A93C] fill-[#E5A93C]" />
          <span className="font-extrabold text-white text-xs sm:text-sm tabular-nums">
            {farm.rating.toFixed(1)}{' '}
            <span className="text-[#83A893] font-normal text-[10px] sm:text-xs">/10</span>
          </span>
        </div>

        {/* Harvest count */}
        <div className="text-[10px] sm:text-[11px] text-[#83A893] font-normal tabular-nums mt-0.5">
          {farm.harvestedFruits.toLocaleString()} ผลผลิต
        </div>
      </div>
    </div>
  );
};
