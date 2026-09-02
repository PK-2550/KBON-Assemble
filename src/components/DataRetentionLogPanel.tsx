import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Loader2, Eraser, Clock, XCircle } from 'lucide-react';
import {
  fetchDataRetentionReport,
  type DataRetentionReport,
} from '../services/dataRetentionService';

/**
 * รายงานการล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธ
 *
 * ตอบสองเรื่อง คือเคยล้างอะไรไปบ้าง และงานล้างยังทำงานอยู่หรือเปล่า
 *
 * เรื่องหลังสำคัญกว่า เพราะประวัติที่ว่างเปล่าตีความได้ทั้งสองทาง
 * คือปกติแต่ยังไม่มีอะไรถึงกำหนด กับตัวตั้งเวลาหยุดไปแล้วและข้อมูลส่วนตัว
 * กำลังค้างอยู่เกินกำหนดโดยไม่มีใครรู้
 */

/** วันที่แบบไทย คืนขีดเมื่อไม่มีค่า ไม่ใช่วันที่มั่ว ๆ จากค่าว่าง */
function thaiDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STAT_CLASS = 'p-3 bg-panel border border-line rounded-2xl space-y-1';

export const DataRetentionLogPanel: React.FC = () => {
  const [report, setReport] = useState<DataRetentionReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void fetchDataRetentionReport()
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((err) => {
        // ไม่กลืน error ทิ้งเหมือนส่วนอื่น ถ้าโหลดพังแล้วโชว์ค้าง 0 รายการ
        // แอดมินจะเข้าใจว่าไม่มีอะไรต้องทำ ทั้งที่ยังไม่รู้อะไรเลย
        if (!cancelled) setError(err instanceof Error ? err.message : 'โหลดรายงานไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-xs text-fg-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>กำลังโหลดบันทึกการล้างข้อมูล...</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#05140c] p-3 sm:p-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs font-bold text-rose-300">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error || 'โหลดรายงานไม่สำเร็จ'}</span>
        </div>
      </div>
    );
  }

  const { entries, summary } = report;

  return (
    <div className="flex-1 overflow-y-auto bg-[#05140c] p-3 sm:p-4 space-y-3">
      <div className="flex items-start gap-2 p-3 bg-well border border-line rounded-2xl text-[11px] text-fg-2 leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-gold shrink-0 mt-0.5" />
        <p>
          คำขอที่ถูกปฏิเสธจะถูกล้างข้อมูลส่วนตัวทิ้งหลังผ่านไป {summary.retentionDays} วัน
          นับจากวันที่ปฏิเสธ ตัวแถวคำขอยังอยู่ ร่องรอยการตัดสินของผู้ดูแลจึงไม่หาย
          บันทึกนี้เก็บแค่ชื่อฟิลด์ที่ถูกล้าง ไม่เคยเก็บค่าที่ลบไป
        </p>
      </div>

      {/*
        สัญญาณว่างานล้างหยุดทำงาน

        ถ้ามีแถวเลยกำหนดแล้วยังไม่ถูกล้าง แปลว่าตัวตั้งเวลาไม่ได้ทำงาน
        และข้อมูลส่วนตัวกำลังค้างอยู่เกินกำหนด ซึ่งต้องเห็นทันทีที่เปิดหน้านี้
      */}
      {summary.overdueCount > 0 ? (
        <div
          data-testid="retention-overdue-alert"
          className="flex items-start gap-2 px-3 py-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-[11px] text-rose-300"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <p>
            <span className="font-bold">
              มี {summary.overdueCount} คำขอที่เลยกำหนดแล้วแต่ยังไม่ถูกล้าง
            </span>
            <br />
            งานล้างอัตโนมัติอาจไม่ได้ทำงาน สั่งล้างเองได้ด้วยคำสั่ง npm run purge:rejected
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-leaf/50 rounded-xl text-[11px] font-bold text-leaf">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>งานล้างข้อมูลทำงานตามกำหนด ไม่มีรายการค้างเกินกำหนด</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className={STAT_CLASS}>
          <p className="text-[11px] text-fg-2">ล้างไปแล้วทั้งหมด</p>
          <p className="text-sm font-black text-white">{summary.totalPurged} คำขอ</p>
        </div>
        <div className={STAT_CLASS}>
          <p className="text-[11px] text-fg-2">รอถึงกำหนดล้าง</p>
          <p data-testid="retention-pending-count" className="text-sm font-black text-white">
            {summary.pendingCount} คำขอ
          </p>
        </div>
        <div className={STAT_CLASS}>
          <p className="text-[11px] text-fg-2">ครบกำหนดรายการถัดไป</p>
          <p data-testid="retention-next-due" className="text-sm font-black text-white">
            {thaiDate(summary.nextDueAt)}
          </p>
        </div>
        <div className={STAT_CLASS}>
          <p className="text-[11px] text-fg-2">ล้างครั้งล่าสุด</p>
          <p className="text-sm font-black text-white">{thaiDate(summary.lastPurgedAt)}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="py-12 text-center text-xs text-fg-2 space-y-2 px-4">
          <Eraser className="w-10 h-10 mx-auto text-line" />
          <p className="font-semibold text-white">ยังไม่เคยมีการล้างข้อมูล</p>
          <p className="text-[11px]">
            เมื่อมีคำขอที่ถูกปฏิเสธครบ {summary.retentionDays} วัน รายการจะปรากฏที่นี่
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="p-3 bg-panel border border-line rounded-2xl space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-white">{e.farmRequestId}</span>
                <span className="flex items-center gap-1 text-[11px] text-fg-2">
                  <Clock className="w-3 h-3 shrink-0" />
                  ล้างเมื่อ {thaiDate(e.purgedAt)}
                  {' · '}
                  {e.triggerSource === 'auto' ? 'ตัวตั้งเวลา' : 'สั่งเอง'}
                </span>
              </div>

              <p className="text-[11px] text-fg-2">
                ปฏิเสธเมื่อ {thaiDate(e.rejectedAt)} · ล้าง {e.fieldsCleared.length} ฟิลด์
              </p>

              <div className="flex flex-wrap gap-1">
                {e.fieldsCleared.map((f) => (
                  <span
                    key={f}
                    className="px-1.5 py-0.5 rounded bg-surface-2 text-fg-2 font-mono text-[10px]"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
