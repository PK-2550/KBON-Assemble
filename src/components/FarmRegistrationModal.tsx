import React from 'react';
import {
  X,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { FarmRegistrationRequest } from '../types';
import { openPdfDocument } from '../utils/pdfUtils';
import { useFarmRegistrationForm } from '../hooks/useFarmRegistrationForm';
import { FarmRegistrationStep1 } from './FarmRegistrationStep1';
import { FarmRegistrationStep2 } from './FarmRegistrationStep2';
import { FarmRegistrationStep3 } from './FarmRegistrationStep3';
import { FarmRegistrationStep4 } from './FarmRegistrationStep4';
import { FarmRegistrationStep5 } from './FarmRegistrationStep5';

interface FarmRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted?: (req: FarmRegistrationRequest) => void;
  initialData?: Partial<FarmRegistrationRequest>;
  mode?: 'create' | 'update';
  targetFarmId?: string;
}


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
    hasIdCardPhotoOnFile,
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
                  hasIdCardPhotoOnFile={hasIdCardPhotoOnFile}
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
                <FarmRegistrationStep3
                  farmName={farmName}
                  onFarmNameChange={setFarmName}
                  farmNameEn={farmNameEn}
                  onFarmNameEnChange={setFarmNameEn}
                  province={province}
                  onProvinceChange={setProvince}
                  district={district}
                  onDistrictChange={setDistrict}
                  locationAddress={locationAddress}
                  onLocationAddressChange={setLocationAddress}
                  coordinates={coordinates}
                  onCoordinatesChange={setCoordinates}
                  googleMapsUrl={googleMapsUrl}
                  onGoogleMapsUrlChange={setGoogleMapsUrl}
                  areaRai={areaRai}
                  onAreaRaiChange={setAreaRai}
                  totalTreesEstimate={totalTreesEstimate}
                  onTotalTreesEstimateChange={setTotalTreesEstimate}
                  topVarietiesInput={topVarietiesInput}
                  onTopVarietiesInputChange={setTopVarietiesInput}
                />
              )}

              {/* STEP 4: Farm Atmosphere Photos, Smart Farm Technologies, Story & Social Links */}
              {step === 4 && (
                <FarmRegistrationStep4
                  atmospherePhotos={atmospherePhotos}
                  onAtmospherePhotosChange={setAtmospherePhotos}
                  photoInputRef={photoInputRef}
                  onPhotoFileUpload={handlePhotoFileUpload}
                  hasSmartFarm={hasSmartFarm}
                  onHasSmartFarmChange={setHasSmartFarm}
                  selectedTechIds={selectedTechIds}
                  onSelectedTechIdsChange={setSelectedTechIds}
                  onToggleTech={toggleTech}
                  aboutStory={aboutStory}
                  onAboutStoryChange={setAboutStory}
                  facebook={facebook}
                  onFacebookChange={setFacebook}
                  instagram={instagram}
                  onInstagramChange={setInstagram}
                />
              )}

              {/* STEP 5: Certifications & Standards (PDF & Photo Support) */}
              {step === 5 && (
                <FarmRegistrationStep5
                  certificationList={certificationList}
                  onAddCertificate={handleAddCertificate}
                  onUpdateCertField={handleUpdateCertField}
                  onSelectStandardOption={handleSelectStandardOption}
                  onCertDocUpload={handleCertDocUpload}
                  onRemoveCertificate={handleRemoveCertificate}
                  isUpdateMode={isUpdateMode}
                  updateNotes={updateNotes}
                  onUpdateNotesChange={setUpdateNotes}
                  onOpenPdf={openPdfDocument}
                />
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
