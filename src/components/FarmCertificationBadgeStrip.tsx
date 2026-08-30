import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { CertificationDetail } from '../types';

interface FarmCertificationBadgeStripProps {
  certifications?: CertificationDetail[];
}

/**
 * แถบตราใบรับรองของฟาร์ม
 *
 * แสดงเฉพาะใบที่แอดมินอนุมัติแล้วเท่านั้น ตราคือคำรับรองที่ผู้ซื้อเห็นก่อน
 * ตัดสินใจ ถ้าใบที่ยังรอตรวจหรือถูกปฏิเสธโผล่ขึ้นมาด้วย สวนที่ยังไม่ผ่าน
 * การตรวจจะดูเหมือนผ่านแล้ว
 *
 * ใบที่ยังไม่ผ่านยังดูได้ที่แท็บใบรับรอง ซึ่งแสดงสถานะจริงของแต่ละใบ
 *
 * ตอนไม่มีใบเลยก็ยังคงแถบไว้ ไม่ยุบทิ้ง ไม่งั้นระยะห่างระหว่างส่วนหัว
 * กับแถบแท็บจะกระโดดไปมาระหว่างฟาร์มที่มีตรากับฟาร์มที่ยังไม่มี
 *
 * จอแคบเลื่อนแถบไปทางข้างได้ จอกว้างตัดขึ้นบรรทัดใหม่ตามความกว้างที่มี
 */
export const FarmCertificationBadgeStrip: React.FC<FarmCertificationBadgeStripProps> = ({
  certifications = [],
}) => {
  // approvalStatus เป็นค่าที่ใช้ตัดสินจริง ส่วน verified รองรับข้อมูลชุดเก่า
  // ที่ยังไม่มีฟิลด์ใหม่ ถ้าตัดทิ้งเพราะไม่มีฟิลด์ ฟาร์มจะเสียตราทั้งที่ข้อมูลครบ
  const approved = certifications.filter((c) =>
    c.approvalStatus ? c.approvalStatus === 'approved' : c.verified
  );

  return (
    <section aria-label="ตราใบรับรองของฟาร์ม" className="space-y-2">
      <h2 className="text-xs font-bold text-fg-2 tracking-wide">ใบรับรองของฟาร์ม</h2>

      {approved.length === 0 ? (
        <p className="h-14 flex items-center px-3.5 rounded-2xl border border-dashed border-line bg-surface/40 text-[11px] text-fg-3">
          ยังไม่มีใบรับรองที่ผ่านการตรวจสอบ
        </p>
      ) : (
        <ul className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-0.5 lg:flex-wrap lg:overflow-visible">
          {approved.map((cert) => (
            <li
              key={cert.id ?? `${cert.shortCode}-${cert.certNumber}`}
              className="shrink-0 h-14 max-w-[17rem] flex items-center gap-2.5 pl-3 pr-3.5 rounded-2xl border border-line bg-surface"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-leaf" />

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-gold">{cert.shortCode}</span>
                  <span className="text-[10px] text-fg-3 tabular-nums">ถึง {cert.validUntil}</span>
                </div>
                <div className="text-[11px] font-bold text-fg truncate">
                  {cert.nameTh || cert.name}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
