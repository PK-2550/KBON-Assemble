import React from 'react';
import {
  X,
  Award,
  Share2,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertCircle,
  Loader2,
  Sparkles,
  Facebook,
  Instagram,
  Image as ImageIcon,
  Plus,
  Trash2,
  Cpu,
  ShieldCheck,
  ExternalLink,
  Paperclip,
  Check,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { FarmRegistrationRequest } from '../types';
import { openPdfDocument } from '../utils/pdfUtils';
import {
  THAILAND_REGIONS,
  getDistrictsByProvince,
} from '../constants/provinces';
import { FarmLocationPicker } from './FarmLocationPicker';
import { useFarmRegistrationForm } from '../hooks/useFarmRegistrationForm';
import { FarmRegistrationStep1 } from './FarmRegistrationStep1';
import { FarmRegistrationStep2 } from './FarmRegistrationStep2';
import { AVAILABLE_SMART_TECH, STANDARD_OPTIONS } from '../constants/farmRegistrationOptions';

interface FarmRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted?: (req: FarmRegistrationRequest) => void;
  initialData?: Partial<FarmRegistrationRequest>;
  mode?: 'create' | 'update';
  targetFarmId?: string;
}

// Authentic High-Quality Durian Garden / Orchard Photos
const SAMPLE_GARDEN_PHOTOS = [
  {
    url: 'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80',
    title: 'ต้นทุเรียนและผลดกสมบูรณ์',
  },
  {
    url: 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=800&auto=format&fit=crop&q=80',
    title: 'ทิวทัศน์สวนทุเรียนร่มรื่น',
  },
  {
    url: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800&auto=format&fit=crop&q=80',
    title: 'แปลงปลูกทุเรียนเนินเขา',
  },
  {
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    title: 'ต้นทุเรียนใบเขียวสมบูรณ์',
  },
  {
    url: 'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=800&auto=format&fit=crop&q=80',
    title: 'ความเขียวชอุ่มยามเช้าในสวน',
  },
];

// Available Smart Farm Technologies

export const FarmRegistrationModal: React.FC<FarmRegistrationModalProps> = ({
  isOpen,
  onClose,
  onRequestSubmitted,
  initialData,
  mode = 'create',
  targetFarmId,
}) => {
  const {
    photoInputRef,
    idCardInputRef,
    isUpdateMode,
    step,
    setStep,
    submitting,
    submittedSuccess,
    errorMessage,
    updateNotes,
    setUpdateNotes,
    agreedToCriteria,
    setAgreedToCriteria,
    farmerFullName,
    setFarmerFullName,
    farmerIdCardNumber,
    setFarmerIdCardNumber,
    farmerIdCardPhoto,
    farmerIdCardFileType,
    farmerIdCardFileName,
    farmName,
    setFarmName,
    farmNameEn,
    setFarmNameEn,
    province,
    setProvince,
    district,
    setDistrict,
    locationAddress,
    setLocationAddress,
    coordinates,
    setCoordinates,
    googleMapsUrl,
    setGoogleMapsUrl,
    areaRai,
    setAreaRai,
    totalTreesEstimate,
    setTotalTreesEstimate,
    topVarietiesInput,
    setTopVarietiesInput,
    certificationList,
    atmospherePhotos,
    setAtmospherePhotos,
    hasSmartFarm,
    setHasSmartFarm,
    selectedTechIds,
    setSelectedTechIds,
    phoneNumber,
    setPhoneNumber,
    lineId,
    setLineId,
    facebook,
    setFacebook,
    instagram,
    setInstagram,
    aboutStory,
    setAboutStory,
    handleClearDraft,
    handlePhotoFileUpload,
    handleIdCardUpload,
    toggleTech,
    handleAddCertificate,
    handleUpdateCertField,
    handleSelectStandardOption,
    handleCertDocUpload,
    handleRemoveCertificate,
    validateCurrentStep,
    handleNextStep,
    handleSubmit,
    availableDistricts,
  } = useFarmRegistrationForm({ isOpen, initialData, mode, targetFarmId, onRequestSubmitted });

  // ต้องอยู่หลังการเรียก hook เสมอ เพราะ hook ห้ามอยู่หลังเงื่อนไข
  // และ effect ที่เซฟแบบร่างก็ต้องทำงานต่อแม้โมดัลจะปิดอยู่ เหมือนก่อนแยกไฟล์
  if (!isOpen) return null;


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in overflow-y-auto"
      onClick={() => onClose()}
    >
      <div
        className="bg-canvas text-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-line relative my-auto max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-line bg-gradient-to-r from-surface via-canvas to-surface flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold to-[#c78b23] flex items-center justify-center text-gold-ink shadow-md shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg text-white">
                  {isUpdateMode
                    ? 'ส่งคำขอแก้ไขข้อมูลฟาร์ม'
                    : 'ยื่นเรื่องขอสิทธิ์ผู้จัดการสวน & ตรวจรับรองมาตรฐานฟาร์ม'}
                </h2>
                <span className="text-[10px] font-bold bg-gold/20 text-gold-soft border border-gold/40 px-2 py-0.5 rounded-full">
                  {isUpdateMode ? 'Update Farm' : 'Farm & Manager Application'}
                </span>
              </div>
              <p className="text-xs text-fg-2">
                {isUpdateMode
                  ? 'อัปเดตรายละเอียดแปลงและส่งให้ Admin อนุมัติการแก้ไข'
                  : 'กรอกข้อมูลยืนยันตัวตนเจ้าของสวน ข้อมูลแปลง และแนบใบรับรองมาตรฐาน GAP/GI เพื่อรับสิทธิ์ Manager & เปิดหน้าฟาร์ม'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isUpdateMode && !submittedSuccess && (
              <button
                type="button"
                onClick={() => handleClearDraft()}
                title="ล้างแบบร่างทั้งหมด"
                className="p-2 text-fg-2 hover:text-amber-400 hover:bg-surface-2 rounded-full transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onClose()}
              className="p-2 text-fg-2 hover:text-white hover:bg-surface-2 rounded-full transition-colors border border-line cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-step progress bar */}
        {!submittedSuccess && (
          <div className="px-4 py-2.5 bg-well border-b border-line flex items-center justify-between shrink-0 overflow-x-auto gap-2">
            {[
              { num: 1, label: '1. เกณฑ์คัดเลือก' },
              { num: 2, label: '2. ยืนยันตัวตน' },
              { num: 3, label: '3. ข้อมูลสวน & แผนที่' },
              { num: 4, label: '4. บรรยากาศ & เรื่องราว' },
              { num: 5, label: '5. ใบรับรองมาตรฐาน' },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num < step || validateCurrentStep(step)) {
                    setStep(s.num as any);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  step === s.num
                    ? 'bg-surface-2 text-leaf border border-[#235b3a]'
                    : step > s.num
                    ? 'text-gold hover:bg-[#0c2214]'
                    : 'text-[#5a7d69] hover:text-fg-2'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    step === s.num
                      ? 'bg-leaf text-canvas'
                      : step > s.num
                      ? 'bg-gold text-gold-ink'
                      : 'bg-[#122e1e] text-[#5a7d69]'
                  }`}
                >
                  {step > s.num ? '✓' : s.num}
                </span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {submittedSuccess ? (
            <div className="py-10 text-center space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-leaf to-[#22c55e] text-canvas flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-xl font-extrabold text-white">
                  {isUpdateMode
                    ? 'ส่งคำขอแก้ไขข้อมูลสำเร็จ!'
                    : 'ส่งคำขอลงทะเบียนสวนสำเร็จ!'}
                </h3>
                <p className="text-xs text-fg-2 leading-relaxed">
                  ข้อมูลสวน <span className="text-gold-soft font-bold">"{farmName}"</span> ถูกส่งเข้าสู่ศูนย์ตรวจสอบของ Admin เรียบร้อยแล้ว
                </p>
              </div>

              <div className="p-4 bg-panel border border-line rounded-2xl max-w-md mx-auto text-left space-y-2 text-xs">
                <div className="flex items-center gap-2 text-leaf font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>ขั้นตอนถัดไป: การตรวจสอบและอนุมัติโดย Admin</span>
                </div>
                <ul className="text-fg-2 space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li>Admin จะตรวจสอบความถูกต้องของข้อมูลแปลง พิกัด และเอกสารรับรองมาตรฐาน (GAP/GI)</li>
                  <li>เมื่อ Admin <strong>อนุมัติ</strong> สวนของท่านจะเปิดแสดงในทำเนียบฟาร์มสู่สาธารณะทันที</li>
                  <li>ท่านจะสามารถเข้าจัดการภาพบรรยากาศและบันทึกประวัติต้นทุเรียนรายต้นได้ครบถ้วน</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onClose()}
                className="px-6 py-2.5 bg-leaf hover:bg-[#3ec972] text-canvas font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer"
              >
                เสร็จสิ้น / ปิดหน้าต่าง
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              className="space-y-4"
            >
              {/* Revision Alert Banner if Admin requested revisions */}
              {initialData?.status === 'needs_revision' && initialData.adminNotes && (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-3 animate-in fade-in shadow-md">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-300 flex items-center gap-1.5">
                      <span>คำขอต้องการการแก้ไข (Revision Request จาก Admin)</span>
                    </p>
                    <p className="text-white bg-rose-900/40 p-2 rounded-lg border border-rose-700/40 mt-1">
                      "{initialData.adminNotes}"
                    </p>
                    <p className="text-[11px] text-rose-300/80 pt-0.5">
                      โปรดปรับปรุงข้อมูลตามที่ระบุด้านบน แล้วกดส่งข้อมูลใหม่อีกครั้งเพื่อรอผลพิจารณาจาก Admin
                    </p>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* STEP 1: Strict Eligibility Criteria & Standards Agreement */}
              {step === 1 && (
                <FarmRegistrationStep1
                  agreedToCriteria={agreedToCriteria}
                  onAgreedChange={setAgreedToCriteria}
                />
              )}

              {/* STEP 2: Farmer Identity & National ID Card Verification */}
              {step === 2 && (
                <FarmRegistrationStep2
                  farmerFullName={farmerFullName}
                  onFarmerFullNameChange={setFarmerFullName}
                  farmerIdCardNumber={farmerIdCardNumber}
                  onFarmerIdCardNumberChange={setFarmerIdCardNumber}
                  farmerIdCardPhoto={farmerIdCardPhoto}
                  farmerIdCardFileType={farmerIdCardFileType}
                  farmerIdCardFileName={farmerIdCardFileName}
                  idCardInputRef={idCardInputRef}
                  onIdCardUpload={handleIdCardUpload}
                  phoneNumber={phoneNumber}
                  onPhoneNumberChange={setPhoneNumber}
                  lineId={lineId}
                  onLineIdChange={setLineId}
                  onOpenPdf={openPdfDocument}
                />
              )}

              {/* STEP 3: Farm Details & Interactive GPS Location Map */}
              {step === 3 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-fg-2 mb-1">
                        ชื่อฟาร์ม (ภาษาไทย) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น สวนทุเรียนจันทบูรณ์ พรีเมียม"
                        value={farmName}
                        onChange={(e) => setFarmName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-fg-2 mb-1">
                        ชื่อฟาร์ม (English - ถ้ามี)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Chanthaburi Durian Orchard"
                        value={farmNameEn}
                        onChange={(e) => setFarmNameEn(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs"
                      />
                    </div>
                  </div>

                  {/* Province & District Dropdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-fg-2 mb-1">
                        จังหวัด <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={province}
                        onChange={(e) => {
                          const newProv = e.target.value;
                          setProvince(newProv);
                          const districts = getDistrictsByProvince(newProv);
                          if (districts.length > 0) {
                            setDistrict(districts[0]);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs"
                      >
                        {THAILAND_REGIONS.map((region) => (
                          <optgroup key={region.region} label={region.region}>
                            {region.provinces.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-fg-2 mb-1">
                        อำเภอ/เขต <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs"
                      >
                        {availableDistricts.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-fg-2 mb-1">
                      ที่อยู่แปลงปลูกโดยละเอียด
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 12/4 หมู่ 3 ต.เขาวัว อ.ท่าใหม่"
                      value={locationAddress}
                      onChange={(e) => setLocationAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs"
                    />
                  </div>

                  {/* Interactive GPS Location Picker Component */}
                  <div className="pt-1">
                    <FarmLocationPicker
                      province={province}
                      district={district}
                      coordinates={coordinates}
                      googleMapsUrl={googleMapsUrl}
                      onChange={(coords, mapUrl) => {
                        setCoordinates(coords);
                        if (mapUrl !== undefined) {
                          setGoogleMapsUrl(mapUrl);
                        }
                      }}
                      farmName={farmName || 'สวนทุเรียน'}
                    />
                  </div>

                  {/* Farm Size & Estimates */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-fg-2 mb-1">
                        พื้นที่แปลง (ไร่)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={areaRai}
                        onChange={(e) => setAreaRai(Number(e.target.value) || 1)}
                        className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-fg-2 mb-1">
                        จำนวนต้นโดยประมาณ
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={totalTreesEstimate}
                        onChange={(e) => setTotalTreesEstimate(Number(e.target.value) || 10)}
                        className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-fg-2 mb-1">
                        พันธุ์ทุเรียนหลัก
                      </label>
                      <input
                        type="text"
                        placeholder="หมอนทอง, ก้านยาว, ชะนี"
                        value={topVarietiesInput}
                        onChange={(e) => setTopVarietiesInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Farm Atmosphere Photos, Smart Farm Technologies, Story & Social Links */}
              {step === 4 && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Section 1: Atmosphere Photos */}
                  <div className="p-3.5 bg-well rounded-2xl border border-line space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-leaf" />
                        <span>ภาพถ่ายบรรยากาศสวนทุเรียน ({atmospherePhotos.length} รูป)</span>
                      </label>
                      <span className="text-[10px] text-fg-2">JPG / PNG (บีบอัดอัตโนมัติ)</span>
                    </div>
                    <p className="text-[11px] text-fg-2">
                      อัปโหลดภาพแปลงทุเรียน ต้นทุเรียน ผลผลิต หรือสภาพแวดล้อมเพื่อสร้างความเชื่อมั่นแก่ผู้บริโภค
                    </p>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={photoInputRef}
                      multiple
                      accept="image/*"
                      onChange={handlePhotoFileUpload}
                      className="hidden"
                    />

                    {/* Upload button and Drop Area */}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-[#235b3a] hover:border-leaf bg-canvas rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs text-fg-2 hover:text-white transition-all cursor-pointer"
                    >
                      <Upload className="w-5 h-5 text-leaf" />
                      <span className="font-bold text-white">คลิกเพื่ออัปโหลดภาพถ่ายบรรยากาศสวนของคุณ</span>
                      <span className="text-[10px] text-[#527861]">สามารถเลือกได้หลายรูป ระบบจะปรับขนาดภาพให้อัตโนมัติ</span>
                    </button>

                    {/* Uploaded Photos Grid */}
                    {atmospherePhotos.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="text-[11px] font-bold text-fg-2 flex items-center justify-between">
                          <span>รูปภาพที่เลือกไว้ ({atmospherePhotos.length} รูป):</span>
                          <button
                            type="button"
                            onClick={() => setAtmospherePhotos([])}
                            className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            ลบทั้งหมด
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {atmospherePhotos.map((photoUrl, idx) => (
                            <div
                              key={idx}
                              className="relative group rounded-xl overflow-hidden border border-[#235b3a] aspect-video bg-black/40"
                            >
                              <img
                                src={photoUrl}
                                alt={`Farm atmosphere ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setAtmospherePhotos((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-lg opacity-90 group-hover:opacity-100 transition-all cursor-pointer"
                                title="ลบรูปนี้"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Pick from High-Quality Samples */}
                    <div className="pt-2 border-t border-line/60">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-gold-soft flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>หรือเลือกจากรูปภาพสวนตัวอย่างมาตรฐาน:</span>
                        </span>
                        <span className="text-[10px] text-[#527861]">คลิกเพื่อเพิ่ม</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {SAMPLE_GARDEN_PHOTOS.map((sample, sIdx) => {
                          const isAlreadyAdded = atmospherePhotos.includes(sample.url);
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => {
                                if (isAlreadyAdded) {
                                  setAtmospherePhotos((prev) =>
                                    prev.filter((p) => p !== sample.url)
                                  );
                                } else {
                                  setAtmospherePhotos((prev) => [...prev, sample.url]);
                                }
                              }}
                              className={`relative rounded-lg overflow-hidden border aspect-video cursor-pointer transition-all ${
                                isAlreadyAdded
                                  ? 'border-leaf ring-2 ring-leaf/50'
                                  : 'border-line opacity-75 hover:opacity-100'
                              }`}
                              title={sample.title}
                            >
                              <img
                                src={sample.url}
                                alt={sample.title}
                                className="w-full h-full object-cover"
                              />
                              {isAlreadyAdded && (
                                <div className="absolute inset-0 bg-leaf/30 flex items-center justify-center">
                                  <Check className="w-4 h-4 text-white drop-shadow-xs" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Smart Farm & Precision Agriculture */}
                  <div className="p-3.5 bg-well rounded-2xl border border-line space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-surface-2 text-leaf flex items-center justify-center">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">
                            เทคโนโลยีแปลงปลูกอัจฉริยะ (Smart Farm / IoT)
                          </h4>
                          <p className="text-[10px] text-fg-2">
                            แสดงตราสัญลักษณ์นวัตกรรมและเทคโนโลยีที่ใช้ในสวน
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasSmartFarm}
                          onChange={(e) => {
                            setHasSmartFarm(e.target.checked);
                            if (e.target.checked && selectedTechIds.length === 0) {
                              setSelectedTechIds(['st-d1', 'st-d2']);
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-line peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-leaf"></div>
                      </label>
                    </div>

                    {hasSmartFarm && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in">
                        {AVAILABLE_SMART_TECH.map((tech) => {
                          const isSelected = selectedTechIds.includes(tech.id);
                          return (
                            <button
                              key={tech.id}
                              type="button"
                              onClick={() => toggleTech(tech.id)}
                              className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#0f2e1e] border-leaf text-white shadow-xs'
                                  : 'bg-panel border-line text-fg-2 hover:border-[#2a613f]'
                              }`}
                            >
                              <span className="text-base shrink-0">{tech.iconEmoji}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white flex items-center justify-between">
                                  <span className="truncate">{tech.name}</span>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-leaf shrink-0 ml-1" />
                                  )}
                                </div>
                                <p className="text-[10px] text-fg-2 line-clamp-1">
                                  {tech.subtext}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Farm Heritage & Story */}
                  <div className="p-3.5 bg-well rounded-2xl border border-line space-y-2">
                    <label className="block text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-gold" />
                      <span>เรื่องราวและความเป็นมาของสวน (Farm Story / Heritage)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="เล่าเรื่องราว ความพิถีพิถันในการดูแลต้นทุเรียน การปลูกแบบ Net Zero หรือประวัติความเป็นมาของสวน..."
                      value={aboutStory}
                      onChange={(e) => setAboutStory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-panel border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs resize-none"
                    />
                  </div>

                  {/* Section 4: Additional Social Media Links */}
                  <div className="p-3.5 bg-well rounded-2xl border border-line space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-leaf" />
                      <span>ช่องทางโซเชียลมีเดียเพิ่มเติมของสวน</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-fg-2 mb-1 font-semibold flex items-center gap-1">
                          <Facebook className="w-3 h-3 text-[#1877F2]" />
                          <span>Facebook Page / Profile</span>
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น สวนทุเรียนจันทบูรณ์ หรือ ลิงก์แฟนเพจ"
                          value={facebook}
                          onChange={(e) => setFacebook(e.target.value)}
                          className="w-full px-3 py-2 bg-panel border border-line rounded-xl text-white text-xs focus:outline-hidden focus:border-leaf"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-fg-2 mb-1 font-semibold flex items-center gap-1">
                          <Instagram className="w-3 h-3 text-[#E4405F]" />
                          <span>Instagram (ถ้ามี)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น @durian_chanthaburi"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                          className="w-full px-3 py-2 bg-panel border border-line rounded-xl text-white text-xs focus:outline-hidden focus:border-leaf"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Certifications & Standards (PDF & Photo Support) */}
              {step === 5 && (
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
                      onClick={() => handleAddCertificate()}
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
                                onChange={(e) => handleSelectStandardOption(index, e.target.value)}
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
                                onClick={() => handleRemoveCertificate(index)}
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
                                  handleUpdateCertField(index, 'certNumber', e.target.value)
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
                                  handleUpdateCertField(index, 'issuedBy', e.target.value)
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
                                  handleUpdateCertField(index, 'validUntil', e.target.value)
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
                                      onClick={() => openPdfDocument(cert.documentPhoto, cert.fileName)}
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
                                      onChange={(e) => handleCertDocUpload(index, e)}
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
                                  onChange={(e) => handleCertDocUpload(index, e)}
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
                        onChange={(e) => setUpdateNotes(e.target.value)}
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
              )}

              {/* Navigation Buttons Footer */}
              <div className="pt-3 border-t border-line flex items-center justify-between gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((prev) => Math.max(1, prev - 1) as any)}
                    className="px-4 py-2.5 bg-surface hover:bg-surface-2 text-fg-2 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>ย้อนกลับ</span>
                  </button>
                ) : (
                  <div />
                )}

                {step < 5 ? (
                  <button
                    type="button"
                    onClick={() => handleNextStep()}
                    className="px-5 py-2.5 bg-leaf hover:bg-[#3ec972] text-canvas rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ml-auto"
                  >
                    <span>ถัดไป</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-gold to-[#c78b23] hover:from-[#f3b544] hover:to-[#d89828] text-gold-ink rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50 ml-auto"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังส่งคำขอ...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          {initialData?.status === 'needs_revision'
                            ? 'ส่งข้อมูลแก้ไขให้ Admin ตรวจสอบ'
                            : isUpdateMode
                            ? 'ส่งคำขอแก้ไขข้อมูลฟาร์ม'
                            : 'ส่งคำขอสิทธิ์ Manager & รับรองฟาร์มให้ Admin ตรวจสอบ'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
