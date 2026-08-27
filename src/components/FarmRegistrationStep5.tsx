import React from 'react';
import { Award, Plus, Trash2, Paperclip, FileText, ExternalLink, ShieldCheck } from 'lucide-react';
import { CertificationDetail } from '../types';
import { STANDARD_OPTIONS } from '../constants/farmRegistrationOptions';

interface FarmRegistrationStep5Props {
  certificationList: CertificationDetail[];
  onAddCertificate: () => void;
  onUpdateCertField: (index: number, field: keyof CertificationDetail, value: any) => void;
  onSelectStandardOption: (index: number, code: string) => void;
  onCertDocUpload: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveCertificate: (index: number) => void;

  /** โหมดขอแก้ไขข้อมูลสวนเดิม จะมีช่องหมายเหตุเพิ่มมาให้กรอก */
  isUpdateMode: boolean;
  updateNotes: string;
  onUpdateNotesChange: (value: string) => void;

  /** เปิดไฟล์ PDF ที่แนบไว้ ส่งมาจากหน้าแม่เพื่อไม่ให้ขั้นนี้ผูกกับ utils ตรง ๆ */
  onOpenPdf: (dataUrl: string, fileName?: string) => void;
}

/**
 * ขั้นที่ 5 ของฟอร์มขึ้นทะเบียนสวน -- ใบรับรองมาตรฐาน
 *
 * เพิ่มได้หลายใบ แต่ละใบเลือกชนิดมาตรฐานจากรายการ กรอกเลขที่
 * หน่วยงานผู้ออก ปีหมดอายุ และแนบไฟล์ PDF หรือรูปภาพได้
 *
 * ไม่มีสถานะของตัวเอง ค่าทั้งหมดมาจาก useFarmRegistrationForm ที่หน้าแม่
 *
 * ระวังเรื่องหมายเลขขั้น คอมเมนต์เดิมในไฟล์ต้นทางเรียกส่วนนี้ว่าขั้นที่ 4
 * แต่ที่ render จริงคือ step === 5
 */
export const FarmRegistrationStep5: React.FC<FarmRegistrationStep5Props> = ({
  certificationList,
  onAddCertificate,
  onUpdateCertField,
  onSelectStandardOption,
  onCertDocUpload,
  onRemoveCertificate,
  isUpdateMode,
  updateNotes,
  onUpdateNotesChange,
  onOpenPdf,
}) => (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Award className="w-4 h-4 text-gold" />
            <span>เอกสารรับรองมาตรฐานทางการเกษตร ({certificationList.length} รายการ)</span>
          </h3>
          <p className="text-[11px] text-fg-2">
            รองรับการแนบไฟล์ PDF และรูปภาพใบรับรองจริง
          </p>
        </div>

        <button
          type="button"
          onClick={() => onAddCertificate()}
          className="px-3 py-1.5 bg-surface-2 hover:bg-[#1e4c33] border border-leaf/40 text-leaf rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>เพิ่มใบรับรอง</span>
        </button>
      </div>

      <div className="space-y-3">
        {certificationList.map((cert, index) => {
          const isPdf =
            cert.fileType === 'pdf' ||
            cert.documentPhoto?.includes('application/pdf') ||
            cert.documentPhoto?.toLowerCase().endsWith('.pdf');

          return (
            <div
              key={cert.id || index}
              className="p-3.5 bg-well rounded-2xl border border-line space-y-3 relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-surface-2 text-gold flex items-center justify-center font-bold text-[10px]">
                    #{index + 1}
                  </span>
                  <select
                    value={cert.shortCode}
                    onChange={(e) => onSelectStandardOption(index, e.target.value)}
                    className="px-2.5 py-1 bg-panel border border-line rounded-lg text-white font-bold text-xs focus:outline-hidden focus:border-gold"
                  >
                    {STANDARD_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.code} - {opt.nameTh}
                      </option>
                    ))}
                  </select>
                </div>

                {certificationList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveCertificate(index)}
                    className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-fg-2 mb-1 font-semibold">
                    เลขที่ใบรับรอง <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น กษ 03-9001-XXXX-XXX"
                    value={cert.certNumber}
                    onChange={(e) =>
                      onUpdateCertField(index, 'certNumber', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-panel border border-line rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-leaf"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-fg-2 mb-1 font-semibold">
                    หน่วยงานผู้ออกใบรับรอง
                  </label>
                  <input
                    type="text"
                    value={cert.issuedBy}
                    onChange={(e) =>
                      onUpdateCertField(index, 'issuedBy', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-panel border border-line rounded-xl text-white text-xs focus:outline-hidden focus:border-leaf"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-fg-2 mb-1 font-semibold">
                    ปีที่หมดอายุ
                  </label>
                  <input
                    type="text"
                    value={cert.validUntil}
                    onChange={(e) =>
                      onUpdateCertField(index, 'validUntil', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-panel border border-line rounded-xl text-white text-xs focus:outline-hidden focus:border-leaf"
                  />
                </div>
              </div>

              {/* File Attachment for Certificate (PDF / Image) */}
              <div className="pt-1">
                <label className="block text-[11px] text-fg-2 mb-1 font-semibold">
                  แนบไฟล์ใบรับรอง (PDF หรือ รูปถ่าย)
                </label>
                {cert.documentPhoto ? (
                  <div className="p-2.5 bg-panel rounded-xl border border-[#235b3a] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isPdf ? (
                        <div className="w-7 h-7 rounded-lg bg-rose-900/60 text-rose-300 flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <img
                          src={cert.documentPhoto}
                          alt="Cert Preview"
                          className="w-7 h-7 rounded-lg object-cover border border-leaf/40 shrink-0"
                        />
                      )}
                      <span className="text-xs text-white truncate">
                        {cert.fileName || `${cert.shortCode}_Certificate`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPdf && (
                        <button
                          type="button"
                          onClick={() => onOpenPdf(cert.documentPhoto, cert.fileName)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>เปิดดู PDF</span>
                        </button>
                      )}
                      <label className="px-2 py-1 bg-surface-2 hover:bg-[#1e4c33] text-leaf rounded-lg text-xs font-bold cursor-pointer">
                        เปลี่ยนไฟล์
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => onCertDocUpload(index, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="w-full py-2.5 border border-dashed border-[#235b3a] hover:border-leaf bg-panel rounded-xl flex items-center justify-center gap-2 text-xs text-fg-2 hover:text-white transition-all cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5 text-leaf" />
                    <span>คลิกเพื่อแนบไฟล์ PDF หรือ รูปภาพใบรับรอง</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => onCertDocUpload(index, e)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isUpdateMode && (
        <div className="pt-2">
          <label className="block text-xs font-bold text-amber-300 mb-1">
            สิ่งที่ต้องการแก้ไข/เพิ่มเติม (ส่งถึง Admin)
          </label>
          <textarea
            rows={2}
            placeholder="ระบุสิ่งที่แก้ไข เช่น เพิ่มใบรับรอง GI, ปรับพิกัดแปลง, แก้ไขข้อมูลเจ้าของสวน..."
            value={updateNotes}
            onChange={(e) => onUpdateNotesChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#141206] border border-amber-500/40 rounded-xl text-amber-200 text-xs focus:outline-hidden focus:border-amber-400 resize-none"
          />
        </div>
      )}

      {/* Submission Info Notice */}
      <div className="p-3 bg-[#0a2014] border border-[#235b3a] rounded-xl text-xs text-fg-2 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-leaf shrink-0" />
        <span>เมื่อกดส่งคำขอ เจ้าหน้าที่ Admin จะดำเนินการตรวจสอบเอกสารและความถูกต้องของพิกัดแปลง</span>
      </div>
    </div>
);
