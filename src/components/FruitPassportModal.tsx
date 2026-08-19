import React, { useState } from 'react';
import {
  X,
  MapPin,
  Check,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Share2,
  Trees,
  Award,
  ExternalLink,
} from 'lucide-react';
import { DurianFarm, IndividualTree, NfcScannedFruit } from '../types';

interface FruitPassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fruitData?: NfcScannedFruit | null;
  farm?: DurianFarm | null;
  tree?: IndividualTree | null;
  onViewFarmProfile?: (farm: DurianFarm) => void;
  onViewTreeHistory?: (tree: IndividualTree, farm: DurianFarm) => void;
}

export const FruitPassportModal: React.FC<FruitPassportModalProps> = ({
  isOpen,
  onClose,
  fruitData,
  farm,
  tree,
  onViewFarmProfile,
  onViewTreeHistory,
}) => {
  const [activeLang, setActiveLang] = useState<'TH' | 'ZH' | 'EN'>('TH');

  if (!isOpen) return null;

  // Farm details fallback
  const farmName = farm?.name || fruitData?.farmName || 'สวนทองชัยพัฒน์';
  const farmLocation = farm?.location || `${farm?.subdistrict || 'อ.มะขาม'} • ${farm?.province || 'จันทบุรี'} • GAP`;
  const farmInitials = (farmName.split(' ')[0] || 'TC').slice(0, 2).toUpperCase() || 'TC';

  // Tree & fruit details fallback
  const treeCode = tree?.code || fruitData?.treeCode || 'CTP-T-0047';
  const variety = tree?.variety || fruitData?.variety || 'หมอนทอง';
  const tagId = fruitData?.tagId?.replace('NFC Tag: ', '') || '#DUR-2026-0817-042';
  const weight = fruitData?.weightKg || 3.2;
  const harvestDate = fruitData?.harvestDate || '2026-08-12';
  const plantingDate = tree?.plantedDate || '2011-03-14';
  const ageYears = tree?.ageYears || 15;
  const grade = tree?.grade || 'A+';
  const gapNumber = farm?.certifications?.find((c) => c.includes('GAP')) || 'GAP-CTB-2024-0391';

  // Fruit image
  const fruitImage =
    tree?.photoUrl ||
    'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=900&auto=format&fit=crop&q=80';

  const handleOpenFarm = () => {
    if (farm && onViewFarmProfile) {
      onClose();
      onViewFarmProfile(farm);
    }
  };

  const handleOpenTree = () => {
    if (tree && farm && onViewTreeHistory) {
      onClose();
      onViewTreeHistory(tree, farm);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Mobile-Sized Luxury Frame matching the screenshot */}
      <div className="relative w-full max-w-md bg-[#07190f] text-[#f3f6f4] min-h-screen sm:min-h-0 sm:rounded-[32px] overflow-hidden border sm:border-[#1c442c] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col pb-8">
        
        {/* Top Header Bar */}
        <div className="pt-3 px-4 pb-2 flex items-center justify-between text-xs shrink-0 z-10">
          {/* Close button / Back indicator */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#0e2619] border border-[#1c442c] flex items-center justify-center text-[#83A893] hover:text-white cursor-pointer transition-colors"
            title="ปิด"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Verified Origin Header Title */}
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-[#f3f6f4]">
            <ShieldCheck className="w-4 h-4 text-[#E5A93C]" />
            <span className="text-sm font-semibold tracking-wide">Verified Origin</span>
          </div>

          {/* Language Switcher Badges (TH, ZH, EN) */}
          <div className="flex items-center gap-1 bg-[#0e2619] p-0.5 rounded-full border border-[#1c442c]">
            {(['TH', 'ZH', 'EN'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                  activeLang === lang
                    ? 'bg-[#E5A93C] text-[#1c1202] shadow-xs'
                    : 'text-[#83A893] hover:text-white'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Passport Content */}
        <div className="px-3.5 sm:px-4 space-y-3 flex-1">
          {/* Main Hero Durian Image Card */}
          <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-[#0a2014] border border-[#1c442c]">
            <img
              src={fruitImage}
              alt="ทุเรียนแท้ที่ผ่านการตรวจสอบ"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {/* Dark Vignette Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#07190f] via-transparent to-black/30" />

            {/* Top Left Golden Tag Badge: ● #DUR-2026-0817-042 */}
            <div className="absolute top-3 left-3 bg-[#0c2417]/90 backdrop-blur-md border border-[#E5A93C]/50 text-[#F5D280] px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-md">
              <span className="w-2 h-2 rounded-full bg-[#E5A93C] animate-pulse" />
              <span>{tagId.startsWith('#') ? tagId : `#${tagId}`}</span>
            </div>

            {/* Floating Ripeness Card at bottom of photo */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-[#153422]/95 backdrop-blur-md border border-[#235337] rounded-2xl p-3 flex items-center justify-between shadow-lg">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-[#4ADE80] flex items-center gap-1">
                  <span>พร้อมทานวันนี้</span>
                </div>
                <div className="text-xs font-bold text-white">
                  เนื้อกรอบนอก นุ่มในพอดี
                </div>
                <div className="text-[10px] text-[#83A893]">
                  เก็บเกี่ยวเมื่อ 5 วันก่อน
                </div>
              </div>

              {/* 5 Vertical Ripening Level Bars */}
              <div className="flex items-center gap-1 h-9 px-1">
                {[1, 2, 3, 4, 5].map((bar) => {
                  const isFilled = bar <= 4;
                  return (
                    <div
                      key={bar}
                      className={`w-2 h-7 rounded-full transition-all ${
                        isFilled
                          ? 'bg-[#4ADE80] shadow-[0_0_6px_rgba(74,222,128,0.7)]'
                          : 'bg-[#10291b]'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Farm Info Card matching screenshot */}
          <div className="bg-[#0e2619] border border-[#1c442c] rounded-2xl p-3.5 space-y-3 shadow-lg">
            <div className="flex items-center gap-3">
              {/* Farm Avatar / TC Logo */}
              <div className="w-12 h-12 rounded-xl bg-[#143523] border border-[#225538] text-[#E5A93C] flex items-center justify-center font-serif text-lg font-black shrink-0 shadow-inner">
                {farmInitials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                    {farmName}
                  </h3>
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#153e28] text-[#4ADE80] border border-[#225739]">
                    <Check className="w-3 h-3 text-[#4ADE80]" />
                    <span>ฟาร์มรับรอง</span>
                  </span>
                </div>

                <p className="text-[11px] text-[#83A893] mt-0.5 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-[#E5A93C] shrink-0" />
                  <span>{farmLocation}</span>
                </p>
              </div>
            </div>

            {/* 2 Side-by-Side Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Gold Button: เข้าชมโปรไฟล์ฟาร์ม → */}
              <button
                onClick={handleOpenFarm}
                className="py-2.5 px-3 bg-[#E5A93C] hover:bg-[#d89727] text-[#1c1202] text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98"
              >
                <span>เข้าชมโปรไฟล์ฟาร์ม</span>
                <span>→</span>
              </button>

              {/* Dark Emerald Button: 📍 ดูบนแผนที่ */}
              <button
                onClick={() => {
                  if (farm) {
                    window.open(`https://maps.google.com/?q=${encodeURIComponent(farm.name + ' ' + farm.province)}`, '_blank');
                  }
                }}
                className="py-2.5 px-3 bg-[#122b1c] hover:bg-[#183a26] text-white border border-[#234d34] text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-[#E5A93C]" />
                <span>ดูบนแผนที่</span>
              </button>
            </div>
          </div>

          {/* 2-Column Luxury Information Grid matching screenshot */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Card 1: สายพันธุ์ */}
            <div className="bg-[#0e2619] border border-[#1c442c] rounded-2xl p-3 space-y-1">
              <span className="text-[11px] font-medium text-[#83A893] block">
                สายพันธุ์
              </span>
              <span className="text-sm font-extrabold text-white block truncate">
                {variety}
              </span>
            </div>

            {/* Card 2: รหัสต้น → (Interactive Link) */}
            <div
              onClick={handleOpenTree}
              className="bg-[#0e2619] border border-[#E5A93C]/40 hover:border-[#E5A93C] rounded-2xl p-3 space-y-0.5 cursor-pointer transition-colors group"
            >
              <span className="text-[11px] font-bold text-[#E5A93C] flex items-center justify-between">
                <span>รหัสต้น →</span>
              </span>
              <span className="text-sm font-black font-mono text-[#E5A93C] block group-hover:underline">
                {treeCode}
              </span>
              <span className="text-[10px] text-[#A9884C] block">
                แตะเพื่อดูประวัติต้น
              </span>
            </div>

            {/* Card 3: อายุต้น */}
            <div className="bg-[#0e2619] border border-[#1c442c] rounded-2xl p-3 space-y-1">
              <span className="text-[11px] font-medium text-[#83A893] block">
                อายุต้น
              </span>
              <span className="text-sm font-extrabold text-white block">
                {ageYears} ปี
              </span>
            </div>

            {/* Card 4: วันปลูก */}
            <div className="bg-[#0e2619] border border-[#1c442c] rounded-2xl p-3 space-y-1">
              <span className="text-[11px] font-medium text-[#83A893] block">
                วันปลูก
              </span>
              <span className="text-sm font-bold text-[#F5D280] block font-mono">
                {plantingDate}
              </span>
            </div>

            {/* Card 5: วันเก็บเกี่ยว */}
            <div className="bg-[#0e2619] border border-[#1c442c] rounded-2xl p-3 space-y-1">
              <span className="text-[11px] font-medium text-[#83A893] block">
                วันเก็บเกี่ยว
              </span>
              <span className="text-sm font-bold text-[#F5D280] block font-mono">
                {harvestDate}
              </span>
            </div>

            {/* Card 6: เกรด */}
            <div className="bg-[#0e2619] border border-[#1c442c] rounded-2xl p-3 space-y-1">
              <span className="text-[11px] font-medium text-[#83A893] block">
                เกรด
              </span>
              <span className="text-sm font-black text-white block">
                {grade}
              </span>
            </div>

            {/* Card 7: น้ำหนัก */}
            <div className="bg-[#0e2619] border border-[#1c442c] rounded-2xl p-3 space-y-1">
              <span className="text-[11px] font-medium text-[#83A893] block">
                น้ำหนัก
              </span>
              <span className="text-sm font-extrabold text-white block">
                {weight} kg
              </span>
            </div>

            {/* Card 8: เลขที่ใบอนุญาต GAP */}
            <div className="bg-[#0e2619] border border-[#1c442c] rounded-2xl p-3 space-y-1">
              <span className="text-[11px] font-medium text-[#83A893] block">
                เลขที่ใบอนุญาต GAP
              </span>
              <span className="text-xs font-bold text-[#F5D280] block font-mono truncate">
                {gapNumber}
              </span>
            </div>
          </div>

          {/* Blockchain & NFC Cryptographic Stamp */}
          <div className="bg-[#0b2216] border border-[#18402a] rounded-2xl p-3 text-[11px] flex items-center justify-between text-[#83A893]">
            <span className="flex items-center gap-1.5 text-white">
              <Sparkles className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>NFC Cryptographic Signature Verified</span>
            </span>
            <span className="font-mono text-[10px] text-[#4ADE80] font-bold">100% Authentic</span>
          </div>
        </div>
      </div>
    </div>
  );
};
