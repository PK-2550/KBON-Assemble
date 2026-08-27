import React from 'react';
import { Sparkles } from 'lucide-react';

interface FarmRegistrationStep1Props {
  agreedToCriteria: boolean;
  onAgreedChange: (value: boolean) => void;
}

/**
 * ขั้นที่ 1 ของฟอร์มขึ้นทะเบียนสวน -- เกณฑ์คัดเลือกและการยอมรับเงื่อนไข
 *
 * ไม่มีสถานะของตัวเอง ค่าทั้งหมดมาจาก useFarmRegistrationForm ที่หน้าแม่
 */
export const FarmRegistrationStep1: React.FC<FarmRegistrationStep1Props> = ({
  agreedToCriteria,
  onAgreedChange,
}) => (
    <div className="space-y-4 animate-in fade-in">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0c2918] to-canvas border border-line space-y-3">
        <div className="flex items-center gap-2.5 text-gold">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-bold text-sm text-white">
            ทำไมต้องมีการคัดเลือกและรับรองมาตรฐานสวน?
          </h3>
        </div>
        <p className="text-xs text-fg-2 leading-relaxed">
          เพื่อสร้างความเชื่อมั่นสูงสุดแก่ผู้บริโภคในการตรวจสอบย้อนกลับ (Traceability) และคาร์บอนต่ำ (Net Zero) แพลตฟอร์มจึงกำหนดเกณฑ์คัดเลือกฟาร์มอย่างเข้มงวด โดยเปิดให้เฉพาะเจ้าของแปลงจริงที่มีคุณสมบัติดังนี้:
        </p>

        <div className="space-y-2.5 pt-1">
          <div className="p-3 bg-well rounded-xl border border-line flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-surface-2 text-leaf flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              1
            </span>
            <div>
              <h4 className="text-xs font-bold text-white">
                มีเอกสารรับรองมาตรฐานจริง (Certifications)
              </h4>
              <p className="text-[11px] text-fg-2 mt-0.5">
                มีใบรับรองมาตรฐาน GAP, เกษตรอินทรีย์, หรือ GI ประจำถิ่นจากหน่วยงานราชการที่ยังไม่หมดอายุ
              </p>
            </div>
          </div>

          <div className="p-3 bg-well rounded-xl border border-line flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-surface-2 text-leaf flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              2
            </span>
            <div>
              <h4 className="text-xs font-bold text-white">
                มีพิกัดแปลงจริง & ยืนยันตัวตนเจ้าของสวน
              </h4>
              <p className="text-[11px] text-fg-2 mt-0.5">
                ปักหมุดพิกัด GPS แปลงสวนจริง และแนบสำเนาบัตรประชาชนเจ้าของสวนเพื่อป้องกันการแอบอ้าง
              </p>
            </div>
          </div>

          <div className="p-3 bg-well rounded-xl border border-line flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-surface-2 text-leaf flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              3
            </span>
            <div>
              <h4 className="text-xs font-bold text-white">
                ความโปร่งใสและตัดทุเรียนสุกแก่ตามเกณฑ์
              </h4>
              <p className="text-[11px] text-fg-2 mt-0.5">
                ยินยอมให้ตรวจสอบเปอร์เซ็นต์น้ำหนักแห้ง ไม่ตัดทุเรียนอ่อน และพร้อมบันทึกข้อมูลต้นทุเรียน
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Agreement Checkbox */}
      <label className="p-3.5 rounded-2xl bg-panel border border-[#235b3a] flex items-start gap-3 cursor-pointer hover:bg-[#0c2a1b] transition-colors">
        <input
          type="checkbox"
          checked={agreedToCriteria}
          onChange={(e) => onAgreedChange(e.target.checked)}
          className="mt-1 w-4 h-4 text-leaf rounded-sm focus:ring-leaf accent-leaf cursor-pointer"
        />
        <div className="text-xs">
          <span className="font-bold text-white block">
            ข้าพเจ้ายืนยันว่าเป็นเจ้าของสวนทุเรียนจริง และยอมรับเกณฑ์มาตรฐานข้างต้น
          </span>
          <span className="text-fg-2 text-[11px]">
            ยินยอมให้ผู้ดูแลระบบ (Admin) ตรวจสอบเอกสารบัตรประชาชน พิกัดแปลง และใบรับรองมาตรฐานก่อนอนุมัติ
          </span>
        </div>
      </label>
    </div>
);
