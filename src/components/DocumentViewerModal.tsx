import React, { useState } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  ExternalLink,
  ShieldCheck,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { createBlobUrlFromDataUrl, downloadPdfDocument } from '../utils/pdfUtils';

export interface DocumentViewerData {
  title: string;
  subtitle?: string;
  fileUrl: string;
  fileType?: 'image' | 'pdf' | string;
  fileName?: string;
  badge?: string;
  metaDetails?: { label: string; value: string }[];
}

interface DocumentViewerModalProps {
  data: DocumentViewerData | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  data,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  if (!data || !data.fileUrl) return null;

  const isPdf =
    data.fileType === 'pdf' ||
    data.fileUrl.includes('application/pdf') ||
    data.fileUrl.toLowerCase().endsWith('.pdf') ||
    data.fileName?.toLowerCase().endsWith('.pdf');

  const effectiveFileName =
    data.fileName ||
    `${data.title.replace(/\s+/g, '_')}.${isPdf ? 'pdf' : 'jpg'}`;

  const blobUrl = isPdf ? createBlobUrlFromDataUrl(data.fileUrl) : data.fileUrl;

  const handleZoomIn = () => setZoom((prev) => Math.min(3, prev + 0.25));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, prev - 0.25));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (isPdf) {
      downloadPdfDocument(data.fileUrl, effectiveFileName);
    } else {
      try {
        const link = document.createElement('a');
        link.href = data.fileUrl;
        link.download = effectiveFileName;
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        setTimeout(() => {
          link.click();
          setTimeout(() => {
            if (link.parentNode) link.parentNode.removeChild(link);
          }, 200);
        }, 0);
      } catch (e) {
        console.warn('Download image failed:', e);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-[#06140b] text-white rounded-3xl overflow-hidden shadow-2xl border border-line relative flex flex-col transition-all ${
          isFullScreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-4xl max-h-[92vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-line bg-gradient-to-r from-[#0c2617] via-[#081b10] to-well flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              isPdf ? 'bg-rose-950/80 text-rose-300 border border-rose-600/50' : 'bg-surface-2 text-leaf border border-[#245b38]'
            }`}>
              {isPdf ? <FileText className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white truncate">
                  {data.title}
                </h3>
                {data.badge && (
                  <span className="text-[10px] font-bold bg-gold/20 text-gold-soft border border-gold/40 px-2 py-0.5 rounded-full shrink-0">
                    {data.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-fg-2 truncate">
                {data.subtitle || (isPdf ? 'เอกสารอิเล็กทรอนิกส์ (PDF)' : 'ไฟล์รูปภาพความละเอียดสูง')}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {!isPdf && (
              <>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="ซูมเข้า (+)"
                  className="p-1.5 sm:p-2 text-fg-2 hover:text-white hover:bg-surface-2 rounded-xl border border-line transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="ซูมออก (-)"
                  className="p-1.5 sm:p-2 text-fg-2 hover:text-white hover:bg-surface-2 rounded-xl border border-line transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  title="หมุนรูป 90°"
                  className="p-1.5 sm:p-2 text-fg-2 hover:text-white hover:bg-surface-2 rounded-xl border border-line transition-colors cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownload}
              title="ดาวน์โหลดไฟล์ลงเครื่อง"
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-surface-2 hover:bg-[#1f4e34] border border-leaf/40 text-leaf font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ดาวน์โหลด</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? 'ย่อหน้าต่าง' : 'ขยายเต็มจอ'}
              className="p-1.5 sm:p-2 text-fg-2 hover:text-white hover:bg-surface-2 rounded-xl border border-line transition-colors cursor-pointer hidden sm:flex"
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่างเอกสาร"
              title="ปิดหน้าต่างเอกสาร"
              className="p-1.5 sm:p-2 text-fg-2 hover:text-white hover:bg-surface-2 rounded-xl border border-line transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewer */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-[#030c07] min-h-[300px] sm:min-h-[420px]">
          {isPdf ? (
            <div className="w-full h-full flex-1 flex flex-col">
              <iframe
                src={blobUrl}
                title={data.title}
                className="w-full flex-1 min-h-[500px] sm:min-h-[580px] border-0 bg-[#121c16]"
              />
              <div className="p-2.5 bg-panel border-t border-line flex items-center justify-between text-xs text-fg-2 shrink-0">
                <span>หากเอกสารไม่แสดงในกรอบ สามารถกดเปิดหรือดาวน์โหลดดูได้</span>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="text-leaf hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>ดาวน์โหลดไฟล์ PDF ต้นฉบับ</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              className="w-full h-full flex-1 flex items-center justify-center p-4 overflow-auto min-h-[420px]"
              onDoubleClick={handleReset}
            >
              <div
                className="transition-transform duration-200 ease-out flex items-center justify-center max-w-full max-h-full"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              >
                <img
                  src={data.fileUrl}
                  alt={data.title}
                  className="max-w-full max-h-[68vh] object-contain rounded-xl shadow-2xl border border-line/60 select-none pointer-events-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Meta info */}
        {data.metaDetails && data.metaDetails.length > 0 && (
          <div className="p-3 bg-panel border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            {data.metaDetails.map((meta, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                <span className="text-fg-2">{meta.label}:</span>
                <span className="font-semibold text-white">{meta.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
