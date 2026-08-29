import React from 'react';

/**
 * ที่ว่างสำหรับแถบตราใบรับรอง -- ยังไม่ดึงข้อมูลจริง
 *
 * กันพื้นที่ไว้ก่อนตั้งแต่ตอนนี้ เพราะถ้ารอไปเพิ่มทีหลังจะต้องรื้อระยะห่าง
 * ระหว่างส่วนหัวกับแถบแท็บใหม่ทั้งหมด แถวนี้จึงมีความสูงเท่าของจริงแล้ว
 *
 * ช่องว่างเป็นกรอบเส้นประ ซึ่งเป็นสัญญาณที่อ่านออกทันทีว่ายังไม่มีข้อมูล
 * ไม่ใช่ตราจริงที่โหลดไม่ขึ้น
 *
 * จอแคบเลื่อนแถบไปทางข้างได้ จอกว้างเรียงต่อกันไปตามความกว้างที่มี
 */
export const FarmCertificationBadgeStrip: React.FC = () => (
  <section aria-label="ตราใบรับรองของฟาร์ม" className="space-y-2">
    <h2 className="text-xs font-bold text-fg-2 tracking-wide">ใบรับรองของฟาร์ม</h2>

    <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-0.5 lg:flex-wrap lg:overflow-visible">
      {[0, 1, 2].map((slot) => (
        <div
          key={slot}
          className="shrink-0 h-14 w-36 sm:w-40 rounded-2xl border border-dashed border-line-strong bg-surface/40 flex items-center justify-center"
        >
          <span className="text-[11px] font-medium text-fg-3">รอข้อมูลใบรับรอง</span>
        </div>
      ))}
    </div>
  </section>
);
