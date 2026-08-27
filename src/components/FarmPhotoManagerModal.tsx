import React, { useState } from 'react';
import { X, Camera, Upload, Trash2, Check } from 'lucide-react';

interface FarmPhotoManagerModalProps {
  /** รายการรูปตั้งต้น ใช้เป็นค่าเริ่มต้นตอนเปิดโมดัล */
  photos: string[];
  /** รูปตัวอย่างให้เลือกใส่ ส่งมาจากหน้าแม่ ไม่ประกาศซ้ำในนี้ */
  samplePhotos: string[];
  onClose: () => void;
  /**
   * บันทึกรายการรูป
   *
   * ตัวบันทึกจริงอยู่ที่หน้าแม่ เพราะต้องแตะ currentFarm กับ toast
   * และต้องคงลำดับเดิมไว้ คือปรับหน้าจอก่อนแล้วค่อยรอผลจากเซิร์ฟเวอร์
   */
  onSave: (photos: string[]) => void;
}

/**
 * โมดัลจัดการรูปบรรยากาศสวน อัปโหลดไฟล์ ลบ และเลือกจากรูปตัวอย่าง
 *
 * รายการรูปที่กำลังแก้เก็บเป็นสถานะภายใน เพราะไม่มีส่วนอื่นอ่านระหว่างแก้
 * และตั้งค่าใหม่จาก photos ทุกครั้งที่เปิด เพราะโมดัลถูกสร้างใหม่ตอนเปิด
 * ซึ่งให้ผลเหมือนเดิมกับที่หน้าแม่เคยเซ็ตค่าให้ก่อนเปิด
 */
export const FarmPhotoManagerModal: React.FC<FarmPhotoManagerModalProps> = ({
  photos,
  samplePhotos,
  onClose,
  onSave,
}) => {
  const [photoList, setPhotoList] = useState<string[]>(photos);

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
            <Camera className="w-5 h-5 text-gold" />
            <div>
              <h3 className="font-bold text-sm text-white">จัดการรูปภาพบรรยากาศสวน</h3>
              <p className="text-[11px] text-fg-2">
                เพิ่มหรือแก้ไขภาพถ่ายแปลงสวน ต้นทุเรียน และบรรยากาศธรรมชาติ
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
          {/* Local File Upload Button (PNG / JPG / WebP) */}
          <div className="p-3.5 bg-well rounded-2xl border border-dashed border-line hover:border-gold flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-white text-xs">อัปโหลดไฟล์รูปภาพ PNG / JPG</div>
              <div className="text-[10px] text-fg-2">เลือกไฟล์ภาพจากอุปกรณ์ของคุณโดยตรง</div>
            </div>
            <label className="px-3 py-1.5 bg-surface-2 hover:bg-[#1f4e34] border border-[#225739] text-gold-soft hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>เลือกรูป</span>
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp, image/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  Array.from(files).forEach((file: File) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const dataUrl = event.target?.result as string;
                      if (dataUrl) {
                        setPhotoList((prev) => [...prev, dataUrl]);
                      }
                    };
                    reader.readAsDataURL(file);
                  });
                }}
                className="hidden"
              />
            </label>
          </div>

          {/* Photo list (Responsive 16:10 aspect ratio) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photoList.map((url, idx) => (
              <div
                key={idx}
                className="relative group rounded-xl overflow-hidden aspect-16/10 bg-well border border-line"
              >
                <img src={url} alt={`Atmosphere ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    if (photoList.length > 1) {
                      setPhotoList(photoList.filter((_, i) => i !== idx));
                    }
                  }}
                  className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-md transition-colors cursor-pointer"
                  title="ลบรูปนี้"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-gold-soft px-1 py-0.5 text-center truncate">
                  รูปที่ {idx + 1}
                </div>
              </div>
            ))}
          </div>

          {/* Quick sample photo selector */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-fg-2 block font-medium">
              หรือเลือกภาพบรรยากาศสวนตัวอย่าง:
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {samplePhotos.map((sampleUrl, sIdx) => {
                const isSelected = photoList.includes(sampleUrl);
                return (
                  <div
                    key={sIdx}
                    onClick={() => {
                      if (isSelected) {
                        if (photoList.length > 1) {
                          setPhotoList(photoList.filter((p) => p !== sampleUrl));
                        }
                      } else {
                        setPhotoList([...photoList, sampleUrl]);
                      }
                    }}
                    className={`relative rounded-xl overflow-hidden aspect-square cursor-pointer transition-all border ${
                      isSelected
                        ? 'ring-2 ring-gold border-gold scale-102'
                        : 'border-line opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={sampleUrl} alt={`Sample ${sIdx}`} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-gold text-gold-ink rounded-full flex items-center justify-center font-bold text-[8px]">
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-line flex justify-end gap-2 shrink-0">
          <button
            onClick={() => onClose()}
            className="px-4 py-2 bg-well hover:bg-surface-2 text-white rounded-xl text-xs font-bold border border-line cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onSave(photoList)}
            className="px-4 py-2 bg-gold hover:bg-[#f0b548] text-gold-ink font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>บันทึกการเปลี่ยนแปลง</span>
          </button>
        </div>
      </div>
    </div>
  );
};
