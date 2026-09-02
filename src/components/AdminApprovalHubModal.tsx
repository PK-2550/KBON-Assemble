import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Eye,
  Award,
  Phone,
  Facebook,
  Instagram,
  MessageCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  User,
  Clock,
  Send,
  Building2,
  TreePine,
  FileText,
  PlusCircle,
  RotateCcw,
  MapPin,
  CheckSquare,
  Droplets,
  Layers,
  ChevronRight,
  Sprout,
  Info,
  Eraser,
} from 'lucide-react';
import { FarmRegistrationRequest, DurianFarm } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  subscribeAllFarmRequests,
  approveFarmRequest,
  rejectFarmRequest,
  resetFarmRequestToPending,
  seedSampleManagerRequests,
  getInitialFarmRequests,
  getReadRequestIds,
  markRequestsAsRead,
  subscribeReadRequestIds,
  revealFarmRequestIdCard,
} from '../services/farmRequestService';
import { DocumentViewerModal, DocumentViewerData } from './DocumentViewerModal';
import { RegionalCertLinkPanel } from './RegionalCertLinkPanel';
import { DataRetentionLogPanel } from './DataRetentionLogPanel';
import { fetchRegionalCertRequests } from '../services/regionalCertificationService';
import {
  fetchCertificationTypes,
  type CertificationTypeOption,
} from '../services/certificationTypeService';

/**
 * แท็บในศูนย์อนุมัติ
 *
 * สามตัวแรกกรองคำขอสมัคร ส่วน regional เป็นกองงานคนละชนิดคือใบรับรองระดับโซน
 * ที่รอจับคู่ จึงแทนที่เนื้อหาทั้งหมดแทนการกรองรายการเดิม
 */
type HubTab = 'pending' | 'approved' | 'rejected' | 'all' | 'regional' | 'retention';

interface AdminApprovalHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFarmApproved?: (newFarm: DurianFarm) => void;
}

export const AdminApprovalHubModal: React.FC<AdminApprovalHubModalProps> = ({
  isOpen,
  onClose,
  onFarmApproved,
}) => {
  const { currentUser } = useAuth();

  const [requests, setRequests] = useState<FarmRegistrationRequest[]>(() => getInitialFarmRequests());
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadRequestIds());
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const init = getInitialFarmRequests();
    return init[0] ? init[0].id : null;
  });
  const [activeFilter, setActiveFilter] = useState<HubTab>('pending');

  // จำนวนคำขอใบระดับโซนที่ยังรอจับคู่
  //
  // ดึงมาตั้งแต่เปิดศูนย์อนุมัติ ไม่ใช่ตอนกดเข้าแท็บ เพราะถ้าต้องกดเข้าไปดูเองก่อน
  // ถึงจะรู้ว่ามีงานค้าง ก็ไม่ต่างจากตอนที่คำขอพวกนี้ไม่มีใครเห็นเลย
  const [regionalPendingCount, setRegionalPendingCount] = useState(0);

  /**
   * ประเภทใบรับรองจากฐาน ใช้แปลรหัสย่อเป็นชื่อไทยและบอกว่าใบไหนเป็นระดับโซน
   *
   * ไม่พึ่งค่าที่ติดมากับคำขอเพียงอย่างเดียว เพราะคำขอที่ยื่นก่อนระบบรองรับหลายใบ
   * เก็บไว้แค่รหัสย่อ ไม่มีทั้งชื่อและ tier
   */
  const [certTypes, setCertTypes] = useState<CertificationTypeOption[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isRevisionBoxOpen, setIsRevisionBoxOpen] = useState(false);
  const [isRejectBoxOpen, setIsRejectBoxOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DocumentViewerData | null>(null);

  // เลขบัตรฉบับเต็มของคำขอที่แอดมินกดขอดู
  //
  // เก็บไว้ใน state ของคอมโพเนนต์นี้เท่านั้น ไม่เอาไปรวมกับรายการคำขอที่ cache ไว้
  // และไม่เขียนลง localStorage เพราะทุกครั้งที่ดึงมาถูกบันทึกไว้ในฐานข้อมูล
  // ถ้าเก็บค้างไว้ ค่าจะอยู่ในเครื่องต่อไปโดยไม่มีบันทึกว่าถูกดูอีกกี่ครั้ง
  const [revealedIdCard, setRevealedIdCard] = useState<{ requestId: string; number: string | null } | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState<{ requestId: string; message: string } | null>(null);

  /**
   * ปิดโมดัลพร้อมล้างเลขที่เปิดเผยไว้ทิ้ง
   *
   * คอมโพเนนต์นี้ถูก mount ค้างไว้ตลอดใน App การกดปิดเป็นแค่การสลับ isOpen
   * ถ้าไม่ล้าง เลขเต็มจะโผล่กลับมาทันทีตอนเปิดใหม่โดยไม่ต้องกดขออีก
   * แปลว่ามีคนเห็นเลขเพิ่มโดยไม่มีบันทึกการเข้าถึงเพิ่มตามไปด้วย
   *
   * ล้างในตัวจัดการเหตุการณ์ ไม่ใช่ใน effect ที่คอยดู isOpen
   * เพราะทางเดียวที่โมดัลนี้ถูกปิดคือผ่าน onClose อยู่แล้ว
   */
  const handleClose = () => {
    clearRevealedIdCard();
    onClose();
  };

  /**
   * ล้างเลขบัตรที่เปิดเผยไว้
   *
   * เรียกทั้งตอนปิดศูนย์อนุมัติ และตอนปิดหน้าต่างดูเอกสาร
   *
   * เดิมล้างเฉพาะตอนปิดศูนย์อนุมัติ แอดมินที่กดดูเอกสารแล้วปิดแค่หน้าต่างรูป
   * จึงยังเห็นเลข 13 หลักค้างบนจอต่อไปเรื่อย ๆ โดยไม่มีบันทึกการเข้าถึงเพิ่ม
   * ซึ่งขัดกับหลักที่ตั้งไว้ว่าทุกครั้งที่มีคนเห็นข้อมูลต้องมีบันทึกกำกับ
   *
   * ปิดแล้วอยากดูอีกก็กดใหม่ได้ ซึ่งจะยิงขอใหม่และถูกบันทึกอีกครั้ง
   */
  const clearRevealedIdCard = () => {
    setRevealedIdCard(null);
    setRevealError(null);
    setRevealBusy(false);
  };

  /**
   * ขอเลขบัตรและสำเนาบัตรฉบับเต็มจากเซิร์ฟเวอร์
   *
   * เรียกตอนกดเท่านั้น ทุกครั้งที่เรียกถูกบันทึกไว้ในตาราง id_card_access_log
   * ว่าใครดูของใครเมื่อไหร่ ถ้าโดนจำกัดอัตราจะได้ 429 ซึ่งแสดงข้อความจากเซิร์ฟเวอร์ตรง ๆ
   */
  const handleRevealIdCard = async (requestId: string, openPhoto: boolean, title: string) => {
    setRevealBusy(true);
    setRevealError(null);
    try {
      const data = await revealFarmRequestIdCard(requestId);
      setRevealedIdCard({ requestId, number: data.farmerIdCardNumber });

      if (openPhoto && data.farmerIdCardPhoto) {
        setPreviewDoc({
          title,
          fileUrl: data.farmerIdCardPhoto,
          fileType: data.farmerIdCardFileType || 'image',
        });
      }
    } catch (err) {
      setRevealError({
        requestId,
        message: err instanceof Error ? err.message : 'เปิดดูข้อมูลบัตรไม่สำเร็จ',
      });
    } finally {
      setRevealBusy(false);
    }
  };

  // Subscribe to read IDs in real time
  useEffect(() => {
    const unsub = subscribeReadRequestIds((ids) => {
      setReadIds(new Set(ids));
    });
    return () => unsub();
  }, []);

  // Subscribe to all farm requests in real time
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeAllFarmRequests((reqList) => {
      setRequests(reqList);
    });
    return () => unsubscribe();
  }, [isOpen]);

  /**
   * นับคำขอใบระดับโซนที่ยังรอจับคู่
   *
   * กลืน error ทิ้งโดยตั้งใจ endpoint นี้เป็นของแอดมิน ผู้ใช้ที่ไม่มีสิทธิ์จะได้ 403
   * ซึ่งไม่ควรลากศูนย์อนุมัติทั้งหน้าไปด้วย แค่ไม่ต้องแสดงตัวเลขก็พอ
   */
  const refreshRegionalPendingCount = useCallback(async () => {
    try {
      const pending = await fetchRegionalCertRequests('pending');
      setRegionalPendingCount(pending.length);
    } catch {
      setRegionalPendingCount(0);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // ตัวตรวจมองไม่ทะลุ async จึงนับว่าเป็นการ setState แบบทันทีใน effect
    // จริง ๆ แล้วค่าถูกตั้งหลังรอผลจากเซิร์ฟเวอร์ ซึ่งคือกรณีที่กฎข้อนี้อนุญาตไว้เอง
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshRegionalPendingCount();
  }, [isOpen, refreshRegionalPendingCount]);

  useEffect(() => {
    if (!isOpen) return;
    // ตัวเรียกมีทางสำรองในตัวอยู่แล้ว จึงไม่ต้องดัก error ซ้ำที่นี่
    void fetchCertificationTypes().then(setCertTypes);
  }, [isOpen]);

  const certTypeByCode = useMemo(
    () => new Map(certTypes.map((t) => [t.code, t])),
    [certTypes]
  );

  // Mark all currently visible requests as read when modal is opened
  useEffect(() => {
    if (isOpen && requests.length > 0) {
      requests.forEach((r) => markRequestsAsRead(r.id));
    }
  }, [isOpen, requests]);

  // Filtered requests inside unified list
  const filteredRequests = useMemo(
    () =>
      requests.filter((r) => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'rejected') return r.status === 'rejected' || r.status === 'needs_revision';
        return r.status === activeFilter;
      }),
    [requests, activeFilter]
  );

  // Derive active selected request without cascading effects
  const selectedRequest = useMemo(() => {
    if (filteredRequests.length === 0) return null;
    const found = filteredRequests.find((r) => r.id === selectedId);
    return found || filteredRequests[0] || null;
  }, [filteredRequests, selectedId]);

  /** ใบรับรองที่แนบมากับคำขอที่กำลังดูอยู่ */
  const certList = selectedRequest?.certificationList ?? [];

  if (!isOpen) return null;

  // Counts
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected' || r.status === 'needs_revision').length;
  const allCount = requests.length;
  const unreadPendingCount = requests.filter((r) => r.status === 'pending' && !readIds.has(r.id)).length;

  const handleFilterChange = (filter: HubTab) => {
    setActiveFilter(filter);
    setIsRevisionBoxOpen(false);
    setIsRejectBoxOpen(false);
    // สองแท็บนี้ไม่ได้กรองรายการคำขอสมัคร จึงไม่ต้องเลือกคำขอตัวไหน
    if (filter === 'regional' || filter === 'retention') return;
    const newFiltered = requests.filter((r) => {
      if (filter === 'all') return true;
      if (filter === 'rejected') return r.status === 'rejected' || r.status === 'needs_revision';
      return r.status === filter;
    });
    if (newFiltered.length > 0) {
      setSelectedId(newFiltered[0].id);
      markRequestsAsRead(newFiltered[0].id);
    }
  };

  const handleApprove = async (req: FarmRegistrationRequest) => {
    setProcessingId(req.id);
    const adminName = currentUser?.displayName || currentUser?.username || 'Admin';
    const now = new Date().toISOString();
    try {
      const createdFarm = await approveFarmRequest(req, adminName);

      const updatedReq: FarmRegistrationRequest = {
        ...req,
        status: 'approved',
        reviewedBy: adminName,
        reviewedAt: now,
        createdFarmId: createdFarm ? createdFarm.id : undefined,
      };

      // Optimistically update state immediately
      setRequests((prev) => prev.map((r) => (r.id === req.id ? updatedReq : r)));
      setSelectedId(updatedReq.id);
      setActiveFilter('approved');

      if (createdFarm) {
        setSuccessToast(`อนุมัติสิทธิ์ Manager และเผยแพร่ฟาร์ม "${createdFarm.name}" เข้าสู่ทำเนียบฟาร์มมาตรฐานสำเร็จเรียบร้อย`);
        if (onFarmApproved) {
          onFarmApproved(createdFarm);
        }
      } else {
        setSuccessToast(`อนุมัติสิทธิ์ Manager ให้แก่ "${req.userDisplayName}" สำเร็จเรียบร้อย`);
      }
      setTimeout(() => setSuccessToast(''), 4500);
    } catch (err: any) {
      console.error('Error approving request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSeedSamples = async () => {
    setIsSeeding(true);
    try {
      const seeded = await seedSampleManagerRequests();
      if (seeded.length > 0) {
        setRequests((prev) => [...seeded, ...prev]);
        setSelectedId(seeded[0].id);
        setActiveFilter('pending');
      }
      setSuccessToast('สร้างตัวอย่างคำขอลงทะเบียนฟาร์ม & ขอสิทธิ์ Manager เรียบร้อยแล้ว');
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      console.error('Error seeding requests:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleReject = async (reasonOverride?: string) => {
    if (!selectedRequest) return;
    const finalReason = (reasonOverride || rejectReason || '').trim() || 'เอกสารหรือข้อมูลไม่ผ่านเกณฑ์การตรวจสอบ';
    const adminName = currentUser?.displayName || currentUser?.username || 'Admin';
    const now = new Date().toISOString();

    setProcessingId(selectedRequest.id);
    try {
      await rejectFarmRequest(selectedRequest.id, adminName, finalReason, 'rejected');

      const updatedReq: FarmRegistrationRequest = {
        ...selectedRequest,
        status: 'rejected',
        reviewedBy: adminName,
        reviewedAt: now,
        adminNotes: finalReason,
      };

      setRequests((prev) => prev.map((r) => (r.id === selectedRequest.id ? updatedReq : r)));
      setSelectedId(updatedReq.id);
      setActiveFilter('rejected');

      setIsRejectBoxOpen(false);
      setRejectReason('');
      setSuccessToast(`ปฏิเสธคำขอของ "${selectedRequest.userDisplayName}" เรียบร้อยแล้ว`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      console.error('Error rejecting request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSendRevision = async () => {
    if (!selectedRequest) return;
    if (!revisionNotes.trim()) {
      return;
    }

    const adminName = currentUser?.displayName || currentUser?.username || 'Admin';
    const now = new Date().toISOString();

    setProcessingId(selectedRequest.id);
    try {
      await rejectFarmRequest(selectedRequest.id, adminName, revisionNotes.trim(), 'needs_revision');

      const updatedReq: FarmRegistrationRequest = {
        ...selectedRequest,
        status: 'needs_revision',
        reviewedBy: adminName,
        reviewedAt: now,
        adminNotes: revisionNotes.trim(),
      };

      setRequests((prev) => prev.map((r) => (r.id === selectedRequest.id ? updatedReq : r)));
      setSelectedId(updatedReq.id);
      setActiveFilter('rejected');

      setIsRevisionBoxOpen(false);
      setRevisionNotes('');
      setSuccessToast(`ส่งข้อความแจ้งเตือนให้ "${selectedRequest.userDisplayName}" แก้ไขข้อมูลเรียบร้อย`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      console.error('Error sending revision:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleResetToPending = async () => {
    if (!selectedRequest) return;
    const adminName = currentUser?.displayName || currentUser?.username || 'Admin';
    const now = new Date().toISOString();

    setProcessingId(selectedRequest.id);
    try {
      await resetFarmRequestToPending(selectedRequest.id, adminName);

      const updatedReq: FarmRegistrationRequest = {
        ...selectedRequest,
        status: 'pending',
        reviewedBy: adminName,
        reviewedAt: now,
        adminNotes: '',
      };

      setRequests((prev) => prev.map((r) => (r.id === selectedRequest.id ? updatedReq : r)));
      setSelectedId(updatedReq.id);
      setActiveFilter('pending');
      setSuccessToast(`ดึงคำขอของ "${selectedRequest.userDisplayName}" กลับมารอการตรวจสอบแล้ว`);
      setTimeout(() => setSuccessToast(''), 3500);
    } catch (err: any) {
      console.error('Error resetting request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
      onClick={() => handleClose()}
    >
      <div
        className="bg-canvas text-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl border border-line relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-line bg-[#0a2014] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold to-[#ab761b] text-gold-ink flex items-center justify-center font-black shadow-md shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  ระบบอนุมัติคำขอ & ตรวจรับรองมาตรฐานฟาร์ม (Admin Approval Hub)
                </h2>
                <span className="text-[10px] font-black bg-gold/20 text-gold-soft border border-gold/40 px-2 py-0.5 rounded-full">
                  Admin Central
                </span>
              </div>
              <p className="text-xs text-fg-2">
                ตรวจสอบยืนยันตัวตนเจ้าของสวน พร้อมตรวจรับรองมาตรฐานแปลง GAP/GI เพื่ออนุมัติสิทธิ์ Manager และเปิดหน้าฟาร์ม
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSeedSamples()}
              disabled={isSeeding}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-[#1e4c33] text-leaf border border-[#235b3a] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="เพิ่มข้อมูลตัวอย่างคำขอสำหรับทดสอบระบบ"
            >
              {isSeeding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PlusCircle className="w-3.5 h-3.5" />
              )}
              <span>+ ตัวอย่างคำขอทดสอบ</span>
            </button>

            <button
              onClick={() => handleClose()}
              className="p-2 text-fg-2 hover:text-white hover:bg-surface-2 rounded-full transition-colors border border-line cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success Alert Toast */}
        {successToast && (
          <div className="bg-surface-2 border-b border-leaf/50 px-4 py-2 text-xs font-bold text-leaf flex items-center justify-center gap-2 animate-in slide-in-from-top">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Filter Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#05140c] border-b border-line flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleFilterChange('pending')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                activeFilter === 'pending'
                  ? 'bg-gradient-to-r from-gold to-[#c28723] text-gold-ink font-black shadow-xs'
                  : 'bg-surface text-fg-2 hover:text-white border border-line'
              }`}
            >
              <span>รอการตรวจสอบ ({pendingCount})</span>
              {unreadPendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            {/*
              กองงานคนละชนิด คือใบรับรองระดับโซนที่รอจับคู่สวนเข้ากับโซน

              วางไว้ติดกับแท็บรอการตรวจสอบ เพราะเป็นงานค้างเหมือนกัน และเพราะบนมือถือ
              แถบแท็บเลื่อนแนวนอน ถ้าไปอยู่ท้ายสุดจะตกขอบจอไปทั้งตัวนับและจุดแจ้งเตือน
              ซึ่งแปลว่าแอดมินที่ใช้มือถือจะไม่มีวันรู้เลยว่ามีคำขอค้างอยู่
            */}
            <button
              onClick={() => handleFilterChange('regional')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${
                activeFilter === 'regional'
                  ? 'bg-gradient-to-r from-gold to-[#c28723] text-gold-ink font-black shadow-xs'
                  : 'bg-surface text-fg-2 hover:text-white border border-line'
              }`}
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>จับคู่ใบระดับโซน ({regionalPendingCount})</span>
              {regionalPendingCount > 0 && activeFilter !== 'regional' && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => handleFilterChange('approved')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer text-xs font-bold ${
                activeFilter === 'approved'
                  ? 'bg-leaf text-canvas font-black shadow-xs'
                  : 'bg-surface text-fg-2 hover:text-white border border-line'
              }`}
            >
              อนุมัติแล้ว ({approvedCount})
            </button>

            <button
              onClick={() => handleFilterChange('rejected')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer text-xs font-bold ${
                activeFilter === 'rejected'
                  ? 'bg-rose-600 text-white font-black shadow-xs'
                  : 'bg-surface text-fg-2 hover:text-white border border-line'
              }`}
            >
              ส่งกลับแก้ไข / ปฏิเสธ ({rejectedCount})
            </button>

            <button
              onClick={() => handleFilterChange('all')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer text-xs font-bold ${
                activeFilter === 'all'
                  ? 'bg-[#1e4c33] text-white font-black shadow-xs border border-leaf'
                  : 'bg-surface text-fg-2 hover:text-white border border-line'
              }`}
            >
              ทั้งหมด ({allCount})
            </button>

            {/*
              รายงานการล้างข้อมูลส่วนตัว เป็นงานตรวจสอบที่เปิดดูนาน ๆ ครั้ง
              ไม่ใช่กองงานประจำวัน จึงวางท้ายสุด ต่างจากแท็บจับคู่ใบระดับโซน
              ที่มีงานค้างรอคนจัดการและต้องเห็นตั้งแต่แรก
            */}
            <button
              onClick={() => handleFilterChange('retention')}
              className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${
                activeFilter === 'retention'
                  ? 'bg-[#1e4c33] text-white font-black shadow-xs border border-leaf'
                  : 'bg-surface text-fg-2 hover:text-white border border-line'
              }`}
            >
              <Eraser className="w-3.5 h-3.5 shrink-0" />
              <span>บันทึกการล้างข้อมูล</span>
            </button>
          </div>
        </div>

        {activeFilter === 'retention' ? (
          <DataRetentionLogPanel />
        ) : activeFilter === 'regional' ? (
          <RegionalCertLinkPanel onResolved={refreshRegionalPendingCount} />
        ) : (
        /* Main Body: 2-Column Split (List & Details) */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: Request List Cards */}
          <div className="w-full md:w-5/12 border-b md:border-b-0 md:border-r border-line overflow-y-auto p-3 space-y-2.5 bg-[#05140c]">
            {filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-xs text-fg-2 space-y-3 px-4">
                <FileCheck className="w-10 h-10 mx-auto text-line" />
                <p className="font-semibold text-white">ไม่มีคำขอในหมวดนี้</p>
                <p className="text-[11px] text-fg-2">
                  เมื่อมีเกษตรกรยื่นเรื่องขอสิทธิ์หรือลงทะเบียนฟาร์ม รายการจะปรากฏที่นี่
                </p>
                <button
                  onClick={() => handleSeedSamples()}
                  disabled={isSeeding}
                  className="mt-2 px-4 py-2 bg-gradient-to-r from-gold to-[#c28723] hover:from-[#f0b548] hover:to-gold-hi text-gold-ink font-black text-xs rounded-xl shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>สร้างคำขอตัวอย่างเพื่อทดสอบ</span>
                </button>
              </div>
            ) : (
              filteredRequests.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                return (
                  <div
                    key={req.id}
                    onClick={() => {
                      setSelectedId(req.id);
                      markRequestsAsRead(req.id);
                      setIsRevisionBoxOpen(false);
                      setIsRejectBoxOpen(false);
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer text-left space-y-1.5 ${
                      isSelected
                        ? 'bg-[#0e2e1e] border-gold shadow-md ring-1 ring-gold/40'
                        : 'bg-panel border-line hover:border-[#2a613f]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        {!readIds.has(req.id) && req.status === 'pending' && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-sm animate-pulse" title="คำขอใหม่ ยังไม่ได้เปิดดู" />
                        )}
                        <div className="font-bold text-xs sm:text-sm text-white truncate">
                          {req.farmName || req.userDisplayName}
                        </div>
                        {req.requestType === 'update_farm' && (
                          <span className="text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded-md shrink-0">
                            ขอแก้ไข
                          </span>
                        )}
                      </div>
                      {req.status === 'pending' && (
                        <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-md shrink-0">
                          รอตรวจ
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-md shrink-0">
                          อนุมัติแล้ว
                        </span>
                      )}
                      {req.status === 'needs_revision' && (
                        <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 px-1.5 py-0.5 rounded-md shrink-0">
                          ขอให้แก้ไข
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded-md shrink-0">
                          ปฏิเสธ
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-fg-2">
                      <span className="text-white font-medium">{req.farmerFullName || req.userDisplayName}</span>
                      <span>•</span>
                      <span>{req.province}</span>
                      <span>•</span>
                      <span className="font-mono text-leaf">{req.gapCertNumber || 'GAP'}</span>
                    </div>

                    {req.adminNotes && (
                      <div className="text-[10px] text-amber-200 bg-amber-950/40 px-2 py-1 rounded-md truncate border border-amber-800/40">
                        ⚠️ บันทึก: {req.adminNotes}
                      </div>
                    )}

                    <div className="text-[10px] text-fg-2 flex items-center justify-between pt-1 border-t border-line/60">
                      <span className="truncate">พื้นที่: <strong className="text-white">{req.areaRai} ไร่</strong> (~{req.totalTreesEstimate} ต้น)</span>
                      <span className="shrink-0">{new Date(req.createdAt).toLocaleDateString('th-TH')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Detailed Request Inspection Card */}
          <div className="w-full md:w-7/12 overflow-y-auto p-4 sm:p-6 bg-canvas flex flex-col justify-between space-y-4">
            {selectedRequest ? (
              <div className="space-y-4 text-xs sm:text-sm">
                {/* Header Status Banner */}
                <div className="bg-gradient-to-r from-surface via-canvas to-surface p-3.5 rounded-2xl border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-[#ab761b] text-gold-ink flex items-center justify-center font-black text-sm shrink-0 shadow-md">
                      <Sprout className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">
                          {selectedRequest.farmName}
                        </span>
                        <span className="text-[10px] font-black bg-gold/20 text-gold-soft border border-gold/40 px-2 py-0.5 rounded-full">
                          {selectedRequest.requestType === 'update_farm' ? 'Update Farm' : 'New Farm & Manager'}
                        </span>
                      </div>
                      <p className="text-[11px] text-fg-2">
                        ผู้ยื่น: <strong className="text-white">{selectedRequest.userDisplayName}</strong> ({selectedRequest.userEmailOrUsername})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-fg-2">
                      ยื่นเมื่อ: {new Date(selectedRequest.createdAt).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                </div>

                {/* Section 1: Farmer Identity Verification */}
                <div className="p-3.5 bg-well rounded-2xl border border-line space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-gold">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span>1. ข้อมูลยืนยันตัวตนเจ้าของสวน (Farmer Identity)</span>
                    </div>
                    <span className="text-[10px] font-mono bg-surface-2 text-leaf px-2 py-0.5 rounded-full">
                      ยืนยันตัวตนแล้ว
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-panel p-3 rounded-xl border border-line">
                    <div>
                      <span className="text-fg-2">ชื่อ-นามสกุลจริง:</span>
                      <p className="font-bold text-white mt-0.5">{selectedRequest.farmerFullName || selectedRequest.userDisplayName}</p>
                    </div>
                    <div>
                      <span className="text-fg-2">เลขประจำตัวประชาชน (13 หลัก):</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="font-mono font-bold text-gold-soft">
                          {revealedIdCard?.requestId === selectedRequest.id && revealedIdCard.number
                            ? revealedIdCard.number
                            : selectedRequest.farmerIdCardMasked || '-'}
                        </p>
                        {selectedRequest.farmerIdCardMasked &&
                          revealedIdCard?.requestId !== selectedRequest.id && (
                            <button
                              type="button"
                              disabled={revealBusy}
                              onClick={() => handleRevealIdCard(selectedRequest.id, false, '')}
                              className="px-2 py-0.5 bg-surface-2 hover:bg-[#1f4c33] text-leaf border border-[#235b3a] rounded-md text-[10px] font-bold cursor-pointer transition-colors disabled:opacity-50"
                            >
                              {revealBusy ? 'กำลังขอ...' : 'ขอดูเลขเต็ม'}
                            </button>
                          )}
                      </div>
                    </div>
                    <div>
                      <span className="text-fg-2">เบอร์โทรศัพท์ติดต่อ:</span>
                      <p className="font-bold text-white mt-0.5">{selectedRequest.contact?.phoneNumber || '-'}</p>
                    </div>
                    <div>
                      <span className="text-fg-2">LINE ID:</span>
                      <p className="font-bold text-white mt-0.5">{selectedRequest.contact?.lineId || '-'}</p>
                    </div>
                  </div>

                  {/* ID Card Document View Button */}
                  {revealError?.requestId === selectedRequest.id && (
                    <div className="p-2 bg-rose-950/60 border border-rose-800 rounded-lg text-[11px] font-bold text-rose-200">
                      {revealError.message}
                    </div>
                  )}

                  {selectedRequest.hasIdCardPhoto && (
                    <div className="flex items-center justify-between p-2.5 bg-panel rounded-xl border border-line">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gold" />
                        <span className="text-xs text-white font-medium">เอกสารสำเนาบัตรประชาชนเจ้าของสวน</span>
                      </div>
                      <button
                        type="button"
                        disabled={revealBusy}
                        onClick={() =>
                          handleRevealIdCard(
                            selectedRequest.id,
                            true,
                            `สำเนาบัตรประชาชน - ${selectedRequest.farmerFullName || selectedRequest.userDisplayName}`
                          )
                        }
                        className="px-3 py-1.5 bg-surface-2 hover:bg-[#1f4c33] text-leaf border border-[#235b3a] rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{revealBusy ? 'กำลังเปิด...' : 'เปิดดูเอกสารบัตร'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Section 2: Farm Location & GPS Details */}
                <div className="p-3.5 bg-well rounded-2xl border border-line space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-gold">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span>2. ข้อมูลแปลงสวน & แผนที่พิกัด GPS</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-panel p-3 rounded-xl border border-line">
                    <div>
                      <span className="text-fg-2">จังหวัด:</span>
                      <p className="font-bold text-white mt-0.5">{selectedRequest.province}</p>
                    </div>
                    <div>
                      <span className="text-fg-2">อำเภอ:</span>
                      <p className="font-bold text-white mt-0.5">{selectedRequest.district}</p>
                    </div>
                    <div>
                      <span className="text-fg-2">ขนาดพื้นที่:</span>
                      <p className="font-bold text-white mt-0.5">{selectedRequest.areaRai} ไร่</p>
                    </div>
                    <div>
                      <span className="text-fg-2">จำนวนต้นโดยประมาณ:</span>
                      <p className="font-bold text-white mt-0.5">{selectedRequest.totalTreesEstimate} ต้น</p>
                    </div>
                  </div>

                  {selectedRequest.locationAddress && (
                    <div className="text-xs bg-panel p-2.5 rounded-xl border border-line text-fg-2">
                      ที่ตั้งแปลง: <span className="text-white font-medium">{selectedRequest.locationAddress}</span>
                    </div>
                  )}

                  {selectedRequest.coordinates && (
                    <div className="flex items-center justify-between p-2.5 bg-panel rounded-xl border border-line">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-fg-2">พิกัด GPS แปลงจริง:</span>
                        <span className="font-mono text-leaf font-bold">
                          {selectedRequest.coordinates.lat.toFixed(4)}, {selectedRequest.coordinates.lng.toFixed(4)}
                        </span>
                      </div>
                      <a
                        href={selectedRequest.googleMapsUrl || `https://maps.google.com/?q=${selectedRequest.coordinates.lat},${selectedRequest.coordinates.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-surface-2 hover:bg-[#1f4c33] text-leaf border border-[#235b3a] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>เปิด Google Maps</span>
                      </a>
                    </div>
                  )}
                </div>

                {/*
                  Section 3: ใบรับรองมาตรฐาน

                  เดิมส่วนนี้วางอยู่บนสมมติฐานว่าคำขอหนึ่งมีใบเดียวคือ GAP หัวข้อสามช่อง
                  อ่านจากคอลัมน์ชุดเก่าที่รองรับใบเดียว ส่วนรายการใบที่แนบมาแสดงแค่รหัส
                  กับเลขที่ แอดมินจึงตัดสินใบ GMP หรือ GACC โดยไม่เห็นหน่วยงานผู้ออก
                  และวันหมดอายุของใบนั้นเลย ทั้งที่สองอย่างนี้คือสิ่งที่ใช้ตรวจว่าใบยังใช้ได้จริง
                */}
                <div className="p-3.5 bg-well rounded-2xl border border-line space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-gold">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      <span>3. การรับรองมาตรฐานทางการเกษตร</span>
                    </div>
                    {certList.length > 0 && (
                      <span className="text-[11px] font-bold text-fg-2">{certList.length} ใบ</span>
                    )}
                  </div>

                  {certList.length === 0 ? (
                    /*
                      คำขอรุ่นเก่าที่กรอกมาก่อนระบบรองรับหลายใบ

                      แสดงเฉพาะตอนไม่มีรายการใบ ให้ตรงกับตอนอนุมัติพอดี เพราะเซิร์ฟเวอร์
                      ใช้คอลัมน์ชุดเดิมเป็นทางสำรองเฉพาะกรณีนี้เท่านั้น ถ้าโชว์ทั้งคู่เสมอ
                      คำขอยุคใหม่จะเห็นช่องว่างเปล่าสามช่องโดยไม่รู้ว่าแปลว่าอะไร
                    */
                    <div
                      data-testid="legacy-cert-fields"
                      className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-panel p-3 rounded-xl border border-line"
                    >
                      <div>
                        <span className="text-fg-2">เลขที่ใบรับรอง GAP:</span>
                        <p className="font-mono font-bold text-leaf mt-0.5">{selectedRequest.gapCertNumber || '-'}</p>
                      </div>
                      <div>
                        <span className="text-fg-2">หน่วยงานผู้ออกใบรับรอง:</span>
                        <p className="font-bold text-white mt-0.5">{selectedRequest.certIssuedBy || '-'}</p>
                      </div>
                      <div>
                        <span className="text-fg-2">ใช้ได้ถึงปี:</span>
                        <p className="font-bold text-white mt-0.5">{selectedRequest.certValidUntil || '-'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {certList.map((cert, idx) => {
                        const type = certTypeByCode.get(cert.shortCode);
                        const label = type?.nameTh || cert.nameTh || cert.name || cert.shortCode;
                        // tier จากฐานเชื่อถือได้กว่าค่าที่ติดมากับคำขอ เพราะคำขอเก่า
                        // ยื่นมาตั้งแต่ก่อนระบบเก็บ tier จึงไม่มีค่านี้เลย
                        const isRegional = (type?.tier ?? cert.tier) === 'regional';

                        return (
                          <div
                            key={idx}
                            data-testid="request-cert-row"
                            className="p-2.5 bg-panel rounded-xl border border-line space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-2 py-0.5 rounded-md bg-surface-2 text-leaf font-black text-[10px] shrink-0">
                                  {cert.shortCode}
                                </span>
                                <span className="text-xs text-white truncate">{label}</span>
                              </div>
                              {cert.documentPhoto && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDoc({
                                      title: `${label} - ${selectedRequest.farmName}`,
                                      fileUrl: cert.documentPhoto!,
                                      fileType: cert.fileType || 'image',
                                      fileName: cert.fileName,
                                    })
                                  }
                                  className="px-2.5 py-1 bg-surface-2 hover:bg-[#1f4c33] text-leaf border border-[#235b3a] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>เปิดดู</span>
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-fg-2 text-[11px]">เลขที่ใบรับรอง:</span>
                                <p className="font-mono font-bold text-leaf mt-0.5">{cert.certNumber || '-'}</p>
                              </div>
                              <div>
                                <span className="text-fg-2 text-[11px]">หน่วยงานผู้ออก:</span>
                                <p className="font-bold text-white mt-0.5">{cert.issuedBy || '-'}</p>
                              </div>
                              <div>
                                <span className="text-fg-2 text-[11px]">ใช้ได้ถึง:</span>
                                <p className="font-bold text-white mt-0.5">{cert.validUntil || '-'}</p>
                              </div>
                            </div>

                            {isRegional && (
                              /*
                                ใบระดับโซนไม่ได้ขึ้นตราทันทีที่อนุมัติ เพราะเป็นใบของพื้นที่
                                ระบบไม่รู้เองว่าสวนนี้อยู่โซนไหน จึงไปรอที่คิวจับคู่โซนต่อ
                                ถ้าไม่บอกตรงนี้ แอดมินจะเข้าใจว่ากดอนุมัติแล้วจบ
                              */
                              <p className="flex items-start gap-1.5 text-[11px] text-fg-2 bg-well px-2 py-1.5 rounded-lg border border-line">
                                <Info className="w-3.5 h-3.5 text-gold shrink-0 mt-px" />
                                <span>
                                  ใบระดับโซน ตราจะขึ้นหลังอนุมัติแล้วไปจับคู่โซนที่แท็บ
                                  จับคู่ใบระดับโซน อีกขั้นหนึ่ง
                                </span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section 4: Atmosphere, Story & Tech */}
                <div className="p-3.5 bg-well rounded-2xl border border-line space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-gold">
                    <div className="flex items-center gap-1.5">
                      <TreePine className="w-4 h-4" />
                      <span>4. เรื่องราวสวน, พันธุ์ทุเรียน & ภาพบรรยากาศ</span>
                    </div>
                  </div>

                  {selectedRequest.topVarieties && selectedRequest.topVarieties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRequest.topVarieties.map((v, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-lg bg-surface-2 text-gold-soft text-xs font-medium border border-[#235b3a]">
                          🍈 {v}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedRequest.aboutStory && (
                    <div className="text-xs text-fg-2 bg-panel p-3 rounded-xl border border-line leading-relaxed">
                      "{selectedRequest.aboutStory}"
                    </div>
                  )}

                  {selectedRequest.atmospherePhotos && selectedRequest.atmospherePhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedRequest.atmospherePhotos.map((photo, i) => (
                        <img
                          key={i}
                          src={photo}
                          alt="Atmosphere"
                          className="h-20 w-full object-cover rounded-xl border border-line"
                          referrerPolicy="no-referrer"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Revision Form Box */}
                {isRevisionBoxOpen && (
                  <div className="bg-[#122216] p-4 rounded-2xl border border-sky-500/60 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-sky-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-sky-400" />
                        <span>ระบุสิ่งที่ต้องการให้เกษตรกรแก้ไขเพิ่มเติม:</span>
                      </label>
                      <span className="text-[10px] text-fg-2">คลิกข้อความด่วนหรือพิมพ์เอง</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'แนบรูปถ่ายใบรับรอง GAP ที่ชัดเจนขึ้น',
                        'รูปถ่ายบัตรประชาชนไม่ชัดเจน โปรดถ่ายใหม่อีกครั้ง',
                        'กรุณาตรวจสอบพิกัด GPS แปลงสวนให้ตรงกับความเป็นจริง',
                        'เพิ่มภาพถ่ายบรรยากาศแปลงปลูกจริง',
                      ].map((tag, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRevisionNotes(tag)}
                          className="text-[10px] bg-sky-950/60 hover:bg-sky-900 text-sky-200 border border-sky-800/80 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={2}
                      placeholder="พิมพ์คำแนะนำในการแก้ไข..."
                      value={revisionNotes}
                      onChange={(e) => setRevisionNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-[#08150c] border border-sky-900/80 rounded-xl text-white placeholder-sky-700/60 focus:outline-hidden focus:border-sky-500 text-xs resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsRevisionBoxOpen(false)}
                        className="px-3 py-1.5 text-xs text-fg-2 hover:text-white rounded-lg cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => handleSendRevision()}
                        disabled={Boolean(processingId) || !revisionNotes.trim()}
                        className="px-4 py-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>ส่งข้อความแจ้งแก้ไข</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Reject Form Box */}
                {isRejectBoxOpen && (
                  <div className="bg-[#180808] p-4 rounded-2xl border border-rose-600/60 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>เหตุผลในการปฏิเสธคำขอ:</span>
                      </label>
                      <span className="text-[10px] text-fg-2">คลิกเหตุผลด่วนหรือพิมพ์เอง</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'ไม่สามารถยืนยันตัวตนเจ้าของสวนได้',
                        'ข้อมูลบัตรประชาชนไม่ถูกต้อง',
                        'เอกสาร GAP ไม่ถูกต้องตามเกณฑ์มาตรฐาน',
                        'ข้อมูลแปลงปลูกไม่ตรงกับความเป็นจริง',
                      ].map((tag, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRejectReason(tag)}
                          className="text-[10px] bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/80 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={2}
                      placeholder="ระบุเหตุผลการปฏิเสธ (หากเว้นว่างจะใช้ข้อความมาตรฐาน)..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0d0404] border border-rose-900/80 rounded-xl text-white placeholder-rose-700/60 focus:outline-hidden focus:border-rose-500 text-xs resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsRejectBoxOpen(false)}
                        className="px-3 py-1.5 text-xs text-fg-2 hover:text-white rounded-lg cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => handleReject()}
                        disabled={Boolean(processingId)}
                        className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>ยืนยันปฏิเสธคำขอ</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons Bar */}
                <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2.5">
                  {/* Left Side: Reset to Pending if rejected or needs_revision */}
                  <div>
                    {(selectedRequest.status === 'rejected' || selectedRequest.status === 'needs_revision') && (
                      <button
                        onClick={() => handleResetToPending()}
                        disabled={Boolean(processingId)}
                        className="px-3 py-2 bg-surface hover:bg-surface-2 border border-line text-fg-2 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                        title="เปลี่ยนสถานะกลับเป็นรอการตรวจสอบเพื่อให้พิจารณาใหม่"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-gold-soft" />
                        <span>ดึงกลับมาเป็นรอตรวจ</span>
                      </button>
                    )}
                  </div>

                  {/* Right Side: Primary Actions */}
                  <div className="flex items-center gap-2">
                    {/* Reject Button */}
                    <button
                      onClick={() => {
                        setIsRejectBoxOpen(!isRejectBoxOpen);
                        setIsRevisionBoxOpen(false);
                      }}
                      disabled={Boolean(processingId)}
                      className="px-3.5 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>ปฏิเสธคำขอ</span>
                    </button>

                    {/* Request Revision Button */}
                    <button
                      onClick={() => {
                        setIsRevisionBoxOpen(!isRevisionBoxOpen);
                        setIsRejectBoxOpen(false);
                      }}
                      disabled={Boolean(processingId)}
                      className="px-3.5 py-2.5 bg-surface hover:bg-surface-2 border border-line text-sky-300 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>ขอให้แก้ไข / ส่งกลับ</span>
                    </button>

                    {/* Approve Button */}
                    <button
                      onClick={() => handleApprove(selectedRequest)}
                      disabled={Boolean(processingId) || selectedRequest.status === 'approved'}
                      className="px-5 py-2.5 bg-gradient-to-r from-gold to-[#c28723] hover:from-[#f0b548] hover:to-gold-hi text-gold-ink font-black text-xs sm:text-sm rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      {processingId === selectedRequest.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังดำเนินการ...</span>
                        </>
                      ) : selectedRequest.status === 'approved' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>อนุมัติและนำฟาร์มขึ้นระบบแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>อนุมัติสิทธิ์ Manager & รับรองมาตรฐานฟาร์ม</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-fg-2 space-y-2">
                <FileCheck className="w-10 h-10 text-line" />
                <p className="text-xs">กรุณาเลือกรายการคำขอทางด้านซ้ายเพื่อดูรายละเอียด</p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* High-Resolution Document & File Lightbox Viewer */}
      <DocumentViewerModal
        data={previewDoc}
        onClose={() => {
          setPreviewDoc(null);
          clearRevealedIdCard();
        }}
      />
    </div>
  );
};
