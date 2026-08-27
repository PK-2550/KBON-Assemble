import React from 'react';
import { X, Cpu, Check } from 'lucide-react';
import { SmartTechItem } from '../types';

interface FarmSmartTechConfigModalProps {
  hasSmartFarm: boolean;
  onHasSmartFarmChange: (value: boolean) => void;
  techList: SmartTechItem[];
  onTechListChange: (list: SmartTechItem[]) => void;
  onClose: () => void;
  onSave: () => void;
}

/**
 * โมดัลตั้งค่าระบบ SmartFarm ของสวน
 *
 * ค่าที่กำลังแก้อยู่ที่หน้าแม่ ไม่ได้เก็บในนี้ เพราะมีปุ่มสองปุ่มที่เปิดโมดัลนี้
 * แล้วตั้งค่าตั้งต้นคนละแบบ
 *
 *   ปุ่มรูปเฟืองบนการ์ด SmartFarm  ใช้ค่าเดิมของสวน hasSmartFarm ?? true
 *   ปุ่ม เพิ่มระบบ SmartFarm       บังคับเป็น false และใช้รายการตั้งต้น
 *
 * ถ้าย้ายการตั้งค่าตั้งต้นมาไว้ในโมดัล เช่นใช้ useEffect ตั้งใหม่ตอนเปิด
 * ปุ่มสองปุ่มจะยุบเหลือพฤติกรรมเดียว ซึ่งผิดจากของเดิม
 */
export const FarmSmartTechConfigModal: React.FC<FarmSmartTechConfigModalProps> = ({
  hasSmartFarm,
  onHasSmartFarmChange,
  techList,
  onTechListChange,
  onClose,
  onSave,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
      onClick={() => onClose()}
    >
      <div
        className="bg-canvas text-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-line relative flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-line bg-gradient-to-r from-surface to-canvas flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-gold" />
            <div>
              <h3 className="font-bold text-sm text-white">ตั้งค่าระบบ SmartFarm</h3>
              <p className="text-[11px] text-fg-2">
                เปิด-ปิด หรือเลือกเทคโนโลยีอัจฉริยะที่มีการติดตั้งจริงในสวน
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose()}
            className="p-1.5 text-fg-2 hover:text-white hover:bg-surface-2 rounded-full border border-line cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Main Toggle */}
          <div className="p-4 bg-surface rounded-2xl border border-line flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-white">
                เปิดใช้งานแท็บ SmartFarm บนหน้าสวน
              </div>
              <p className="text-[11px] text-fg-2 mt-0.5">
                {hasSmartFarm
                  ? 'เปิดใช้งาน (จะแสดงรายการเทคโนโลยีที่เลือกด้านล่าง)'
                  : 'ปิด (แสดงเป็นวิถีเกษตรประณีตธรรมชาติ)'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onHasSmartFarmChange(!hasSmartFarm)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                hasSmartFarm ? 'bg-leaf' : 'bg-line'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  hasSmartFarm ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Technologies Checklist */}
          {hasSmartFarm && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gold-soft block">
                เลือกเทคโนโลยีที่มีการใช้งานในสวน:
              </span>
              <div className="space-y-2">
                {techList.map((item) => (
                  <div
                    key={item.id}
                    onClick={() =>
                      onTechListChange(
                        techList.map((t) =>
                          t.id === item.id ? { ...t, active: !t.active } : t
                        )
                      )
                    }
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      item.active
                        ? 'bg-surface-2 border-leaf/50'
                        : 'bg-well border-line opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="text-xl shrink-0">{item.iconEmoji}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate">{item.name}</div>
                        <div className="text-[11px] text-fg-2 truncate">{item.subtext}</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={() => {}}
                      className="w-4 h-4 rounded-sm text-leaf focus:ring-0 cursor-pointer accent-leaf"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-line flex justify-end gap-2 shrink-0">
          <button
            onClick={() => onClose()}
            className="px-4 py-2 text-xs font-bold text-fg-2 hover:text-white rounded-xl cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onSave()}
            className="px-5 py-2 bg-gold hover:bg-[#f0b548] text-gold-ink font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>
      </div>
    </div>
  );
};
