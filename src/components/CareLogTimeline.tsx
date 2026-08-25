import React, { useEffect, useState } from 'react';
import {
  Droplets,
  Sprout,
  Scissors,
  SprayCan,
  PackageOpen,
  ClipboardCheck,
  CircleDot,
  ImageIcon,
  X,
  Loader2,
} from 'lucide-react';
import {
  fetchCareLogs,
  fetchCareLogPhotos,
  CARE_ACTIVITY_LABELS,
  type CareLog,
  type CareLogPhoto,
  type CareActivityType,
} from '../services/careLogService';

interface CareLogTimelineProps {
  treeCode: string;
}

const ACTIVITY_ICONS: Record<CareActivityType, React.ComponentType<{ className?: string }>> = {
  watering: Droplets,
  fertilizing: Sprout,
  pruning: Scissors,
  spraying: SprayCan,
  harvesting: PackageOpen,
  inspection: ClipboardCheck,
  other: CircleDot,
};

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** แปลง 2026-08-16 เป็น 16 ส.ค. 2569 */
function formatThaiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

/**
 * ประวัติการดูแลต้นไม้ เรียงจากล่าสุดไปเก่าสุด
 *
 * ข้อมูลมาจากระบบของสวนผ่านช่องทางนำเข้า ไม่ได้ให้คนกรอกในหน้านี้
 * แต่ละรายการมีรูปแนบได้หลายรูป ซึ่งดึงเฉพาะตอนกดดู
 */
export const CareLogTimeline: React.FC<CareLogTimelineProps> = ({ treeCode }) => {
  const [logs, setLogs] = useState<CareLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // รูปของรายการที่กำลังเปิดดู เก็บแยกจากตัวรายการเพราะดึงทีหลัง
  const [viewing, setViewing] = useState<CareLog | null>(null);
  const [photos, setPhotos] = useState<CareLogPhoto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLogs(null);
    setError(null);

    fetchCareLogs(treeCode)
      .then((list) => {
        if (!cancelled) setLogs(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'โหลดประวัติการดูแลไม่สำเร็จ');
          setLogs([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [treeCode]);

  const openPhotos = async (log: CareLog) => {
    setViewing(log);
    setPhotos(null);
    try {
      setPhotos(await fetchCareLogPhotos(log.id));
    } catch {
      setPhotos([]);
    }
  };

  if (logs === null) {
    return (
      <div className="bg-surface rounded-2xl border border-line p-8 flex items-center justify-center gap-2 text-fg-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">กำลังโหลดประวัติการดูแล</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-line p-8 text-center">
        <ClipboardCheck className="w-8 h-8 mx-auto text-line-strong mb-2.5" />
        <p className="font-bold text-sm text-fg">ยังไม่มีประวัติการดูแลของต้นนี้</p>
        <p className="text-xs text-fg-2 mt-1.5 leading-relaxed">
          {error ?? 'ข้อมูลจะปรากฏเมื่อระบบของสวนส่งบันทึกการดูแลเข้ามา'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface rounded-2xl border border-line divide-y divide-line">
        {logs.map((log) => {
          const Icon = ACTIVITY_ICONS[log.activityType] ?? CircleDot;
          const title = log.activityLabel || CARE_ACTIVITY_LABELS[log.activityType];

          return (
            <div key={log.id} className="flex items-start gap-3 p-4">
              <div className="w-8 h-8 shrink-0 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-fg-3">
                <Icon className="w-4 h-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-xs sm:text-sm text-fg truncate">{title}</span>
                  <span className="text-[11px] text-fg-2 shrink-0 tabular-nums">
                    {formatThaiDate(log.performedAt)}
                  </span>
                </div>

                {log.notes && (
                  <p className="text-[11px] sm:text-xs text-fg-2 mt-1 leading-relaxed">
                    {log.notes}
                  </p>
                )}

                {log.photoCount > 0 && (
                  <button
                    onClick={() => openPhotos(log)}
                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 border border-line hover:border-line-strong text-[11px] font-bold text-fg-2 hover:text-fg transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>ดูรูป {log.photoCount} รูป</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* หน้าต่างดูรูปแนบ -- เรียงในแนวตั้งให้เลื่อนดู แบบเดียวกับแกลเลอรีของฟาร์ม */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-canvas/95 backdrop-blur-sm animate-in fade-in"
          onClick={() => setViewing(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-canvas/90 backdrop-blur-md border-b border-line">
            <div className="min-w-0">
              <div className="text-sm font-bold text-fg truncate">
                {viewing.activityLabel || CARE_ACTIVITY_LABELS[viewing.activityType]}
              </div>
              <div className="text-[11px] text-fg-2 tabular-nums">
                {formatThaiDate(viewing.performedAt)} · {treeCode}
              </div>
            </div>
            <button
              onClick={() => setViewing(null)}
              className="shrink-0 p-2 rounded-xl text-fg-2 hover:text-fg hover:bg-surface transition-colors cursor-pointer"
              aria-label="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="h-[calc(100vh-64px)] overflow-y-auto px-4 py-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {photos === null ? (
              <div className="flex items-center justify-center gap-2 py-12 text-fg-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">กำลังโหลดรูป</span>
              </div>
            ) : photos.length === 0 ? (
              <p className="py-12 text-center text-xs text-fg-2">โหลดรูปไม่สำเร็จ</p>
            ) : (
              photos.map((p, idx) => (
                <figure
                  key={idx}
                  className="rounded-2xl overflow-hidden border border-line bg-surface"
                >
                  {/* ไม่ใช้ loading="lazy" ด้วยเหตุผลเดียวกับแกลเลอรีของฟาร์ม
                      native lazy loading ไม่เริ่มโหลดรูปในกล่องที่เลื่อนเอง */}
                  <img
                    src={p.photo}
                    alt={p.caption ?? `รูปการดูแลที่ ${idx + 1}`}
                    className="w-full object-contain min-h-[220px] max-h-[75vh] bg-canvas"
                  />
                  <figcaption className="px-3 py-2 text-[11px] text-fg-2">
                    {p.caption ?? `${idx + 1} / ${photos.length}`}
                  </figcaption>
                </figure>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};
