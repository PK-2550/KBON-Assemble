import React from 'react';
import { DurianFarm } from '../types';

interface FarmAboutTabProps {
  farm: DurianFarm;
}

/** แท็บประวัติฟาร์ม แสดงข้อความอย่างเดียว ไม่มีสถานะและไม่มีปุ่ม */
export const FarmAboutTab: React.FC<FarmAboutTabProps> = ({ farm: currentFarm }) => {
  return (
    <div className="bg-surface rounded-3xl border border-line p-5 shadow-2xl space-y-3">
      <h3 className="font-bold text-sm text-white flex items-center gap-2">
        <span>📖</span>
        <span>ประวัติความเป็นมาและเรื่องราวของฟาร์ม</span>
      </h3>
      <p className="text-xs text-fg-2 leading-relaxed whitespace-pre-line">
        {currentFarm.aboutStory || currentFarm.highlight || 'ฟาร์มทุเรียนคุณภาพ มุ่งเน้นการผลิตทุเรียนคุณภาพสูงด้วยระบบเกษตรแม่นยำ พร้อมระบบติดตามตรวจสอบย้อนกลับด้วยเทคโนโลยี NFC'}
      </p>
    </div>
  );
};
