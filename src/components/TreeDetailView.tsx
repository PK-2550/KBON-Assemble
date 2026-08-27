import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  Calendar,
  Sparkles,
  MessageSquare,
  Droplets,
  Sprout,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { IndividualTree, DurianFarm, TreeReview, UserRole, NfcScannedFruit } from '../types';
import { fetchTreeReviews } from '../services/farmService';
import { useAuth } from '../context/AuthContext';
import { CareLogTimeline } from './CareLogTimeline';
import { TreeReviewForm } from './TreeReviewForm';

interface TreeDetailViewProps {
  tree: IndividualTree;
  farm: DurianFarm;
  currentRole?: UserRole;
  /**
   * ผลที่ผู้ใช้เพิ่งสแกนแท็ก NFC มา
   *
   * มีค่าเฉพาะตอนที่เข้ามาถึงหน้านี้ด้วยการสแกนจริง ถ้าเดินเข้ามาจากหน้าฟาร์ม
   * จะไม่มีค่า และฟอร์มเขียนรีวิวจะไม่แสดง ตามกติกาเดิมของระบบ
   */
  scannedFruit?: NfcScannedFruit;
  onBack: () => void;
}

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80';

/** ตัวเลขหนึ่งตัวในแถบสถิติของต้นไม้ */
const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0">
    <div className="text-lg sm:text-xl font-black text-fg tabular-nums leading-none">{value}</div>
    <div className="text-[11px] text-fg-2 mt-1.5 truncate">{label}</div>
  </div>
);

/** แถวข้อมูลหนึ่งบรรทัดในพาสปอร์ตต้นไม้ */
const Row: React.FC<{ label: React.ReactNode; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 text-xs sm:text-sm">
    <span className="text-fg-2 shrink-0">{label}</span>
    <span className="font-semibold text-fg text-right min-w-0 truncate">{value}</span>
  </div>
);

/**
 * หน้ารายละเอียดต้นไม้
 *
 * เดิมเป็นหน้าต่างซ้อน (modal) ที่มีกรอบและปุ่มปิด ทำให้พื้นที่แสดงผลถูกบีบ
 * และบนมือถือต้องเลื่อนอ่านเนื้อหาในกล่องเล็ก ๆ อีกที
 * เปลี่ยนเป็นหน้าเต็มแบบเดียวกับหน้า strain ของต้นแบบ
 */
export const TreeDetailView: React.FC<TreeDetailViewProps> = ({ tree, farm, scannedFruit, onBack }) => {
  const [activeTab, setActiveTab] = useState<'passport' | 'diaries' | 'reviews'>('passport');

  // เริ่มจากรีวิวที่ติดมากับข้อมูลต้นไม้ แล้วแทนที่ด้วยของล่าสุดจาก API
  const [reviewsList, setReviewsList] = useState<TreeReview[]>(tree.reviews || []);

  const { currentUser } = useAuth();

  // ต้องล็อกอิน และต้องสแกนแท็กของต้นนี้มาจริง จึงจะเขียนรีวิวได้
  const canReview = Boolean(currentUser) && scannedFruit?.treeCode === tree.code;

  useEffect(() => {
    let cancelled = false;
    fetchTreeReviews(tree.code)
      .then((reviews) => {
        if (!cancelled) setReviewsList(reviews);
      })
      .catch((err) => {
        console.warn('โหลดรีวิวของต้น', tree.code, 'ไม่สำเร็จ:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [tree.code]);

  const photo = farm.photos?.[0] ?? FALLBACK_PHOTO;

  // น้ำหนักเฉลี่ยต่อลูก -- เทียบเท่าค่า g/plant ของต้นแบบ
  const avgWeight =
    tree.yieldFruitCount > 0 ? (tree.yieldWeightKg / tree.yieldFruitCount).toFixed(1) : null;

  const tabs = [
    { id: 'passport' as const, icon: ShieldCheck, label: 'ข้อมูลต้น' },
    { id: 'diaries' as const, icon: Sprout, label: 'ประวัติการดูแล' },
    { id: 'reviews' as const, icon: MessageSquare, label: `รีวิว (${reviewsList.length})` },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-fg-2 hover:text-fg transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="truncate">กลับไป {farm.name}</span>
      </button>

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        {/* หัวเรื่อง -- รูปต้นไม้คู่กับรหัสและชื่อ แบบเดียวกับหน้า strain ของต้นแบบ */}
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5 sm:gap-5">
            <div className="shrink-0 w-[38%] max-w-[170px] aspect-3/4 rounded-2xl overflow-hidden border border-line bg-canvas">
              <img
                src={photo}
                alt={tree.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-fg-3">{tree.code}</span>
                {tree.badge && (
                  <span className="px-1.5 py-px text-[9px] font-bold text-fg-2 border border-line-strong rounded">
                    {tree.badge}
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-fg tracking-tight leading-tight mt-1.5">
                {tree.name}
              </h1>

              <div className="text-xs sm:text-sm text-fg-2 mt-1.5 truncate">
                {tree.variety}
                {tree.zone ? ` · ${tree.zone}` : ''}
              </div>
            </div>
          </div>

          {/* สถิติของต้น -- คะแนน ผลผลิต น้ำหนักเฉลี่ยต่อลูก และจำนวนรีวิว */}
          <div className="grid grid-cols-4 gap-x-3 py-4 border-y border-line">
            <Stat
              label="คะแนนรีวิว"
              value={
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-gold fill-gold" />
                  <span className="text-gold">{tree.rating.toFixed(1)}</span>
                </span>
              }
            />
            <Stat label="ผลผลิต (ลูก)" value={tree.yieldFruitCount.toLocaleString()} />
            <Stat label="กก./ลูก" value={avgWeight ?? '—'} />
            <Stat label="รีวิว" value={reviewsList.length.toLocaleString()} />
          </div>

          {tree.notes && (
            <p className="text-xs sm:text-sm text-fg-2 leading-relaxed">{tree.notes}</p>
          )}
        </div>

        {/* แท็บ */}
        <div className="flex border-t border-line">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer border-b-2 ${
                activeTab === t.id
                  ? 'border-gold text-fg'
                  : 'border-transparent text-fg-2 hover:text-fg'
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ข้อมูลต้น */}
      {activeTab === 'passport' && (
        <div className="bg-surface rounded-2xl border border-line px-4 sm:px-5 divide-y divide-line">
          <Row label="รหัสประจำต้น" value={<span className="font-mono">{tree.code}</span>} />
          <Row label="สายพันธุ์" value={tree.variety} />
          <Row
            label={
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                วันที่เริ่มปลูก
              </span>
            }
            value={tree.plantedDate || `${2026 - tree.ageYears}`}
          />
          <Row label="อายุต้น" value={`${tree.ageYears} ปี`} />
          <Row label="วิธีขยายพันธุ์" value={tree.propagationLabel} />
          {tree.zone && <Row label="แปลง / โซน" value={tree.zone} />}
          {tree.sweetnessBrix && (
            <Row
              label={
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  ความหวานเฉลี่ย
                </span>
              }
              value={<span className="text-gold">{tree.sweetnessBrix} °Brix</span>}
            />
          )}
          {tree.expectedHarvest && <Row label="คาดการณ์ตัดผลผลิต" value={tree.expectedHarvest} />}
          <Row label="ผลผลิตรวม" value={`${tree.yieldWeightKg.toLocaleString()} กก.`} />
        </div>
      )}

      {/* ประวัติการดูแล -- ข้อมูลจริงจากระบบของสวน ไม่ใช่ตัวอย่างอีกแล้ว */}
      {activeTab === 'diaries' && <CareLogTimeline treeCode={tree.code} />}

      {/* รีวิว */}
      {activeTab === 'reviews' && (
        <div className="space-y-3">
          <div className="bg-surface rounded-2xl border border-line p-4 flex items-center gap-5">
            <div className="shrink-0">
              <div className="text-3xl font-black text-gold tabular-nums leading-none">
                {tree.rating.toFixed(1)}
              </div>
              <div className="flex items-center gap-0.5 mt-2 text-gold">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${
                      i < Math.round(tree.rating / 2) ? 'fill-current' : 'text-line-strong'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="h-12 w-px bg-line" />

            <div className="min-w-0">
              <div className="font-bold text-fg text-sm">คะแนนเฉลี่ยต้นนี้</div>
              <div className="text-xs text-fg-2 mt-0.5 tabular-nums">
                จาก {reviewsList.length} รีวิว
              </div>
            </div>
          </div>

          {/* กติกาเดิมของระบบ -- เขียนรีวิวได้ต่อเมื่อสแกนแท็ก NFC ที่ขั้วผลจากต้นนี้
              ทำให้รีวิวทุกรายการผูกกับผลจริงที่ซื้อไป ไม่ใช่ใครก็มาให้คะแนนได้

              เทียบรหัสต้นด้วย ไม่ได้ดูแค่ว่ามีการสแกนมา เพราะผู้ใช้อาจสแกนผลของต้นหนึ่ง
              แล้วเดินไปดูอีกต้นหนึ่ง ซึ่งไม่ควรเขียนรีวิวให้ต้นที่ไม่ได้ถือผลอยู่ */}
          {canReview ? (
            <TreeReviewForm
              treeCode={tree.code}
              scannedFruit={scannedFruit!}
              onSubmitted={(created) => setReviewsList((prev) => [created, ...prev])}
            />
          ) : (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-surface border border-line">
              <Radio className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <p className="text-[11px] sm:text-xs text-fg-2 leading-relaxed">
                {currentUser
                  ? 'เขียนรีวิวได้เฉพาะผู้ที่สแกนแท็ก NFC ที่ขั้วผลจากต้นนี้แล้วเท่านั้น ทุกรีวิวจึงผูกกับผลจริงที่ตรวจสอบย้อนกลับได้'
                  : 'เขียนรีวิวได้เฉพาะผู้ที่เข้าสู่ระบบแล้วและสแกนแท็ก NFC ที่ขั้วผลจากต้นนี้ ทุกรีวิวจึงผูกกับผลจริงที่ตรวจสอบย้อนกลับได้'}
              </p>
            </div>
          )}

          {reviewsList.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-line p-8 text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-line-strong mb-2.5" />
              <p className="font-bold text-sm text-fg">ยังไม่มีรีวิวสำหรับต้นนี้</p>
              <p className="text-xs text-fg-2 mt-1.5 leading-relaxed">
                รีวิวจะปรากฏเมื่อผู้บริโภคสแกนแท็ก NFC ที่ขั้วผลของต้นนี้
              </p>
            </div>
          ) : (
            reviewsList.map((rev) => {
              const tag = rev.nfcFruitTag
                ? rev.nfcFruitTag.replace(/NFC\s*Tag:\s*/i, '').trim()
                : `#${tree.code}`;

              return (
                <article
                  key={rev.id}
                  className="bg-surface rounded-2xl border border-line p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-surface-2 border border-line-strong text-fg-2 flex items-center justify-center font-bold text-sm shrink-0">
                        {rev.authorName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-fg text-xs sm:text-sm truncate">
                          {rev.authorName}
                        </div>
                        <div className="text-[11px] text-fg-2 tabular-nums">{rev.reviewDate}</div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-gold fill-gold" />
                      <span className="font-bold text-sm text-fg tabular-nums">{rev.rating}</span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-fg leading-relaxed">{rev.comment}</p>

                  {rev.tastingNotes && rev.tastingNotes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {rev.tastingNotes.map((note, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full bg-surface-2 border border-line text-[11px] text-fg-2"
                        >
                          {note}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-fg-4 font-mono pt-0.5">
                    {rev.verifiedNfc && <ShieldCheck className="w-3.5 h-3.5 text-leaf" />}
                    <span>{tag.startsWith('#') ? tag : `#${tag}`}</span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
