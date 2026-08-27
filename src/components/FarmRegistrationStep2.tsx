import React from 'react';
import { User, Shield, Upload, FileText, Eye } from 'lucide-react';

interface FarmRegistrationStep2Props {
  farmerFullName: string;
  onFarmerFullNameChange: (value: string) => void;
  farmerIdCardNumber: string;
  onFarmerIdCardNumberChange: (value: string) => void;
  farmerIdCardPhoto: string;
  farmerIdCardFileType: 'image' | 'pdf';
  farmerIdCardFileName: string;
  /** input ไฟล์ของขั้นนี้ ถือไว้ที่ hook เพราะ handler อัปโหลดอยู่ที่นั่น */
  idCardInputRef: React.RefObject<HTMLInputElement | null>;
  onIdCardUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  lineId: string;
  onLineIdChange: (value: string) => void;
  /** เปิดไฟล์ PDF ที่แนบไว้ ส่งมาจากหน้าแม่เพื่อไม่ให้ขั้นนี้ผูกกับ utils โดยตรง */
  onOpenPdf: (dataUrl: string, fileName?: string) => void;
}

/**
 * ขั้นที่ 2 ของฟอร์มขึ้นทะเบียนสวน -- ยืนยันตัวตนเจ้าของสวนและช่องทางติดต่อ
 *
 * ไม่มีสถานะของตัวเอง ค่าทั้งหมดมาจาก useFarmRegistrationForm ที่หน้าแม่
 */
export const FarmRegistrationStep2: React.FC<FarmRegistrationStep2Props> = ({
  farmerFullName,
  onFarmerFullNameChange,
  farmerIdCardNumber,
  onFarmerIdCardNumberChange,
  farmerIdCardPhoto,
  farmerIdCardFileType,
  farmerIdCardFileName,
  idCardInputRef,
  onIdCardUpload,
  phoneNumber,
  onPhoneNumberChange,
  lineId,
  onLineIdChange,
  onOpenPdf,
}) => (
    <div className="space-y-4 animate-in fade-in">
      <div className="p-3.5 rounded-2xl bg-panel border border-line flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-gold">
          <User className="w-4 h-4" />
          <span>ข้อมูลยืนยันตัวตนเจ้าของสวน (Farmer Identity)</span>
        </div>
        <span className="text-[10px] text-leaf font-mono bg-surface-2 px-2 py-0.5 rounded-md">
          🔒 เข้ารหัสปลอดภัย
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-fg-2 mb-1">
            ชื่อ-นามสกุลจริงเจ้าของสวน <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="เช่น นายสมหมาย มั่นคง"
            value={farmerFullName}
            onChange={(e) => onFarmerFullNameChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-fg-2 mb-1">
            เลขประจำตัวประชาชน 13 หลัก <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            maxLength={13}
            placeholder="เช่น 1209900123456"
            value={farmerIdCardNumber}
            onChange={(e) => onFarmerIdCardNumberChange(e.target.value.replace(/\D/g, ''))}
            className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs font-mono"
          />
          <p className="text-[10px] text-[#527861] mt-1">
            * ใช้สำหรับยืนยันความถูกต้องกับกรมส่งเสริมการเกษตรและตรวจสอบสิทธิ์เจ้าของแปลงเท่านั้น
          </p>
        </div>

        {/* ID Card Attachment (Image / PDF) */}
        <div className="p-3.5 rounded-2xl bg-well border border-line space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gold" />
              <span>แนบไฟล์ภาพถ่ายหรือ PDF บัตรประจำตัวประชาชน <span className="text-rose-400">*</span></span>
            </label>
            <span className="text-[10px] text-fg-2">PDF / PNG / JPG</span>
          </div>

          {/* Watermark Guarantee Notice */}
          <div className="p-2.5 bg-[#0a1e12] rounded-xl border border-[#235b3a]/60 text-[11px] text-fg-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-leaf shrink-0" />
            <span>ระบบใส่ข้อความกำกับ: "ใช้เพื่อยืนยันตัวตนเจ้าของสวนกับ Durian Net Zero เท่านั้น"</span>
          </div>

          <input
            type="file"
            ref={idCardInputRef}
            accept="image/*,application/pdf"
            onChange={onIdCardUpload}
            className="hidden"
          />

          {farmerIdCardPhoto ? (
            <div className="p-3 bg-[#0a2014] rounded-xl border border-[#235b3a] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {farmerIdCardFileType === 'pdf' ? (
                  <div className="w-9 h-9 rounded-lg bg-rose-900/60 text-rose-300 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                ) : (
                  <img
                    src={farmerIdCardPhoto}
                    alt="ID Card Preview"
                    className="w-10 h-10 rounded-lg object-cover border border-leaf/40 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate">
                    {farmerIdCardFileName || 'ID_Card_Document'}
                  </span>
                  <span className="text-[10px] text-leaf">
                    ✓ อัปโหลดเรียบร้อย ({farmerIdCardFileType.toUpperCase()})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {farmerIdCardFileType === 'pdf' && (
                  <button
                    type="button"
                    onClick={() => onOpenPdf(farmerIdCardPhoto, farmerIdCardFileName)}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>ดู PDF</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => idCardInputRef.current?.click()}
                  className="px-2.5 py-1 bg-surface-2 hover:bg-[#1e4c33] text-leaf rounded-lg text-xs font-bold cursor-pointer"
                >
                  เปลี่ยนไฟล์
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => idCardInputRef.current?.click()}
              className="w-full py-4 border-2 border-dashed border-[#235b3a] hover:border-leaf bg-canvas rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs text-fg-2 hover:text-white transition-all cursor-pointer"
            >
              <Upload className="w-5 h-5 text-leaf" />
              <span className="font-bold text-white">คลิกเพื่ออัปโหลดสำเนาบัตรประชาชน</span>
              <span className="text-[10px] text-[#527861]">รองรับไฟล์ PDF หรือ รูปภาพ JPG/PNG ไม่เกิน 10MB</span>
            </button>
          )}
        </div>

        {/* Contact Channels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-fg-2 mb-1">
              เบอร์โทรศัพท์ติดต่อเจ้าของสวน (10 หลัก)
            </label>
            <input
              type="tel"
              maxLength={10}
              placeholder="เช่น 0812345678"
              value={phoneNumber}
              onChange={(e) => onPhoneNumberChange(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-leaf"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-fg-2 mb-1">
              LINE ID สำหรับติดต่อ
            </label>
            <input
              type="text"
              placeholder="เช่น @durianfarm หรือไอดีไลน์"
              value={lineId}
              onChange={(e) => onLineIdChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white text-xs focus:outline-hidden focus:border-leaf"
            />
          </div>
        </div>
      </div>
    </div>
);
