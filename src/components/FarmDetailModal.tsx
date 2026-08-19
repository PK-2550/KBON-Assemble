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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          id="close-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
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
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                อันดับ #{farm.rank}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                จังหวัด{farm.province}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1">{farm.name}</h2>
            {farm.nameEn && <p className="text-xs text-slate-400">{farm.nameEn}</p>}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 my-5 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
              <Star className="w-4 h-4 fill-amber-400" />
              <span className="font-bold text-base text-slate-800">{farm.rating.toFixed(1)}</span>
              <span className="text-xs text-slate-400">/10</span>
            </div>
            <div className="text-[11px] text-slate-500">{farm.reviewCount} รีวิว</div>
          </div>

          <div className="text-center border-x border-slate-200">
            <div className="flex items-center justify-center gap-1 text-emerald-600 mb-0.5">
              <Trees className="w-4 h-4" />
              <span className="font-bold text-base text-slate-800">
                {farm.totalTrees.toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">จำนวนต้นทุเรียน</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-0.5">
              <Sprout className="w-4 h-4" />
              <span className="font-bold text-base text-slate-800">
                {farm.harvestedFruits.toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">ลูกที่เก็บเกี่ยว/ปี</div>
          </div>
        </div>

        {/* Farm Highlight */}
        {farm.highlight && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              จุดเด่นของสวน
            </h4>
            <p className="text-sm text-slate-700 bg-amber-50/50 p-3 rounded-lg border border-amber-100/60 leading-relaxed">
              {farm.highlight}
            </p>
          </div>
        )}

        {/* Varieties Section */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            สายพันธุ์เด่นในสวน ({farm.varietiesCount} สายพันธุ์)
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {farm.topVarieties.map((variety, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded-md"
              >
                🌳 {variety}
              </span>
            ))}
          </div>
        </div>

        {/* Certifications */}
        {farm.certifications && farm.certifications.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-blue-500" />
              มาตรฐานและการรับรอง
            </h4>
            <div className="flex flex-wrap gap-2">
              {farm.certifications.map((cert, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/70 rounded-md"
                >
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  {cert}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
