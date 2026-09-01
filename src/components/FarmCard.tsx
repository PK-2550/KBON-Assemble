import React from 'react';
import { Star, MapPin } from 'lucide-react';
import { DurianFarm } from '../types';

interface FarmCardProps {
  farm: DurianFarm;
  displayRank?: number;
  onSelectFarm: (farm: DurianFarm) => void;
}

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80';

/**
 * มุมมองการ์ดของฟาร์ม -- ข้อมูลชุดเดียวกับ FarmRow แต่มีรูปนำ
 *
 * จัดใหม่จากของเดิม 3 เรื่อง
 *   1. เอากล่องซ้อนกล่องออก ของเดิมมีกล่องพื้นเข้ม 3 ใบซ้อนอยู่ในการ์ดอีกที
 *      (จุดเด่น + จำนวนต้น + ผลผลิต) ทำให้ขอบเยอะจนลายตา
 *   2. เอาปุ่ม "เข้าชมแปลงต้นไม้" ออก ทั้งการ์ดกดได้อยู่แล้ว ปุ่มซ้ำหน้าที่เดิม
 *   3. ป้าย GI แสดงเฉพาะฟาร์มที่มีใบรับรองจริง ของเดิมเขียนตายตัวจึงขึ้นทุกใบ
 */
/** จำนวนตราสูงสุดในการ์ดหนึ่งใบ ที่เกินจากนี้ยุบเป็นตัวเลขนับ */
const MAX_BADGES = 2;

export const FarmCard: React.FC<FarmCardProps> = ({ farm, displayRank, onSelectFarm }) => {
  const rank = displayRank ?? farm.rank;
  const cover = farm.photos?.[0] ?? FALLBACK_PHOTO;
  // ตราใบรับรอง -- เอาเฉพาะใบที่ผ่านการตรวจของแอดมินแล้ว
  // เกณฑ์เดียวกับ FarmRow และแถบตราในหน้ารายละเอียดฟาร์ม
  // เดิมอ่านจาก farm.certifications ซึ่งเป็น array ข้อความชุดเก่าที่ไม่มีสถานะการตรวจ
  const approvedCerts = (farm.certificationDetails ?? []).filter((c) =>
    c.approvalStatus ? c.approvalStatus === 'approved' : c.verified
  );
  const shownCerts = approvedCerts.slice(0, MAX_BADGES);
  const hiddenCertCount = approvedCerts.length - shownCerts.length;

  return (
    <article
      id={`farm-card-${farm.id}`}
      onClick={() => onSelectFarm(farm)}
      className="bg-surface rounded-2xl overflow-hidden border border-line hover:border-line-strong transition-colors cursor-pointer group"
    >
      <div className="relative h-32 sm:h-36 bg-well overflow-hidden">
        <img
          src={cover}
          alt={farm.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
        />
        {/* ไล่เฉดจากล่างขึ้นบน ให้ตัวเลขอ่านออกไม่ว่ารูปจะสว่างแค่ไหน */}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/50 to-transparent" />

        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-canvas/80 text-fg text-xs font-bold tabular-nums">
          {rank}
        </span>

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-canvas/80">
          <Star className="w-3 h-3 text-gold fill-gold" />
          <span className="text-fg text-xs font-bold tabular-nums">{farm.rating.toFixed(1)}</span>
        </div>
      </div>

      <div className="p-3.5 space-y-2">
        <div className="flex items-start gap-1.5">
          <h2 className="flex-1 min-w-0 text-sm font-bold text-fg leading-snug line-clamp-2 group-hover:text-gold-soft transition-colors">
            {farm.name}
          </h2>
          {shownCerts.map((c) => (
            <span
              key={c.shortCode}
              className="shrink-0 mt-0.5 px-1.5 py-px text-[9px] font-bold text-fg-2 border border-line-strong rounded"
            >
              {c.shortCode}
            </span>
          ))}
          {hiddenCertCount > 0 && (
            <span className="shrink-0 mt-0.5 px-1.5 py-px text-[9px] font-bold text-fg-3 border border-line rounded">
              +{hiddenCertCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-fg-2">
          <MapPin className="w-3 h-3 text-fg-4 shrink-0" />
          <span className="truncate">{farm.province}</span>
        </div>

        {/* สถิติเรียงเป็นบรรทัดเดียว แทนการใส่กล่องแยกใบละตัวเลข */}
        <div className="flex items-center gap-3 text-xs text-fg-2 pt-1.5 border-t border-line tabular-nums">
          <span>
            <strong className="text-fg font-semibold">
              {farm.harvestedFruits.toLocaleString()}
            </strong>{' '}
            ผลผลิต
          </span>
          <span className="text-line-strong">·</span>
          <span>
            <strong className="text-fg font-semibold">{farm.totalTrees.toLocaleString()}</strong> ต้น
          </span>
        </div>
      </div>
    </article>
  );
};
