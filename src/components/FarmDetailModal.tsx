import React from 'react';
import { X, Star, Trees, Award, MapPin, CheckCircle2, Sprout, Sparkles } from 'lucide-react';
import { DurianFarm } from '../types';
import { FarmLogo } from './FarmLogo';

interface FarmDetailModalProps {
  farm: DurianFarm | null;
  onClose: () => void;
}

export const FarmDetailModal: React.FC<FarmDetailModalProps> = ({ farm, onClose }) => {
  if (!farm) return null;

  return (
    <div
      id="farm-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#092215] text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#18422b] relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          id="close-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#8DA796] hover:text-white hover:bg-[#0e311f] rounded-full transition-colors border border-[#18422b]"
          aria-label="ปิดหน้าต่าง"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Section */}
        <div className="flex items-start gap-4 pr-8">
          <FarmLogo
            name={farm.name}
            rank={farm.rank}
            bgColor={farm.logoBgColor}
            textColor={farm.logoTextColor}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#0e311f] text-[#E5A93C] border border-[#1e5236]">
                อันดับ #{farm.rank}
              </span>
              <span className="flex items-center gap-1 text-xs text-[#8DA796]">
                <MapPin className="w-3.5 h-3.5 text-[#E5A93C]" />
                จังหวัด{farm.province}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">{farm.name}</h2>
            {farm.nameEn && <p className="text-xs text-[#8DA796]">{farm.nameEn}</p>}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 my-5 p-3.5 bg-[#04140b] rounded-2xl border border-[#18422b]">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[#E5A93C] mb-0.5">
              <Star className="w-4 h-4 fill-[#E5A93C]" />
              <span className="font-bold text-base text-white">{farm.rating.toFixed(1)}</span>
              <span className="text-xs text-[#8DA796]">/10</span>
            </div>
            <div className="text-[11px] text-[#8DA796]">{farm.reviewCount} รีวิว</div>
          </div>

          <div className="text-center border-x border-[#18422b]">
            <div className="flex items-center justify-center gap-1 text-[#E5A93C] mb-0.5">
              <Trees className="w-4 h-4" />
              <span className="font-bold text-base text-white">
                {farm.totalTrees.toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] text-[#8DA796]">จำนวนต้นทุเรียน</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[#E5A93C] mb-0.5">
              <Sprout className="w-4 h-4" />
              <span className="font-bold text-base text-white">
                {farm.harvestedFruits.toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] text-[#8DA796]">ลูกที่เก็บเกี่ยว/ปี</div>
          </div>
        </div>

        {/* Farm Highlight */}
        {farm.highlight && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-[#8DA796] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#E5A93C]" />
              จุดเด่นของสวน
            </h4>
            <p className="text-sm text-[#d0ded6] bg-[#04140b] p-3.5 rounded-xl border border-[#18422b] leading-relaxed">
              {farm.highlight}
            </p>
          </div>
        )}

        {/* Varieties Section */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-[#8DA796] uppercase tracking-wider mb-2">
            สายพันธุ์เด่นในสวน ({farm.varietiesCount} สายพันธุ์)
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {farm.topVarieties.map((variety, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 text-xs font-medium bg-[#0e311f] text-[#E5A93C] border border-[#1e5236] rounded-lg"
              >
                🌳 {variety}
              </span>
            ))}
          </div>
        </div>

        {/* Certifications */}
        {farm.certifications && farm.certifications.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-semibold text-[#8DA796] uppercase tracking-wider mb-2 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-[#E5A93C]" />
              มาตรฐานและการรับรอง
            </h4>
            <div className="flex flex-wrap gap-2">
              {farm.certifications.map((cert, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#0e311f] text-white border border-[#1e5236] rounded-lg"
                >
                  <CheckCircle2 className="w-3 h-3 text-[#E5A93C]" />
                  {cert}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-[#18422b]">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-[#241603] bg-[#E5A93C] hover:bg-[#d4992e] rounded-xl shadow-md transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
