import React, { useState } from 'react';
import {
  X,
  Trees,
  Star,
  BookOpen,
  Calendar,
  MapPin,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Heart,
  Droplets,
  Sprout,
  Radio,
  MessageSquare,
  Send,
  UserCheck,
  Tag,
  ThumbsUp,
  Camera,
} from 'lucide-react';
import { IndividualTree, DurianFarm, TreeReview } from '../types';

interface TreeDetailModalProps {
  tree: IndividualTree | null;
  farm: DurianFarm;
  onClose: () => void;
}

export const TreeDetailModal: React.FC<TreeDetailModalProps> = ({
  tree,
  farm,
  onClose,
}) => {
  if (!tree) return null;

  // Local state for interactive review submission
  const [reviewsList, setReviewsList] = useState<TreeReview[]>(tree.reviews || []);
  const [isAddingReview, setIsAddingReview] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [nfcFruitNumber, setNfcFruitNumber] = useState(
    `NFC Tag: #${tree.code}-F${Math.floor(Math.random() * 80 + 1).toString().padStart(3, '0')}`
  );
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [tastingTag, setTastingTag] = useState('หวานมันกลมกล่อม 34 Brix');

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !newComment.trim()) return;

    const newReview: TreeReview = {
      id: `rev-new-${Date.now()}`,
      authorName: authorName.trim(),
      nfcFruitTag: nfcFruitNumber.trim(),
      rating: newRating,
      reviewDate: 'วันนี้ (เพิ่งสแกน)',
      comment: newComment.trim(),
      verifiedNfc: true,
      tastingNotes: [tastingTag, 'สแกน NFC ยืนยันผลแท้', 'ตรวจย้อนกลับสำเร็จ'],
    };

    setReviewsList([newReview, ...reviewsList]);
    setAuthorName('');
    setNewComment('');
    setIsAddingReview(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Tree Code & Variety */}
        <div className="bg-slate-900 text-white p-5 px-6 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Trees className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-sm">
                  {tree.code}
                </span>
                {tree.badge && (
                  <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded-xs">
                    {tree.badge}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  {tree.categoryLabel}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                {tree.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-xs divide-y divide-slate-100">
          {/* Section 1: Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-0">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] text-slate-400 font-medium">ผลผลิตต่อต้น</span>
              <div className="text-lg font-bold text-emerald-600 mt-0.5 font-mono">
                {tree.yieldFruitCount} <span className="text-xs font-sans font-normal text-slate-500">ลูก</span>
              </div>
              <span className="text-[10px] text-slate-400">~{tree.yieldWeightKg} กก.</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] text-slate-400 font-medium">คะแนนความนิยม</span>
              <div className="flex items-center gap-1 text-lg font-bold text-slate-900 mt-0.5">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>{tree.rating.toFixed(1)}</span>
                <span className="text-[10px] font-normal text-slate-400">/ 10</span>
              </div>
              <span className="text-[10px] text-slate-400">{reviewsList.length} รีวิวผู้บริโภค</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] text-slate-400 font-medium">บันทึกการดูแล</span>
              <div className="flex items-center gap-1 text-lg font-bold text-slate-900 mt-0.5">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span>{tree.diariesCount}</span>
                <span className="text-xs font-normal text-slate-500">ครั้ง</span>
              </div>
              <span className="text-[10px] text-slate-400">สมุดบันทึกแปลง</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] text-slate-400 font-medium">อายุต้น / วันที่เริ่มปลูก</span>
              <div className="text-lg font-bold text-slate-800 mt-0.5">
                {tree.ageYears} <span className="text-xs font-normal text-slate-500">ปี</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-medium block truncate">
                🌱 ปลูกเมื่อ {tree.plantedDate || `${2026 - tree.ageYears}`}
              </span>
            </div>
          </div>

          {/* Section 2: Detailed Tree Attributes (Passport) */}
          <div className="pt-5 space-y-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ข้อมูลประจำต้นและประวัติการเพาะปลูก (Tree Passport)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-500">รหัสประจำต้น (UID):</span>
                <span className="font-mono font-bold text-slate-900">{tree.code}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-500">สายพันธุ์หลัก:</span>
                <span className="font-bold text-emerald-800">{tree.variety}</span>
              </div>

              {/* วันที่เริ่มปลูก (Planted Date) - Added as requested */}
              <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
                <span className="text-emerald-900 font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>วันที่เริ่มปลูก:</span>
                </span>
                <span className="font-bold text-emerald-800 font-mono">
                  {tree.plantedDate || `${tree.ageYears} ปี`}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-500">วิธีขยายพันธุ์:</span>
                <span className="font-semibold text-slate-800">
                  {tree.propagationLabel} ({tree.propagationCode})
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-500">แปลงปลูก / โซน:</span>
                <span className="font-semibold text-slate-800">{tree.zone}</span>
              </div>

              {tree.sweetnessBrix && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500">ค่าความหวานเฉลี่ย:</span>
                  <span className="font-bold text-amber-600">{tree.sweetnessBrix} °Brix</span>
                </div>
              )}

              {tree.expectedHarvest && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500">คาดการณ์ตัดผลผลิต:</span>
                  <span className="font-semibold text-slate-800">{tree.expectedHarvest}</span>
                </div>
              )}
            </div>

            {tree.notes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-slate-600 text-xs leading-relaxed">
                <span className="font-bold text-slate-800">หมายเหตุจากผู้ดูแลแปลง:</span> {tree.notes}
              </div>
            )}
          </div>

          {/* Section 3: Care Diary Log Sample */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>บันทึกการดูแลล่าสุด (Care Diaries)</span>
              </h4>
              <span className="text-[11px] text-slate-400">ทั้งหมด {tree.diariesCount} รายการ</span>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/60 rounded-lg flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-800">ให้ปุ๋ยอินทรีย์บำรุงต้น + ฮิวมัสภูเขาไฟ</div>
                  <div className="text-[11px] text-slate-500">บันทึกเมื่อ: {tree.lastFertilized || '12 ส.ค. 2026'} โดย หัวหน้าแปลง</div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5">
                <Droplets className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-800">ระบบให้น้ำสปริงเกลอร์ตรวจวัดความชื้นดิน (45 นาที)</div>
                  <div className="text-[11px] text-slate-500">บันทึกเมื่อ: 18 ส.ค. 2026 โดย ระบบ Smart Agri IOT</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Customer Reviews with Scanned NFC Fruit Tags (BOTTOM SECTION as requested) */}
          <div className="pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span>รีวิวจากผู้ที่สแกน NFC ลูกทุเรียนจากต้นนี้</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ผู้บริโภคที่ซื้อและสแกนแท็ก NFC บนขั้วผลทุเรียนที่ตัดจากต้น {tree.code}
                </p>
              </div>

              <button
                onClick={() => setIsAddingReview(!isAddingReview)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{isAddingReview ? 'ปิดฟอร์มรีวิว' : 'จำลองสแกน NFC / เขียนรีวิว'}</span>
              </button>
            </div>

            {/* Interactive Add Review / NFC Simulation Form */}
            {isAddingReview && (
              <form
                onSubmit={handleAddReview}
                className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3 animate-in fade-in"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-200 text-emerald-900 font-bold text-xs">
                  <Radio className="w-4 h-4 text-emerald-600" />
                  <span>จำลองการแตะสแกนแท็ก NFC ที่ขั้วทุเรียน & รีวิวต้นนี้</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ชื่อ-นามสกุล ผู้รีวิว:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น คุณกมลวรรณ หรือ K. Alex"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      รหัสแท็ก NFC ที่ตรวจพบจากขั้วผล (Tag NFC):
                    </label>
                    <input
                      type="text"
                      required
                      value={nfcFruitNumber}
                      onChange={(e) => setNfcFruitNumber(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 font-mono font-bold rounded-lg text-xs focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      คะแนนความพึงพอใจ:
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setNewRating(star)}
                          className="cursor-pointer"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= newRating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-2 font-bold text-slate-700">{newRating} / 5</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      รสสัมผัส / รสชาติเด่น:
                    </label>
                    <input
                      type="text"
                      value={tastingTag}
                      onChange={(e) => setTastingTag(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ความคิดเห็นและรีวิวผลผลิต:
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="เล่ารสชาติทุเรียนที่ได้รับ เนื้อสัมผัส ความหวาน และประสบการณ์สแกน NFC..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingReview(false)}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-xs"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>บันทึกรีวิว NFC</span>
                  </button>
                </div>
              </form>
            )}

            {/* List of Reviews */}
            <div className="space-y-3">
              {reviewsList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  ยังไม่มีรีวิวสำหรับต้นนี้ เป็นคนแรกที่สแกน NFC และเขียนรีวิว!
                </div>
              ) : (
                reviewsList.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5 transition-all hover:border-slate-300"
                  >
                    {/* Review Header: Name with (NFC Tag in parentheses) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Author Avatar or Initial */}
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                          {rev.avatarUrl ? (
                            <img
                              src={rev.avatarUrl}
                              alt={rev.authorName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            rev.authorName.charAt(0)
                          )}
                        </div>

                        {/* Author Name + IN PARENTHESES: NFC Tag scanned by this user */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {rev.authorName}
                          </span>
                          
                          {/* Parentheses with Scanned NFC Tag */}
                          <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md font-semibold">
                            ({rev.nfcFruitTag})
                          </span>
                        </div>
                      </div>

                      {/* Rating Stars & Date */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {rev.reviewDate}
                        </span>
                      </div>
                    </div>

                    {/* Review Comment */}
                    <p className="text-slate-700 text-xs leading-relaxed pl-9">
                      "{rev.comment}"
                    </p>

                    {/* Tasting Tags & Verified NFC Badge */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1 pl-9">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rev.tastingNotes?.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {rev.verifiedNfc && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>ยืนยันผลแท้ผ่านชิป NFC</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            ฟาร์ม: <span className="font-bold text-slate-800">{farm.name}</span> • แปลง: <span className="font-semibold text-slate-700">{tree.zone}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
