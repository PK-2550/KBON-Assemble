import React, { useState, useMemo } from 'react';
import { X, Award, ExternalLink, FileText } from 'lucide-react';
import { DurianFarm, IndividualTree, FruitTreeVariety, UserRole, SmartTechItem } from '../types';
import { TreeDetailView } from './TreeDetailView';
import { FarmTreesTab, type TreeFilter, type TreeSort } from './FarmTreesTab';
import { FarmCertificationsTab, type CertDocView } from './FarmCertificationsTab';
import { FarmAboutTab } from './FarmAboutTab';
import { FarmPhotoGalleryOverlay } from './FarmPhotoGalleryOverlay';
import { FarmPhotoManagerModal } from './FarmPhotoManagerModal';
import { FarmSmartTechConfigModal } from './FarmSmartTechConfigModal';
import { FarmProfileHeaderCard } from './FarmProfileHeaderCard';
import { FarmCertificationBadgeStrip } from './FarmCertificationBadgeStrip';
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
    <div className="animate-in fade-in duration-200">
      {/* แผ่นเนื้อหาของหน้าฟาร์ม
          margin ติดลบเป็นการดึงตัวเองออกนอก padding ของ <main> รูปปกจะได้กว้าง
          เต็มกรอบและชนขอบบนพอดีตามต้นแบบ ส่วน -mb-24 pb-24 คือคืนที่ว่างด้านล่าง
          ให้เท่าเดิม

          โมดัลทุกตัวอยู่นอกแผ่นนี้ ระยะขอบติดลบจึงไม่ไปดันตำแหน่งของโมดัล */}
      <div className="bg-canvas text-fg -mx-3.5 -mt-3 -mb-24 pb-24 min-h-[60vh]">
        {/* Main Container */}
        <FarmProfileHeaderCard
          farm={currentFarm}
          photos={displayPhotos}
          registeredTreeCount={allTrees.length}
          defaultSmartTech={DEFAULT_SMART_TECH_OPTIONS}
          isOwnerOrAdmin={isOwnerOrAdmin}
          successToast={updateSuccessToast}
          storyExpanded={storyExpanded}
          onToggleStory={() => setStoryExpanded(!storyExpanded)}
          onBack={onBack}
          onOpenGallery={() => setGalleryOpen(true)}
          onShare={handleShare}
          onOpenPhotoManager={() => setIsPhotoManagerOpen(true)}
          onOpenUpdateRequest={() => setIsUpdateRequestModalOpen(true)}
          onOpenSmartTechConfig={(hasSmartFarm, techList) => {
            setTempHasSmartFarm(hasSmartFarm);
            setTempSmartTechList(techList);
            setIsSmartTechModalOpen(true);
          }}
        />

        {/* แถบเมนูและเนื้อหาของแท็บ อยู่ในระยะขอบชุดเดียวกับส่วนหัวด้านบน */}
        <div className="px-4 sm:px-6 lg:px-8 pt-5 space-y-4">
          {/* ตราใบรับรอง คั่นระหว่างเรื่องราวของฟาร์มกับรายชื่อต้นไม้
              แสดงเฉพาะใบที่ผ่านการตรวจของแอดมินแล้ว */}
          <FarmCertificationBadgeStrip certifications={currentFarm.certificationDetails} />

          {/* Navigation Tabs -- เรียงแนวนอนชิดซ้ายใต้ส่วนข้อมูลหลักตามต้นแบบ
              แท็บที่เลือกอยู่ใช้เส้นใต้บาง ๆ แทนปุ่มพื้นทองเต็มช่องแบบเดิม
              ของเดิมเป็นกริดสามช่องเท่ากันซึ่งบีบชื่อแท็บจนต้องตัดคำทิ้ง
              จอแคบให้เลื่อนแถบไปทางข้างแทนการบีบตัวหนังสือ */}
          <div className="flex items-center gap-5 sm:gap-7 border-b border-line overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('trees')}
              className={`-mb-px shrink-0 flex items-center gap-1.5 border-b-2 pb-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                activeTab === 'trees'
                  ? 'border-gold text-fg'
                  : 'border-transparent text-fg-2 hover:text-fg'
              }`}
            >
              <span>🌳</span>
              <span>รายชื่อต้นไม้ ({allTrees.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('certs')}
              className={`-mb-px shrink-0 flex items-center gap-1.5 border-b-2 pb-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                activeTab === 'certs'
                  ? 'border-gold text-fg'
                  : 'border-transparent text-fg-2 hover:text-fg'
              }`}
            >
              <span>📜</span>
              <span>ใบรับรอง ({currentFarm.certificationDetails?.length || currentFarm.certifications?.length || 1})</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`-mb-px shrink-0 flex items-center gap-1.5 border-b-2 pb-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                activeTab === 'about'
                  ? 'border-gold text-fg'
                  : 'border-transparent text-fg-2 hover:text-fg'
              }`}
            >
              <span>📖</span>
              <span>ประวัติฟาร์ม</span>
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
        </div>
      </div>

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
