import React from 'react';
import { Star, Trees, Sprout, ShieldCheck, MapPin, ChevronRight } from 'lucide-react';
import { DurianFarm } from '../types';
import { FarmLogo } from './FarmLogo';

interface FarmCardProps {
  farm: DurianFarm;
  displayRank?: number;
  onSelectFarm: (farm: DurianFarm) => void;
}

export const FarmCard: React.FC<FarmCardProps> = ({ farm, displayRank, onSelectFarm }) => {
  const currentRank = displayRank ?? farm.rank;
  const coverPhoto = farm.photos && farm.photos.length > 0
    ? farm.photos[0]
    : 'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80';

  return (
    <div
      id={`farm-card-${farm.id}`}
      onClick={() => onSelectFarm(farm)}
      className="bg-[#092215]/90 rounded-2xl overflow-hidden border border-[#18422b] shadow-xl flex flex-col justify-between hover:shadow-2xl hover:border-[#E5A93C]/50 transition-all duration-200 group cursor-pointer"
    >
      {/* Mobile-First Image Header with Badges */}
      <div className="relative h-32 sm:h-36 w-full bg-[#04140b] overflow-hidden">
        <img
          src={coverPhoto}
          alt={farm.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#04140b] via-[#04140b]/40 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <span className="bg-black/70 backdrop-blur-md text-[#F5D280] text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#E5A93C]/40 font-mono">
            อันดับ #{currentRank}
          </span>
          <div className="flex items-center gap-1 bg-[#E5A93C] text-[#241603] font-black text-xs px-2 py-0.5 rounded-full shadow-md">
            <span>★</span>
            <span>{farm.rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Bottom Farm Name on Image */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#E5A93C] uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#E5A93C]" />
              <span>{farm.province}</span>
            </span>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight drop-shadow-md">
              {farm.name}
            </h2>
          </div>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        {/* Highlight Quote */}
        {farm.highlight && (
          <p className="text-[11px] sm:text-xs text-[#8DA796] line-clamp-2 leading-relaxed bg-[#04140b] p-2.5 rounded-xl border border-[#18422b]">
            {farm.highlight}
          </p>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#04140b] p-2.5 rounded-xl border border-[#18422b]">
            <span className="text-[10px] text-[#8DA796] font-medium flex items-center gap-1">
              <Trees className="w-3 h-3 text-[#E5A93C]" />
              <span>จำนวนต้น</span>
            </span>
            <div className="text-sm font-bold text-white mt-0.5 font-mono">
              {farm.totalTrees.toLocaleString()} <span className="text-[10px] font-normal text-[#8DA796]">ต้น</span>
            </div>
          </div>

          <div className="bg-[#0e311f] p-2.5 rounded-xl border border-[#1e5236]">
            <span className="text-[10px] text-[#34D399] font-medium flex items-center gap-1">
              <Sprout className="w-3 h-3 text-[#34D399]" />
              <span>ผลผลิตที่เก็บ</span>
            </span>
            <div className="text-sm font-extrabold text-[#34D399] mt-0.5 font-mono">
              {farm.harvestedFruits.toLocaleString()} <span className="text-[10px] font-normal text-[#8DA796]">ลูก</span>
            </div>
          </div>
        </div>

        {/* Varieties & Certifications */}
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#143d27]">
          <span className="text-[#8DA796] truncate max-w-[170px]">
            พันธุ์: <strong className="text-white font-semibold">{farm.topVarieties.slice(0, 2).join(', ')}</strong>
          </span>
          <span className="text-[#F5D280] font-bold flex items-center gap-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>GI แท้</span>
          </span>
        </div>

        {/* Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectFarm(farm);
          }}
          className="w-full py-2.5 bg-gradient-to-r from-[#E5A93C] to-[#d4992e] hover:from-[#d4992e] hover:to-[#c28824] text-[#241603] rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-98"
        >
          <span>เข้าชมแปลงต้นไม้ ({farm.totalTrees} ต้น)</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
