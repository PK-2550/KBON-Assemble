import React, { useState, useEffect } from 'react';
import {
  X,
  Trees,
  Star,
  BookOpen,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  MessageSquare,
  Droplets,
  Sprout,
  Tag,
} from 'lucide-react';
import { IndividualTree, DurianFarm, TreeReview, UserRole } from '../types';
import { fetchTreeReviews } from '../services/farmService';

interface TreeDetailModalProps {
  tree: IndividualTree | null;
  farm: DurianFarm;
  currentRole?: UserRole;
  onClose: () => void;
}

export const TreeDetailModal: React.FC<TreeDetailModalProps> = ({
  tree,
  farm,
  currentRole = 'user',
  onClose,
}) => {
  if (!tree) return null;

  // Segmented Tabs: 'passport' | 'diaries' | 'reviews'
  const [activeTab, setActiveTab] = useState<'passport' | 'diaries' | 'reviews'>('passport');

  // เริ่มจากรีวิวที่ติดมากับต้นไม้ก่อน แล้วค่อยแทนที่ด้วยข้อมูลล่าสุดจาก API
  // จะได้ไม่เห็นช่องว่างระหว่างรอโหลด
  const [reviewsList, setReviewsList] = useState<TreeReview[]>(tree.reviews || []);

  useEffect(() => {
    if (!tree) return;
    let cancelled = false;

    // ของเดิมใช้ onSnapshot ของ Firestore ที่อัปเดตเองแบบ realtime
    // ตอนนี้ดึงครั้งเดียวตอนเปิดหน้าต่าง ซึ่งพอสำหรับการอ่านรีวิว
    fetchTreeReviews(tree.code)
      .then((reviews) => {
        if (!cancelled) setReviewsList(reviews);
      })
      .catch((err) => {
        // โหลดรีวิวไม่สำเร็จไม่ควรทำให้ทั้งหน้าต่างพัง
        // ยังแสดงรีวิวที่ติดมากับข้อมูลต้นไม้ต่อไปได้
        console.warn('โหลดรีวิวของต้น', tree.code, 'ไม่สำเร็จ:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [tree]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-[#07190f] text-[#f3f6f4] w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-[#1c442c] overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Clean Hierarchy & Generous Spacing */}
        <div className="p-3.5 sm:p-4 px-4 sm:px-5 bg-[#07190f] border-b border-[#1c442c] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#143523] border border-[#225538] flex items-center justify-center text-[#E5A93C] shrink-0 shadow-xs">
              <Trees className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-extrabold text-[11px] bg-[#E5A93C]/20 text-[#F5D280] border border-[#E5A93C]/40 px-2 py-0.5 rounded-md">
                  {tree.code}
                </span>
                {tree.badge && (
                  <span className="text-[10px] font-bold bg-[#E5A93C] text-[#1c1202] px-2 py-0.5 rounded-full">
                    {tree.badge}
                  </span>
                )}
                <span className="text-[11px] text-[#83A893] truncate">
                  {farm.name}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight mt-0.5 truncate">
                {tree.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#83A893] hover:text-white hover:bg-[#0e2619] border border-[#1c442c] transition-colors cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stat Overview (Clean key metrics) */}
        <div className="px-4 sm:px-5 py-2 bg-[#092013] border-b border-[#1c442c] flex items-center justify-between gap-2 text-xs select-none">
          <div className="flex items-center gap-1.5">
            <span className="text-[#83A893]">ผลผลิต:</span>
            <span className="font-extrabold text-[#E5A93C] font-mono">{tree.yieldFruitCount} ลูก</span>
            <span className="text-[#83A893] text-[11px]">(~{tree.yieldWeightKg} กก.)</span>
          </div>

          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-[#E5A93C] fill-[#E5A93C]" />
            <span className="font-extrabold text-white">{tree.rating.toFixed(1)}</span>
            <span className="text-[#83A893] text-[11px]">({reviewsList.length} รีวิว)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#83A893]">อายุต้น:</span>
            <span className="font-bold text-[#F5D280]">{tree.ageYears} ปี</span>
          </div>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="px-4 sm:px-5 py-2 bg-[#07190f] border-b border-[#1c442c]">
          <div className="grid grid-cols-3 gap-1 bg-[#0e2619] p-1 rounded-xl border border-[#1c442c]">
            <button
              onClick={() => setActiveTab('passport')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'passport'
                  ? 'bg-[#E5A93C] text-[#1c1202] shadow-xs'
                  : 'text-[#83A893] hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ข้อมูลต้น</span>
            </button>

            <button
              onClick={() => setActiveTab('diaries')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'diaries'
                  ? 'bg-[#E5A93C] text-[#1c1202] shadow-xs'
                  : 'text-[#83A893] hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>บันทึกแปลง</span>
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-[#E5A93C] text-[#1c1202] shadow-xs'
                  : 'text-[#83A893] hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>รีวิว ({reviewsList.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 text-[#f3f6f4] text-xs flex-1">
          {/* TAB 1: TREE PASSPORT */}
          {activeTab === 'passport' && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 bg-[#0e2619] rounded-xl border border-[#1c442c] flex items-center justify-between">
                  <span className="text-[#83A893]">รหัสประจำต้น</span>
                  <span className="font-mono font-bold text-[#F5D280]">{tree.code}</span>
                </div>

                <div className="p-2.5 bg-[#0e2619] rounded-xl border border-[#1c442c] flex items-center justify-between">
                  <span className="text-[#83A893]">สายพันธุ์หลัก</span>
                  <span className="font-bold text-white">{tree.variety}</span>
                </div>

                <div className="p-2.5 bg-[#0e2619] rounded-xl border border-[#1c442c] flex items-center justify-between">
                  <span className="text-[#83A893] flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#E5A93C]" />
                    <span>วันที่เริ่มปลูก</span>
                  </span>
                  <span className="font-semibold text-white">
                    {tree.plantedDate || `${2026 - tree.ageYears}`}
                  </span>
                </div>

                <div className="p-2.5 bg-[#0e2619] rounded-xl border border-[#1c442c] flex items-center justify-between">
                  <span className="text-[#83A893]">วิธีขยายพันธุ์</span>
                  <span className="font-semibold text-white">
                    {tree.propagationLabel}
                  </span>
                </div>

                <div className="p-2.5 bg-[#0e2619] rounded-xl border border-[#1c442c] flex items-center justify-between">
                  <span className="text-[#83A893]">แปลง / โซน</span>
                  <span className="font-semibold text-white">{tree.zone}</span>
                </div>

                {tree.sweetnessBrix && (
                  <div className="p-2.5 bg-[#0e2619] rounded-xl border border-[#1c442c] flex items-center justify-between">
                    <span className="text-[#83A893] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#E5A93C]" />
                      <span>ความหวานเฉลี่ย</span>
                    </span>
                    <span className="font-bold text-[#E5A93C]">{tree.sweetnessBrix} °Brix</span>
                  </div>
                )}

                {tree.expectedHarvest && (
                  <div className="p-2.5 bg-[#0e2619] rounded-xl border border-[#1c442c] flex items-center justify-between sm:col-span-2">
                    <span className="text-[#83A893]">คาดการณ์ตัดผลผลิต</span>
                    <span className="font-semibold text-white">{tree.expectedHarvest}</span>
                  </div>
                )}
              </div>

              {tree.notes && (
                <div className="p-3 bg-[#0e2619] rounded-xl border border-[#1c442c] text-[#83A893] text-xs leading-relaxed">
                  <span className="font-bold text-white">บันทึก:</span> {tree.notes}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CARE DIARIES */}
          {activeTab === 'diaries' && (
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="p-3 rounded-xl bg-[#0e2619] border border-[#1c442c] flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#143523] text-[#E5A93C] flex items-center justify-center shrink-0 mt-0.5 border border-[#225538]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">ให้ปุ๋ยอินทรีย์มูลค้างคาว + ฮิวมัส</span>
                    <span className="text-[#83A893] font-mono text-[10px]">
                      {tree.lastFertilized || '10 ส.ค. 2026'}
                    </span>
                  </div>
                  <p className="text-[#83A893] text-[11px] mt-0.5 leading-relaxed">
                    บำรุงระบบรากและเสริมสร้างความสมบูรณ์ของใบสะสมอาหาร ดินมีความร่วนซุยดี
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0e2619] border border-[#1c442c] flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#143523] text-[#E5A93C] flex items-center justify-center shrink-0 mt-0.5 border border-[#225538]">
                  <Droplets className="w-3.5 h-3.5 text-[#4ADE80]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">ระบบรดน้ำมินิสปริงเกลอร์อัตโนมัติ</span>
                    <span className="text-[#83A893] font-mono text-[10px]">เมื่อวาน 06:30 น.</span>
                  </div>
                  <p className="text-[#83A893] text-[11px] mt-0.5 leading-relaxed">
                    ควบคุมความชื้นในดินภูเขาไฟที่ระดับ 65% ตามรอบวงการให้น้ำระบบ Smart Sensor
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0e2619] border border-[#1c442c] flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#143523] text-[#E5A93C] flex items-center justify-center shrink-0 mt-0.5 border border-[#225538]">
                  <Sprout className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">ตรวจความสมบูรณ์ของผลและแต่งกิ่ง</span>
                    <span className="text-[#83A893] font-mono text-[10px]">5 ส.ค. 2026</span>
                  </div>
                  <p className="text-[#83A893] text-[11px] mt-0.5 leading-relaxed">
                    คัดแต่งผลทรงสวยและติดแท็ก NFC รหัสต้น {tree.code} ทุกผลตามมาตรฐาน GI
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONSUMER REVIEWS (ELEGANT SPACIOUS NFC REVIEWS) */}
          {activeTab === 'reviews' && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Rating Summary Card (Identical to user reference) */}
              <div className="p-4 rounded-2xl bg-[#092013] border border-[#1c442c] flex items-center gap-5">
                <div className="text-left shrink-0">
                  <div className="text-3xl font-extrabold text-[#E5A93C] font-serif leading-none tracking-tight">
                    {tree.rating ? tree.rating.toFixed(1) : '5.0'}
                  </div>
                  <div className="flex items-center gap-0.5 mt-2 text-[#E5A93C]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-current" />
                    ))}
                  </div>
                </div>

                <div className="h-10 w-px bg-[#1c442c]/80" />

                <div className="space-y-1">
                  <div className="font-bold text-white text-xs">คะแนนเฉลี่ยต้นนี้</div>
                  <div className="text-[11px] text-[#83A893]">{reviewsList.length} รีวิวทั้งหมด</div>
                  <span className="inline-block font-mono text-[10px] text-[#4ADE80] bg-[#143523] border border-[#225538] px-2 py-0.5 rounded-md font-semibold">
                    {tree.code}
                  </span>
                </div>
              </div>

              {/* Section Header */}
              <div className="text-xs text-[#83A893] font-medium pt-0.5">
                รีวิวทั้งหมดที่ผูกกับต้นนี้
              </div>

              {/* Reviews List (Spacious & Clean) */}
              {reviewsList.length === 0 ? (
                <div className="p-6 text-center text-[#83A893] bg-[#092013] rounded-2xl border border-[#1c442c]">
                  <MessageSquare className="w-8 h-8 mx-auto text-[#1c442c] mb-2" />
                  <p className="font-semibold text-white text-xs">ยังไม่มีรีวิวสำหรับต้นนี้</p>
                  <p className="text-[11px] text-[#83A893] mt-1">
                    รีวิวจะปรากฏเมื่อผู้บริโภคสแกนแท็ก NFC ที่ขั้วทุเรียนของต้นนี้
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviewsList.map((rev) => {
                    // Clean tag format like #DUR-2026-0817-042 or #VK-MT01-F042
                    const cleanTag = rev.nfcFruitTag
                      ? rev.nfcFruitTag.replace(/NFC\s*Tag:\s*/i, '').trim()
                      : `#${tree.code}-F01`;

                    // Origin country based on reviewer name
                    const isForeign = /[a-zA-Z]/.test(rev.authorName);
                    const country = isForeign ? 'ต่างประเทศ' : 'ไทย';

                    return (
                      <div
                        key={rev.id}
                        className="p-4 rounded-2xl bg-[#092013] border border-[#1c442c] space-y-2.5"
                      >
                        {/* Top Row: Avatar + Name + Country & Rating Stars + Date */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#143523] text-[#E5A93C] border border-[#225538] flex items-center justify-center font-bold text-xs shrink-0">
                              {rev.authorName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white text-xs truncate">
                                {rev.authorName}
                              </div>
                              <div className="text-[10px] text-[#83A893] mt-0.5">
                                {country}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="flex items-center justify-end gap-0.5 text-[#E5A93C]">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < rev.rating ? 'fill-current' : 'text-[#1c442c]'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="text-[10px] text-[#83A893] mt-1 font-mono">
                              {rev.reviewDate}
                            </div>
                          </div>
                        </div>

                        {/* Review Content */}
                        <p className="text-xs text-[#f3f6f4] leading-relaxed">
                          "{rev.comment}"
                        </p>

                        {/* Tag string */}
                        <div className="text-[11px] font-mono text-[#83A893]/70 pt-0.5">
                          {cleanTag.startsWith('#') ? cleanTag : `#${cleanTag}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
