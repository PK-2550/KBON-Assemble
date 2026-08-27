import React from 'react';
import { X } from 'lucide-react';

interface FarmPhotoGalleryOverlayProps {
  photos: string[];
  farmName: string;
  onClose: () => void;
}

/**
 * แกลเลอรีรูปบรรยากาศสวนแบบเต็มจอ เลื่อนดูทีละรูปในแนวตั้ง
 *
 * ตัวเปิดแกลเลอรีเป็นปุ่มในการ์ดหัวหน้าฟาร์ม ซึ่งอยู่คนละที่กับตัวแกลเลอรี
 * สถานะเปิด/ปิดจึงอยู่ที่หน้าแม่ ไม่ได้อยู่ในนี้
 * ถ้าเก็บไว้ในนี้ ปุ่มกับแกลเลอรีจะมองไม่เห็นกัน กดแล้วไม่มีอะไรเกิดขึ้น
 *
 * รายชื่อรูปส่งเข้ามาเช่นกัน เพราะการ์ดหัวหน้าฟาร์มใช้รายการเดียวกันนี้
 * ทั้งแสดงรูปปกและนับจำนวน
 */
export const FarmPhotoGalleryOverlay: React.FC<FarmPhotoGalleryOverlayProps> = ({
  photos,
  farmName,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-canvas/95 backdrop-blur-sm animate-in fade-in"
      onClick={() => onClose()}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-canvas/90 backdrop-blur-md border-b border-line">
        <div className="min-w-0">
          <div className="text-sm font-bold text-fg truncate">{farmName}</div>
          <div className="text-[11px] text-fg-2">
            บรรยากาศสวน {photos.length} รูป
          </div>
        </div>
        <button
          onClick={() => onClose()}
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
        {photos.map((img, idx) => (
          <figure key={idx} className="rounded-2xl overflow-hidden border border-line bg-surface">
            {/* ไม่ใช้ loading="lazy" เพราะ native lazy loading ไม่เริ่มโหลดรูปที่อยู่
                ในกล่องซึ่งเลื่อนเองแบบนี้ ทำให้รูปที่สองเป็นต้นไปค้างเป็นช่องว่างตลอด
                แกลเลอรีนี้มีรูปไม่มากและถูกสร้างเฉพาะตอนกดเปิด จึงโหลดทั้งหมดไปเลย
                min-h ไว้กันหน้ากระตุกระหว่างรูปกำลังโหลด */}
            <img
              src={img}
              alt={`บรรยากาศ${farmName} รูปที่ ${idx + 1}`}
              className="w-full object-contain min-h-[220px] max-h-[75vh] bg-canvas"
            />
            <figcaption className="px-3 py-2 text-[11px] text-fg-2 tabular-nums">
              {idx + 1} / {photos.length}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
};
