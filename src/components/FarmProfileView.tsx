import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Star,
  MapPin,
  Award,
  CheckCircle2,
  Share2,
  Phone,
  Camera,
  X,
  ExternalLink,
  FileText,
  Sliders,
  FileEdit,
  Send,
} from 'lucide-react';
import { DurianFarm, IndividualTree, FruitTreeVariety, UserRole, SmartTechItem } from '../types';
import { TreeDetailView } from './TreeDetailView';
import { FarmTreesTab, type TreeFilter, type TreeSort } from './FarmTreesTab';
import { FarmCertificationsTab, type CertDocView } from './FarmCertificationsTab';
import { FarmAboutTab } from './FarmAboutTab';
import { FarmPhotoGalleryOverlay } from './FarmPhotoGalleryOverlay';
import { FarmPhotoManagerModal } from './FarmPhotoManagerModal';
import { FarmSmartTechConfigModal } from './FarmSmartTechConfigModal';
import { FarmRegistrationModal } from './FarmRegistrationModal';
import { saveFarm } from '../services/farmService';
import { useAuth } from '../context/AuthContext';
import { openPdfDocument } from '../utils/pdfUtils';

interface FarmProfileViewProps {
  farm: DurianFarm;
  currentRole?: UserRole;
  onBack: () => void;
  onSelectVariety?: (variety: FruitTreeVariety) => void;
}

/**
 * ตัวเลขหนึ่งตัวในแถบสถิติ -- ค่าอยู่บน ป้ายกำกับอยู่ล่าง
 * ตั้งขนาดใหญ่โดยตั้งใจ ตัวเลขคือสิ่งที่คนมาดูหน้าฟาร์มอยากรู้ก่อน
 */
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0">
    <div className="text-xl sm:text-2xl font-black text-fg tabular-nums leading-none">{value}</div>
    <div className="text-[11px] sm:text-xs text-fg-2 mt-1.5 truncate">{label}</div>
  </div>
);

const SAMPLE_GARDEN_PHOTOS = [
  'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=800&auto=format&fit=crop&q=80',
];

const DEFAULT_SMART_TECH_OPTIONS = [
  { id: 'st-d1', name: 'ระบบน้ำหยดอัตโนมัติ (Smart Irrigation)', subtext: 'ควบคุมผ่านแอปฯ', iconEmoji: '💧' },
  { id: 'st-d2', name: 'เซ็นเซอร์วัดความชื้นดินและสภาพอากาศ', subtext: 'อัปเดตทุก 15 นาที', iconEmoji: '🌡️' },
  { id: 'st-d3', name: 'โดรนพ่นปุ๋ย / สำรวจสุขภาพแปลง', subtext: 'ลดการใช้สารเคมี 40%', iconEmoji: '🚁' },
  { id: 'st-d4', name: 'Dashboard ติดตามสวนแบบ Real-time', subtext: 'มอนิเตอร์บนมือถือตลอด 24 ชม.', iconEmoji: '📊' },
  { id: 'st-d5', name: 'พลังงานแสงอาทิตย์ (Solar Farm)', subtext: 'ขับเคลื่อนระบบน้ำด้วยแสงแดด', iconEmoji: '☀️' },
  { id: 'st-d6', name: 'ระบบแท็กดิจิทัล QR-NFC ตรวจสอบย้อนกลับ', subtext: 'ระบุต้นกำเนิดผลทุเรียนรายต้น', iconEmoji: '🏷️' },
];

export const FarmProfileView: React.FC<FarmProfileViewProps> = ({
  farm: initialFarm,
  currentRole = 'user',
  onBack,
}) => {
  const { currentUser } = useAuth();
  const [currentFarm, setCurrentFarm] = useState<DurianFarm>(initialFarm);
  const [activeTab, setActiveTab] = useState<'trees' | 'certs' | 'about'>('trees');
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // ตัวกรอง คำค้น และลำดับการเรียงของแท็บต้นไม้
  //
  // เก็บไว้ที่นี่แม้จะใช้จริงแค่ใน FarmTreesTab เพราะ selectedTree ข้างล่าง
  // ทำให้คอมโพเนนต์นี้ return หน้ารายละเอียดต้นไม้ออกมาแทนทั้งหน้า
  // แท็บจึงถูก unmount ถ้า state อยู่ในแท็บ ค่าที่ผู้ใช้ตั้งไว้จะหาย
  // ตอนกดย้อนกลับจากหน้าต้นไม้
  const [treeFilter, setTreeFilter] = useState<TreeFilter>('all');
  const [treeSearch, setTreeSearch] = useState('');
  const [treeSort, setTreeSort] = useState<TreeSort>('rating');

  const [selectedTree, setSelectedTree] = useState<IndividualTree | null>(null);

  // Modals
  const [isPhotoManagerOpen, setIsPhotoManagerOpen] = useState(false);
  const [isSmartTechModalOpen, setIsSmartTechModalOpen] = useState(false);
  const [isUpdateRequestModalOpen, setIsUpdateRequestModalOpen] = useState(false);
  const [updateSuccessToast, setUpdateSuccessToast] = useState('');
  // อยู่ที่นี่ไม่ได้ย้ายลงไปในแท็บ เพราะหน้าต่างแสดงเอกสารข้างล่างเป็นคนอ่านค่านี้
  // ซึ่ง render อยู่คนละกิ่งกับแท็บใบรับรอง
  const [selectedCertDoc, setSelectedCertDoc] = useState<CertDocView | null>(null);


  // Smart farm form state
  const [tempHasSmartFarm, setTempHasSmartFarm] = useState<boolean>(
    currentFarm.hasSmartFarm ?? (currentFarm.smartTechnologies && currentFarm.smartTechnologies.length > 0 ? true : false)
  );
  const [tempSmartTechList, setTempSmartTechList] = useState<SmartTechItem[]>(
    currentFarm.smartTechnologies && currentFarm.smartTechnologies.length > 0
      ? currentFarm.smartTechnologies
      : DEFAULT_SMART_TECH_OPTIONS.map((t) => ({ ...t, active: true }))
  );

  // Check if current user is owner or admin
  const isOwnerOrAdmin =
    currentRole === 'admin' ||
    (currentUser && currentFarm.managerId === currentUser.uid);

  // Garden Atmosphere photos ONLY (no certificate photos in the gallery)
  /**
   * บันทึกรูปบรรยากาศสวน
   *
   * คงลำดับเดิมไว้ทุกอย่าง คืออัปเดตหน้าจอก่อนแล้วค่อยรอผลจากเซิร์ฟเวอร์
   * ถ้าบันทึกไม่สำเร็จ โมดัลจะเปิดค้างไว้และไม่ขึ้นข้อความสำเร็จ
   *
   * เป็นพฤติกรรมเดิมก่อนแยกไฟล์ ย้ายมาเฉยๆ ไม่ได้ปรับปรุงระหว่างทาง
   */
  const handleSavePhotos = async (photos: string[]) => {
    try {
      const updatedFarm: DurianFarm = {
        ...currentFarm,
        atmospherePhotos: photos,
        photos: photos,
      };
      setCurrentFarm(updatedFarm);
      await saveFarm(updatedFarm);
      setIsPhotoManagerOpen(false);
      setUpdateSuccessToast('บันทึกรูปภาพบรรยากาศสวนเรียบร้อยแล้ว');
      setTimeout(() => setUpdateSuccessToast(''), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  const displayPhotos = useMemo(() => {
    if (currentFarm.atmospherePhotos && currentFarm.atmospherePhotos.length > 0) {
      return currentFarm.atmospherePhotos;
    }
    if (currentFarm.photos && currentFarm.photos.length > 0) {
      return currentFarm.photos;
    }
    return SAMPLE_GARDEN_PHOTOS.slice(0, 3);
  }, [currentFarm]);

  // ห่อด้วย useMemo เพราะเดิมสร้าง array ใหม่ทุกรอบ render
  // ทำให้ของที่รับค่านี้ไปคำนวณใหม่ทุกครั้งโดยไม่จำเป็น (eslint exhaustive-deps ทัก)
  const allTrees: IndividualTree[] = useMemo(
    () => currentFarm.individualTrees || [],
    [currentFarm.individualTrees]
  );

  const farmInitials = (currentFarm?.name || 'TC')
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase() || 'TC';

  /**
   * แชร์หน้าฟาร์ม -- ใช้ share sheet ของเครื่องถ้ามี ไม่มีก็คัดลอกลิงก์แทน
   * เบราว์เซอร์บนเดสก์ท็อปส่วนใหญ่ยังไม่รองรับ navigator.share
   */
  const handleShare = async () => {
    const url = window.location.href;
    const title = currentFarm.name;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setUpdateSuccessToast('คัดลอกลิงก์หน้าฟาร์มแล้ว');
      setTimeout(() => setUpdateSuccessToast(''), 2500);
    } catch {
      // ผู้ใช้กดยกเลิก share sheet เอง ไม่ต้องแจ้งอะไร
    }
  };

  // Save Smart Tech to Firestore
  const handleSaveSmartTech = async () => {
    const updated: DurianFarm = {
      ...currentFarm,
      hasSmartFarm: tempHasSmartFarm,
      smartTechnologies: tempHasSmartFarm ? tempSmartTechList : [],
    };
    setCurrentFarm(updated);
    setIsSmartTechModalOpen(false);
    try {
      await saveFarm(updated);
    } catch (err) {
      console.error('Failed to save smart tech to Firestore:', err);
    }
  };

  // Active Smart Technologies (if enabled)
  const activeSmartTech = currentFarm.smartTechnologies?.filter((t) => t.active) || [];
  const showSmartFarmCard = currentFarm.hasSmartFarm !== false && activeSmartTech.length > 0;

  /**
   * เลือกต้นไม้แล้วให้แทนที่หน้าฟาร์มทั้งหน้า ไม่ใช่เปิดหน้าต่างซ้อน
   * เป็นรูปแบบเดียวกับที่หน้าฟาร์มแทนที่หน้ารายชื่อฟาร์ม จึงย้อนกลับได้เป็นชั้น ๆ
   */
  if (selectedTree) {
    return (
      <TreeDetailView
        tree={selectedTree}
        farm={currentFarm}
        currentRole={currentRole}
        onBack={() => setSelectedTree(null)}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Main Container */}
      <div className="bg-surface text-fg rounded-3xl overflow-hidden shadow-xl border border-line">
        {/* แบนเนอร์พื้นหลัง -- รูปบรรยากาศสวนใบแรก ใช้เป็นพื้นหลังเฉย ๆ
            หรี่แสงลงมากเพื่อให้เป็นฉากหลัง ไม่แย่งความสนใจจากเนื้อหา
            ต้นแบบก็ใช้แบนเนอร์กว้างเต็มด้านบนแบบนี้ */}
        <div className="relative h-28 sm:h-40 bg-canvas overflow-hidden">
          <img
            src={displayPhotos[0]}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent pointer-events-none" />

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-canvas/70 hover:bg-canvas backdrop-blur-md rounded-full text-xs font-bold text-fg border border-line transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับ</span>
            </button>

            {isOwnerOrAdmin && (
              <button
                onClick={() => setIsPhotoManagerOpen(true)}
                className="px-3 py-1.5 bg-gold hover:bg-gold-hi text-gold-ink text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">จัดการรูป</span>
              </button>
            )}
          </div>
        </div>

        {/* Farm Identity Header & Rating Card */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* การ์ดรูปแนวตั้ง + ตัวตนของฟาร์ม วางคู่กันแบบต้นแบบ
              รูปเป็นการ์ดใบเดียวมีป้ายนับ กดแล้วเปิดดูรูปที่เหลือด้วยการเลื่อนลง
              ของเดิมเป็นแกลเลอรีเต็มความกว้างพร้อมแถบรูปย่อ ซึ่งกินพื้นที่บนสุด
              ของหน้าไปมากทั้งที่รูปบรรยากาศไม่ใช่ข้อมูลที่คนมาหา */}
          <div className="flex items-start gap-3.5 sm:gap-5 -mt-12 sm:-mt-16 relative z-10">
            <button
              onClick={() => setGalleryOpen(true)}
              className="relative shrink-0 w-[38%] max-w-[170px] aspect-3/4 rounded-2xl overflow-hidden border border-line bg-canvas cursor-pointer group"
            >
              <img
                src={displayPhotos[0]}
                alt={`บรรยากาศ${currentFarm.name}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-canvas/85 text-fg text-[11px] font-bold tabular-nums">
                1/{displayPhotos.length}
              </span>
            </button>

            <div className="min-w-0 flex-1 pt-12 sm:pt-16">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface-2 border border-line-strong flex items-center justify-center text-gold font-black text-xl sm:text-2xl font-serif mb-2.5">
                {farmInitials}
              </div>

              <h1 className="text-xl sm:text-3xl font-black text-fg tracking-tight leading-tight">
                {currentFarm.name}
              </h1>
              <div className="flex items-center gap-1 text-xs sm:text-sm text-fg-2 mt-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {currentFarm.district ? `${currentFarm.district} · ` : ''}
                  {currentFarm.province}
                </span>
              </div>
            </div>
          </div>

          {/* ตัวเลขชูโรง -- อันดับกับคะแนน วางคู่กันและตั้งขนาดใหญ่
              เหมือนที่ต้นแบบชู #1 กับ 8.9 ให้เห็นก่อนอย่างอื่น
              ของเดิมสองค่านี้ถูกยัดรวมไปกับสถิติอื่นในขนาด 16px จนจมหาย */}
          <div className="flex items-stretch rounded-2xl border border-line overflow-hidden">
            <div className="flex-1 py-3.5 text-center">
              <div className="text-3xl sm:text-4xl font-black text-fg tabular-nums leading-none">
                #{currentFarm.rank}
              </div>
              <div className="text-[11px] sm:text-xs text-fg-2 mt-1.5">อันดับทำเนียบ</div>
            </div>

            <div className="w-px bg-line" />

            <div className="flex-1 py-3.5 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Star className="w-6 h-6 sm:w-7 sm:h-7 text-gold fill-gold" />
                <span className="text-3xl sm:text-4xl font-black text-gold tabular-nums leading-none">
                  {currentFarm.rating.toFixed(1)}
                </span>
              </div>
              <div className="text-[11px] sm:text-xs text-fg-2 mt-1.5 tabular-nums">
                {currentFarm.reviewCount.toLocaleString()} รีวิว
              </div>
            </div>
          </div>

          {/* ปุ่มหลัก -- ตำแหน่งเดียวกับ Buy Now / Message ของต้นแบบ
              โทรหาฟาร์มเป็นสิ่งที่ผู้ซื้อทำจริงมากที่สุด จึงให้เป็นปุ่มเด่นสุดของหน้า */}
          <div className="flex items-center gap-2.5">
            {currentFarm.contact?.phoneNumber ? (
              <a
                href={`tel:${currentFarm.contact.phoneNumber.replace(/[^0-9+]/g, '')}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gold hover:bg-gold-hi text-gold-ink text-base font-bold rounded-2xl transition-colors"
              >
                <Phone className="w-5 h-5" />
                <span>ติดต่อฟาร์ม</span>
              </a>
            ) : null}

            <button
              onClick={handleShare}
              className="shrink-0 flex items-center justify-center gap-2 px-5 py-3.5 bg-surface-2 border border-line hover:border-line-strong text-fg-2 hover:text-fg text-base font-bold rounded-2xl transition-colors cursor-pointer"
            >
              <Share2 className="w-5 h-5" />
              <span className="hidden sm:inline">แชร์</span>
            </button>
          </div>

          {/* สถิติรอง -- วางไว้ใต้ปุ่มตามลำดับของต้นแบบ
              แสดงเฉพาะค่าที่มีข้อมูลจริง ของเดิมเติมค่าปลอมเมื่อไม่มีข้อมูล
              (พื้นที่ 48 ไร่ เก็บ 3 รอบต่อปี น้ำหนักคำนวณจากผลคูณ 3.5)
              ซึ่งแสดงเลขที่แต่งขึ้นราวกับเป็นข้อเท็จจริงของฟาร์มนั้น */}
          <div className="grid grid-cols-3 gap-x-3 gap-y-4">
            <Stat label="ต้นทุเรียน" value={currentFarm.totalTrees.toLocaleString()} />
            <Stat label="ผลผลิตสะสม" value={currentFarm.harvestedFruits.toLocaleString()} />
            <Stat
              label="สายพันธุ์"
              value={String(currentFarm.varietiesCount || currentFarm.topVarieties?.length || 0)}
            />
            {currentFarm.areaRai ? <Stat label="พื้นที่ (ไร่)" value={String(currentFarm.areaRai)} /> : null}
            {currentFarm.establishedYear ? (
              <Stat label="ก่อตั้งเมื่อ" value={String(currentFarm.establishedYear)} />
            ) : null}
            <Stat label="ต้นที่ขึ้นทะเบียน" value={String(allTrees.length)} />
          </div>

          {/* เรื่องราวของฟาร์ม -- ย้ายขึ้นมาไว้ใต้สถิติตามผังต้นแบบ
              ของเดิมซ่อนอยู่ในแท็บ "ประวัติฟาร์ม" ซึ่งคนส่วนใหญ่ไม่ได้กดเข้าไปดู */}
          {(currentFarm.highlight || currentFarm.aboutStory) && (
            <div className="space-y-1.5">
              {currentFarm.highlight && (
                <p className="text-sm text-fg font-medium leading-relaxed">{currentFarm.highlight}</p>
              )}
              {currentFarm.aboutStory && (
                <>
                  <p
                    className={`text-xs text-fg-2 leading-relaxed ${
                      storyExpanded ? '' : 'line-clamp-3'
                    }`}
                  >
                    {currentFarm.aboutStory}
                  </p>
                  <button
                    onClick={() => setStoryExpanded((v) => !v)}
                    className="text-xs font-bold text-gold-soft hover:text-gold cursor-pointer"
                  >
                    {storyExpanded ? 'ย่อลง' : 'อ่านเพิ่มเติม'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ช่องทางติดต่อ -- ย้ายลงมาไว้ใต้เรื่องราวตามผังต้นแบบ
              ของเดิมอยู่เหนือสถิติ ซึ่งดันเนื้อหาหลักของฟาร์มให้ลงไปอยู่ล่าง */}
          <div className="grid grid-cols-3 gap-2 text-xs font-bold">
            <a
              href={currentFarm.contact?.facebook || 'https://facebook.com'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-surface-2 border border-line hover:border-line-strong text-fg-2 hover:text-fg rounded-xl transition-colors"
            >
              <span className="font-extrabold">f</span>
              <span className="truncate">Facebook</span>
            </a>

            <a
              href={currentFarm.contact?.instagram ? `https://instagram.com/${currentFarm.contact.instagram}` : 'https://instagram.com'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-surface-2 border border-line hover:border-line-strong text-fg-2 hover:text-fg rounded-xl transition-colors"
            >
              <span>📷</span>
              <span className="truncate">Instagram</span>
            </a>

            <a
              href={currentFarm.contact?.lineId ? `https://line.me/R/ti/p/${encodeURIComponent(currentFarm.contact.lineId)}` : 'https://line.me'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-surface-2 border border-line hover:border-line-strong text-fg-2 hover:text-fg rounded-xl transition-colors"
            >
              <span>💬</span>
              <span className="truncate">LINE OA</span>
            </a>
          </div>

          {/* Success Toast for Update Request */}
          {updateSuccessToast && (
            <div className="p-3 bg-purple-950/80 border border-purple-500/60 rounded-2xl text-xs font-bold text-purple-200 flex items-center gap-2 animate-in slide-in-from-top shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{updateSuccessToast}</span>
            </div>
          )}

          {/* Manager Action Banner: Request Farm Edit/Update to Admin */}
          {isOwnerOrAdmin && (
            <div className="p-3.5 bg-gradient-to-r from-purple-950/40 via-surface to-indigo-950/40 border border-purple-700/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-900/60 border border-purple-600/50 flex items-center justify-center text-purple-300 shrink-0">
                  <FileEdit className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>แผงควบคุมผู้จัดการสวน (Manager Hub)</span>
                    <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded-md">
                      Manager
                    </span>
                  </div>
                  <p className="text-[11px] text-fg-2">
                    ต้องการแก้ไขข้อมูลที่กรอกผิด หรือเพิ่มเติมใบรับรอง / บรรยากาศสวน?
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsUpdateRequestModalOpen(true)}
                className="w-full sm:w-auto px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่งคำขอแก้ไขข้อมูลสวน (หา Admin)</span>
              </button>
            </div>
          )}


          {/* SmartFarm Innovation Section (Optional & Toggleable by Farm Manager) */}
          {showSmartFarmCard ? (
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#122b1c] border border-line p-4 sm:p-5 shadow-lg">
              <div className="absolute top-0 right-0 w-64 h-32 bg-emerald-600/10 blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-2 relative z-10">
                <div>
                  <h3 className="font-serif font-black text-gold-soft text-base sm:text-lg tracking-wide leading-tight flex items-center gap-1.5">
                    <span>SmartFarm</span>
                    <span className="text-xs font-normal text-fg-2">({activeSmartTech.length} ระบบ)</span>
                  </h3>
                  <p className="text-xs text-fg-2 font-medium mt-0.5">เทคโนโลยีแม่นยำภายในฟาร์ม</p>
                </div>

                <div className="flex items-center gap-2">
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => {
                        setTempHasSmartFarm(currentFarm.hasSmartFarm ?? true);
                        setTempSmartTechList(
                          currentFarm.smartTechnologies && currentFarm.smartTechnologies.length > 0
                            ? currentFarm.smartTechnologies
                            : DEFAULT_SMART_TECH_OPTIONS.map((t) => ({ ...t, active: true }))
                        );
                        setIsSmartTechModalOpen(true);
                      }}
                      className="p-1.5 bg-surface-2 hover:bg-[#1f4e34] text-gold-soft rounded-xl border border-[#225739] transition-colors cursor-pointer text-xs flex items-center gap-1"
                      title="ตั้งค่า SmartFarm"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">ตั้งค่า</span>
                    </button>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#153e28] text-leaf border border-[#225739] shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-leaf animate-pulse" />
                    ใช้งานจริง
                  </span>
                </div>
              </div>

              {/* Technologies List */}
              <div className="divide-y divide-line relative z-10">
                {activeSmartTech.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-3 first:pt-2 last:pb-1"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="text-xl sm:text-2xl w-8 text-center shrink-0">
                        {item.iconEmoji}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] sm:text-xs text-fg-2 font-medium mt-0.5 truncate">
                          {item.subtext}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      <span className="block w-2.5 h-2.5 rounded-full bg-leaf shadow-[0_0_8px_rgba(74,222,128,0.8)] ring-2 ring-emerald-500/30" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Traditional Farming Banner (When SmartFarm is disabled or not present) */
            <div className="p-4 rounded-2xl bg-[#122b1c] border border-line flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">🌱</span>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-white">
                    วิถีเกษตรประณีตและธรรมชาติ (Traditional Sustainable Practice)
                  </div>
                  <p className="text-[11px] text-fg-2 truncate">
                    ดูแลด้วยภูมิปัญญาชาวสวนทุเรียนดั้งเดิมและปุ๋ยอินทรีย์บำรุงดินธรรมชาติ
                  </p>
                </div>
              </div>

              {isOwnerOrAdmin && (
                <button
                  onClick={() => {
                    setTempHasSmartFarm(false);
                    setTempSmartTechList(DEFAULT_SMART_TECH_OPTIONS.map((t) => ({ ...t, active: true })));
                    setIsSmartTechModalOpen(true);
                  }}
                  className="shrink-0 ml-2 px-3 py-1.5 bg-surface-2 hover:bg-[#1f4e34] text-gold text-xs font-bold rounded-xl border border-[#225739] transition-colors cursor-pointer"
                >
                  ⚙️ เพิ่มระบบ SmartFarm
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full pt-1">
        <button
          onClick={() => setActiveTab('trees')}
          className={`py-2.5 px-1 sm:px-3 rounded-2xl transition-all font-bold text-center flex items-center justify-center gap-1 cursor-pointer text-xs sm:text-sm ${
            activeTab === 'trees'
              ? 'bg-gold text-gold-ink shadow-md font-extrabold'
              : 'bg-surface text-fg-2 hover:text-white hover:bg-surface-2 border border-line'
          }`}
        >
          <span>🌳</span>
          <span className="truncate">รายชื่อต้นไม้ ({allTrees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('certs')}
          className={`py-2.5 px-1 sm:px-3 rounded-2xl transition-all font-bold text-center flex items-center justify-center gap-1 cursor-pointer text-xs sm:text-sm ${
            activeTab === 'certs'
              ? 'bg-gold text-gold-ink shadow-md font-extrabold'
              : 'bg-surface text-fg-2 hover:text-white hover:bg-surface-2 border border-line'
          }`}
        >
          <span>📜</span>
          <span className="truncate">ใบรับรอง ({currentFarm.certificationDetails?.length || currentFarm.certifications?.length || 1})</span>
        </button>

        <button
          onClick={() => setActiveTab('about')}
          className={`py-2.5 px-1 sm:px-3 rounded-2xl transition-all font-bold text-center flex items-center justify-center gap-1 cursor-pointer text-xs sm:text-sm ${
            activeTab === 'about'
              ? 'bg-gold text-gold-ink shadow-md font-extrabold'
              : 'bg-surface text-fg-2 hover:text-white hover:bg-surface-2 border border-line'
          }`}
        >
          <span>📖</span>
          <span className="truncate">ประวัติฟาร์ม</span>
        </button>
      </div>

      {/* Tab: Individual Trees List */}
      {activeTab === 'trees' && (
        <FarmTreesTab
          trees={allTrees}
          onSelectTree={setSelectedTree}
          filter={treeFilter}
          onFilterChange={setTreeFilter}
          search={treeSearch}
          onSearchChange={setTreeSearch}
          sort={treeSort}
          onSortChange={setTreeSort}
        />
      )}

      {/* Tab: Certifications with Inspection Button */}
      {activeTab === 'certs' && (
        <FarmCertificationsTab farm={currentFarm} onViewDocument={setSelectedCertDoc} />
      )}

      {/* Tab: About Farm Story */}
      {activeTab === 'about' && <FarmAboutTab farm={currentFarm} />}

      {/* MODAL 1: Certificate Lightbox Modal (Supports PDF & PNG/JPG Images) */}
      {selectedCertDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedCertDoc(null)}
        >
          <div
            className="bg-canvas text-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-line relative flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-line bg-gradient-to-r from-surface to-canvas flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-gold" />
                <div>
                  <h3 className="font-bold text-sm text-white">{selectedCertDoc.name}</h3>
                  <p className="text-[11px] text-fg-2 font-mono">
                    เลขที่: {selectedCertDoc.certNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCertDoc(null)}
                className="p-1.5 text-fg-2 hover:text-white hover:bg-surface-2 rounded-full border border-line cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {selectedCertDoc.fileType === 'pdf' ||
              selectedCertDoc.photoUrl.includes('application/pdf') ||
              selectedCertDoc.photoUrl.toLowerCase().endsWith('.pdf') ? (
                <div className="space-y-3">
                  {/* PDF Document Preview Card */}
                  <div className="p-6 sm:p-8 bg-gradient-to-b from-surface to-well rounded-2xl border border-rose-500/30 text-center space-y-4 shadow-inner">
                    <div className="w-16 h-16 rounded-2xl bg-rose-950/70 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto shadow-md">
                      <FileText className="w-8 h-8" />
                    </div>

                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                        <span>เอกสารรับรองมาตรฐานทางการเกษตร (PDF)</span>
                      </div>
                      <h4 className="text-base font-bold text-white pt-1">
                        {selectedCertDoc.fileName || `${selectedCertDoc.shortCode}_Certificate.pdf`}
                      </h4>
                      <p className="text-xs text-fg-2">
                        เอกสารตรวจสอบความถูกต้องฉบับจริง ออกโดย {selectedCertDoc.issuedBy}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => openPdfDocument(selectedCertDoc.photoUrl, selectedCertDoc.fileName)}
                        className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-rose-900/40 transition-all cursor-pointer transform active:scale-95"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>เปิดอ่านไฟล์ PDF เต็มจอ</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-line bg-black">
                  <img
                    src={selectedCertDoc.photoUrl}
                    alt="Official Certificate Document"
                    className="w-full max-h-[60vh] object-contain mx-auto"
                  />
                </div>
              )}

              <div className="p-3 bg-surface rounded-2xl border border-line text-xs space-y-1 text-fg-2">
                <div className="flex justify-between">
                  <span>หน่วยงานผู้ออก:</span>
                  <span className="font-semibold text-white">{selectedCertDoc.issuedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span>สถานะการรับรอง:</span>
                  <span className="text-leaf font-bold">✓ ผ่านการรับรองถูกต้อง</span>
                </div>
                <div className="flex justify-between">
                  <span>หมดอายุ:</span>
                  <span className="font-mono text-gold-soft">{selectedCertDoc.validUntil}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* หน้าต่างดูรูปบรรยากาศสวน -- เรียงรูปต่อกันในแนวตั้งแล้วเลื่อนดู
          แบบเดียวกับต้นแบบ ไม่ใช่แบบกดลูกศรทีละรูป
          เลื่อนนิ้วบนมือถือทำได้เป็นธรรมชาติกว่าการเล็งปุ่มลูกศรเล็ก ๆ */}
      {galleryOpen && (
        <FarmPhotoGalleryOverlay
          photos={displayPhotos}
          farmName={currentFarm.name}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {/* MODAL 2: Photo Manager for Farm Atmosphere Photos (PNG / JPG file upload support) */}
      {isPhotoManagerOpen && (
        <FarmPhotoManagerModal
          photos={displayPhotos}
          samplePhotos={SAMPLE_GARDEN_PHOTOS}
          onClose={() => setIsPhotoManagerOpen(false)}
          onSave={handleSavePhotos}
        />
      )}

      {/* MODAL 3: Smart Farm Configuration Modal */}
      {isSmartTechModalOpen && (
        <FarmSmartTechConfigModal
          hasSmartFarm={tempHasSmartFarm}
          onHasSmartFarmChange={setTempHasSmartFarm}
          techList={tempSmartTechList}
          onTechListChange={setTempSmartTechList}
          onClose={() => setIsSmartTechModalOpen(false)}
          onSave={handleSaveSmartTech}
        />
      )}

      {/* Farm Update Request Modal for Manager */}
      {isUpdateRequestModalOpen && (
        <FarmRegistrationModal
          isOpen={isUpdateRequestModalOpen}
          mode="update"
          targetFarmId={currentFarm.id}
          initialData={{
            requestType: 'update_farm',
            targetFarmId: currentFarm.id,
            farmName: currentFarm.name,
            farmNameEn: currentFarm.nameEn,
            province: currentFarm.province,
            district: currentFarm.district,
            locationAddress: currentFarm.contact?.locationAddress,
            areaRai: currentFarm.areaRai,
            totalTreesEstimate: currentFarm.totalTrees,
            topVarieties: currentFarm.topVarieties,
            aboutStory: currentFarm.aboutStory,
            contact: currentFarm.contact,
            gapCertNumber: currentFarm.certificationDetails?.[0]?.certNumber || 'GAP-TH-2026',
            certIssuedBy: currentFarm.certificationDetails?.[0]?.issuedBy || 'กรมวิชาการเกษตร',
            certValidUntil: currentFarm.certificationDetails?.[0]?.validUntil || '2028',
            certDocumentPhoto: currentFarm.certDocumentPhoto,
            certificationList: currentFarm.certificationDetails || [],
            atmospherePhotos: currentFarm.atmospherePhotos || currentFarm.photos || [],
            hasSmartFarm: currentFarm.hasSmartFarm ?? false,
            smartTechnologies: currentFarm.smartTechnologies || [],
          }}
          onClose={() => setIsUpdateRequestModalOpen(false)}
          onRequestSubmitted={() => {
            setIsUpdateRequestModalOpen(false);
            setUpdateSuccessToast('ส่งคำขอแก้ไขข้อมูลสวนไปยังแอดมินเรียบร้อยแล้ว! แอดมินจะตรวจสอบและอนุมัติให้โดยเร็ว');
            setTimeout(() => setUpdateSuccessToast(''), 5000);
          }}
        />
      )}
    </div>
  );
};
