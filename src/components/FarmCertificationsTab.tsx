import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, FileText, Eye, MapPin, Clock, XCircle } from 'lucide-react';
import { DurianFarm } from '../types';
import {
  fetchRegionalCertRequestsForFarm,
  type RegionalCertRequest,
} from '../services/regionalCertificationService';

/** เอกสารใบรับรองที่กำลังเปิดดู รูปร่างนี้ใช้ร่วมกับหน้าต่างแสดงเอกสารที่หน้าแม่ */
export interface CertDocView {
  name: string;
  shortCode: string;
  certNumber: string;
  issuedBy: string;
  validUntil: string;
  photoUrl: string;
  fileType?: 'image' | 'pdf';
  fileName?: string;
}

interface FarmCertificationsTabProps {
  farm: DurianFarm;
  /**
   * เปิดหน้าต่างดูเอกสาร
   *
   * ไม่เก็บเป็น state ในนี้ เพราะหน้าต่างที่แสดงเอกสารถูก render อยู่ที่หน้าแม่
   * คนละกิ่งกับแท็บนี้ ถ้าเก็บไว้ในนี้ หน้าต่างจะมองไม่เห็นค่าเลย
   * ปุ่มจะกดแล้วเงียบ ไม่มี error ไม่มีอะไรขึ้น
   */
  onViewDocument: (doc: CertDocView) => void;
  /**
   * ผู้ที่กำลังดูเป็นเจ้าของสวนหรือผู้ดูแล
   *
   * ใช้ตัดสินว่าจะแสดงสถานะใบระดับโซนหรือไม่ หน้าโปรไฟล์สวนใครเปิดดูก็ได้
   * เหตุผลที่ผู้ดูแลปฏิเสธจึงไม่ควรโผล่ให้คนทั่วไปเห็น
   *
   * เซิร์ฟเวอร์กันไว้อีกชั้นอยู่แล้ว ตัวนี้ทำให้ไม่ต้องยิงขอข้อมูลที่จะได้ 403
   * กลับมาทุกครั้งที่มีคนเปิดดูหน้าสวน
   */
  isOwnerOrAdmin?: boolean;
}

/** แท็บใบรับรองมาตรฐาน อ่านข้อมูลจากฟาร์มอย่างเดียว ไม่มีสถานะของตัวเอง */
export const FarmCertificationsTab: React.FC<FarmCertificationsTabProps> = ({
  farm: currentFarm,
  onViewDocument,
  isOwnerOrAdmin = false,
}) => {
  const [regionalRequests, setRegionalRequests] = useState<RegionalCertRequest[]>([]);

  useEffect(() => {
    if (!isOwnerOrAdmin || !currentFarm.id) return;

    let cancelled = false;
    // กลืน error ทิ้งโดยตั้งใจ ส่วนนี้เป็นข้อมูลเสริม ถ้าดึงไม่ได้ก็ไม่ควร
    // ลากแท็บใบรับรองทั้งแท็บพังไปด้วย
    void fetchRegionalCertRequestsForFarm(currentFarm.id)
      .then((rows) => {
        if (!cancelled) setRegionalRequests(rows);
      })
      .catch(() => {
        if (!cancelled) setRegionalRequests([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOwnerOrAdmin, currentFarm.id]);

  return (
    <div className="bg-surface rounded-3xl border border-line p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-leaf" />
          <h3 className="font-bold text-sm text-white">
            ใบรับรองมาตรฐานทางการเกษตร (Official Certificates)
          </h3>
        </div>
        <span className="text-[10px] font-bold bg-surface-2 text-leaf border border-[#235b3a] px-2.5 py-1 rounded-full">
          ✓ ผ่านการตรวจสอบ ({currentFarm.certificationDetails?.length || 1} รายการ)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {currentFarm.certificationDetails && currentFarm.certificationDetails.length > 0 ? (
          currentFarm.certificationDetails.map((cert, idx) => {
            const certPhoto = cert.documentPhoto || currentFarm.certDocumentPhoto || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80';
            const isPdf = cert.fileType === 'pdf' || certPhoto.includes('application/pdf') || certPhoto.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={cert.id || idx}
                className="p-4 rounded-2xl border border-line bg-[#122b1c] space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-gold font-mono">{cert.shortCode}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                        isPdf
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {isPdf ? 'PDF' : 'PNG/รูป'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-gold/20 text-gold-soft px-2 py-0.5 rounded-full border border-gold/40">
                      ตรวจสอบแล้ว
                    </span>
                  </div>
                  <div className="text-xs text-white font-bold">{cert.nameTh || cert.name}</div>
                  <div className="text-[11px] text-fg-2 font-mono">
                    เลขที่: <span className="text-gold-soft font-bold">{cert.certNumber}</span>
                  </div>
                  <div className="text-[10px] text-fg-2">
                    ออกโดย: {cert.issuedBy} (ใช้ได้ถึง {cert.validUntil})
                  </div>
                </div>

                <button
                  onClick={() =>
                    onViewDocument({
                      name: cert.nameTh || cert.name,
                      shortCode: cert.shortCode,
                      certNumber: cert.certNumber,
                      issuedBy: cert.issuedBy,
                      validUntil: cert.validUntil,
                      photoUrl: certPhoto,
                      fileType: isPdf ? 'pdf' : 'image',
                      fileName: cert.fileName || `${cert.shortCode}_Certificate.${isPdf ? 'pdf' : 'png'}`,
                    })
                  }
                  className="w-full py-2 bg-well hover:bg-surface-2 border border-line hover:border-gold rounded-xl text-xs font-bold text-gold-soft flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  {isPdf ? (
                    <FileText className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-gold" />
                  )}
                  <span>{isPdf ? 'เปิดดูเอกสารใบรับรอง (PDF)' : 'ดูภาพถ่ายใบรับรองฉบับจริง'}</span>
                </button>
              </div>
            );
          })
        ) : (
          <div className="p-4 rounded-2xl border border-line bg-[#122b1c] space-y-3 col-span-2">
            <div className="flex items-center gap-2 text-xs text-gold-soft font-semibold">
              <CheckCircle2 className="w-4 h-4 text-leaf" />
              <span>ได้รับการรับรองมาตรฐาน GAP กรมวิชาการเกษตร (ตรวจสอบแล้ว)</span>
            </div>
            <button
              onClick={() =>
                onViewDocument({
                  name: 'GAP มาตรฐานการปฏิบัติทางการเกษตรที่ดี',
                  shortCode: 'GAP',
                  certNumber: 'GAP-DOA-TH-2026',
                  issuedBy: 'กรมวิชาการเกษตร',
                  validUntil: '2028',
                  photoUrl: currentFarm.certDocumentPhoto || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
                  fileType: 'image',
                  fileName: 'GAP_Certificate.png',
                })
              }
              className="py-2 px-4 bg-well hover:bg-surface-2 border border-line hover:border-gold rounded-xl text-xs font-bold text-gold-soft inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-gold" />
              <span>ดูภาพถ่ายใบรับรองฉบับจริง</span>
            </button>
          </div>
        )}
      </div>

      {/*
        สถานะใบระดับโซนของสวนนี้

        ใบอย่าง GI ไม่ได้ขึ้นตราทันทีที่อนุมัติคำขอสมัคร แต่ไปรอให้ผู้ดูแล
        จับคู่โซนก่อน ถ้าถูกปฏิเสธ เหตุผลถูกบันทึกไว้ตั้งแต่ต้นแต่ไม่เคยมีใคร
        ได้อ่าน จากมุมเจ้าของสวนคือกรอกครบ รอไปเรื่อย ๆ แล้วตราไม่เคยขึ้น
        โดยไม่รู้ว่าติดอยู่ที่ขั้นไหน

        ขึ้นเฉพาะเจ้าของสวนกับผู้ดูแล และเฉพาะตอนที่มีคำขอจริง
      */}
      {regionalRequests.length > 0 && (
        <div className="pt-4 border-t border-line space-y-2.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gold" />
            <h4 className="font-bold text-xs text-white">
              ใบรับรองระดับโซนที่ยื่นไว้ (เห็นเฉพาะเจ้าของสวนและผู้ดูแล)
            </h4>
          </div>

          {regionalRequests.map((r) => {
            const tone =
              r.status === 'linked'
                ? 'border-[#235b3a] bg-[#122b1c]'
                : r.status === 'rejected'
                  ? 'border-rose-800/60 bg-rose-950/30'
                  : 'border-line bg-well';

            return (
              <div key={r.id} className={`p-3 rounded-2xl border ${tone} space-y-1.5`}>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-surface-2 text-leaf font-black text-[10px]">
                    {r.typeCode}
                  </span>
                  <span className="text-xs text-white truncate">{r.typeNameTh}</span>
                  {r.certNumber ? (
                    <span className="font-mono text-[11px] text-fg-2">{r.certNumber}</span>
                  ) : null}
                </div>

                {r.status === 'pending' && (
                  <p className="flex items-start gap-1.5 text-[11px] text-fg-2">
                    <Clock className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>
                      รอผู้ดูแลจับคู่สวนของคุณเข้ากับโซนที่ถูกต้อง ตราจะขึ้นทันทีที่จับคู่เสร็จ
                    </span>
                  </p>
                )}

                {r.status === 'linked' && (
                  <p className="flex items-start gap-1.5 text-[11px] text-leaf font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>อยู่ในโซน {r.linkedRegionName || '-'} เรียบร้อยแล้ว</span>
                  </p>
                )}

                {r.status === 'rejected' && (
                  <p className="flex items-start gap-1.5 text-[11px] text-rose-300">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>
                      ไม่ผ่านการตรวจ
                      {r.adminNotes ? ` · ${r.adminNotes}` : ' (ไม่ได้ระบุเหตุผลไว้)'}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
