import { useState, useEffect, useRef } from 'react';
import {
  FarmRegistrationRequest,
  SocialContact,
  SmartTechItem,
  CertificationDetail,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { submitFarmRegistrationRequest } from '../services/farmRequestService';
import { compressImageFile } from '../utils/imageCompressor';
import { AVAILABLE_SMART_TECH, STANDARD_OPTIONS } from '../constants/farmRegistrationOptions';

interface UseFarmRegistrationFormArgs {
  isOpen: boolean;
  initialData?: Partial<FarmRegistrationRequest>;
  mode: 'create' | 'update';
  targetFarmId?: string;
  onRequestSubmitted?: (req: FarmRegistrationRequest) => void;
}

/**
 * สถานะและตรรกะทั้งหมดของฟอร์มขึ้นทะเบียนสวน
 *
 * แยกออกมาจาก FarmRegistrationModal เพราะเป็นก้อนเดียวที่ไม่พึ่ง JSX เลย
 * ตัวคอมโพเนนต์จึงเหลือแต่การวาดหน้าจอ
 *
 * ต้องเรียก hook นี้ก่อน early return ของ isOpen เสมอ และห้ามใส่เงื่อนไข
 * isOpen เข้าไปใน effect ที่เซฟแบบร่าง เพราะของเดิมมันทำงานทุกครั้งที่ render
 * ไม่ว่าโมดัลจะเปิดอยู่หรือไม่ การเติมเงื่อนไขคือการเปลี่ยนพฤติกรรม
 */
export function useFarmRegistrationForm({
  isOpen,
  initialData,
  mode,
  targetFarmId,
  onRequestSubmitted,
}: UseFarmRegistrationFormArgs) {
  const { currentUser } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const idCardInputRef = useRef<HTMLInputElement>(null);

  const isUpdateMode =
    mode === 'update' || Boolean(targetFarmId) || initialData?.requestType === 'update_farm';

  // Draft storage key
  const draftStorageKey = `durian_farm_registration_draft_${currentUser?.uid || 'guest'}`;

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Update Notes (for Manager to communicate specific changes to Admin)
  const [updateNotes, setUpdateNotes] = useState(
    initialData?.updateNotes || (isUpdateMode ? 'ขอแก้ไขข้อมูลฟาร์มและปรับปรุงรายละเอียดเพิ่มเติม' : '')
  );

  // Helper to get initial state from draft if available
  const getInitialDraft = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return null;
  };

  const initialDraft = !initialData ? getInitialDraft() : null;

  // Step 1: Eligibility & Agreement
  const [agreedToCriteria, setAgreedToCriteria] = useState<boolean>(
    initialData?.agreedToCriteria ?? initialDraft?.agreedToCriteria ?? (isUpdateMode ? true : false)
  );

  // Step 2: Farmer Identity & ID Card
  const [farmerFullName, setFarmerFullName] = useState<string>(
    initialData?.farmerFullName ||
      initialDraft?.farmerFullName ||
      currentUser?.displayName ||
      ''
  );
  const [farmerIdCardNumber, setFarmerIdCardNumber] = useState<string>(
    initialData?.farmerIdCardNumber || initialDraft?.farmerIdCardNumber || ''
  );
  const [farmerIdCardPhoto, setFarmerIdCardPhoto] = useState<string>(
    initialData?.farmerIdCardPhoto || initialDraft?.farmerIdCardPhoto || ''
  );
  const [farmerIdCardFileType, setFarmerIdCardFileType] = useState<'image' | 'pdf'>(
    initialData?.farmerIdCardFileType || initialDraft?.farmerIdCardFileType || 'image'
  );
  const [farmerIdCardFileName, setFarmerIdCardFileName] = useState<string>(
    initialDraft?.farmerIdCardFileName || ''
  );

  // Step 3: Farm Details & Map Coordinates
  const [farmName, setFarmName] = useState(
    initialData?.farmName || initialDraft?.farmName || ''
  );
  const [farmNameEn, setFarmNameEn] = useState(
    initialData?.farmNameEn || initialDraft?.farmNameEn || ''
  );
  const [province, setProvince] = useState(
    initialData?.province || initialDraft?.province || 'จันทบุรี'
  );
  const [district, setDistrict] = useState(
    initialData?.district || initialDraft?.district || 'เมืองจันทบุรี'
  );
  const [locationAddress, setLocationAddress] = useState(
    initialData?.locationAddress || initialDraft?.locationAddress || ''
  );
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>(
    initialData?.coordinates || initialDraft?.coordinates || { lat: 12.6114, lng: 102.1039 }
  );
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string>(
    initialData?.googleMapsUrl || initialDraft?.googleMapsUrl || ''
  );
  const [areaRai, setAreaRai] = useState<number>(
    initialData?.areaRai ?? initialDraft?.areaRai ?? 25
  );
  const [totalTreesEstimate, setTotalTreesEstimate] = useState<number>(
    initialData?.totalTreesEstimate ?? initialDraft?.totalTreesEstimate ?? 450
  );
  const [topVarietiesInput, setTopVarietiesInput] = useState(
    initialData?.topVarieties?.join(', ') ||
      initialDraft?.topVarietiesInput ||
      'หมอนทอง, ก้านยาว, ชะนี'
  );

  // Step 4: Multiple Certifications State (PDF & PNG/JPG Support)
  const [certificationList, setCertificationList] = useState<CertificationDetail[]>(() => {
    if (initialData?.certificationList && initialData.certificationList.length > 0) {
      return initialData.certificationList;
    }
    if (initialData?.gapCertNumber) {
      return [
        {
          id: 'cert-1',
          name: 'GAP (Good Agricultural Practice)',
          nameTh: 'มาตรฐาน GAP การปฏิบัติทางการเกษตรที่ดี',
          shortCode: 'GAP',
          certNumber: initialData.gapCertNumber,
          issuedBy: initialData.certIssuedBy || 'กรมวิชาการเกษตร',
          validUntil: initialData.certValidUntil || '2028',
          verified: true,
          documentPhoto: initialData.certDocumentPhoto || '',
          fileType:
            initialData.certDocumentPhoto?.includes('application/pdf') ||
            initialData.certDocumentPhoto?.toLowerCase().endsWith('.pdf')
              ? 'pdf'
              : 'image',
          fileName: '',
        },
      ];
    }
    if (initialDraft?.certificationList && initialDraft.certificationList.length > 0) {
      return initialDraft.certificationList;
    }
    return [
      {
        id: 'cert-1',
        name: 'GAP (Good Agricultural Practice)',
        nameTh: 'มาตรฐาน GAP การปฏิบัติทางการเกษตรที่ดี',
        shortCode: 'GAP',
        certNumber: '',
        issuedBy: 'กรมวิชาการเกษตร',
        validUntil: `${new Date().getFullYear() + 3}`,
        verified: false,
        documentPhoto: '',
        fileType: 'image',
        fileName: '',
      },
    ];
  });

  // Step 5: Garden Atmosphere Photos, Smart Farm, Story & Contact
  const [atmospherePhotos, setAtmospherePhotos] = useState<string[]>(
    initialData?.atmospherePhotos && initialData.atmospherePhotos.length > 0
      ? initialData.atmospherePhotos
      : initialDraft?.atmospherePhotos || []
  );

  const [hasSmartFarm, setHasSmartFarm] = useState<boolean>(
    initialData?.hasSmartFarm ?? initialDraft?.hasSmartFarm ?? false
  );
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>(
    initialData?.smartTechnologies?.map((t) => t.id) ||
      initialDraft?.selectedTechIds ||
      []
  );

  const [phoneNumber, setPhoneNumber] = useState(
    initialData?.contact?.phoneNumber || initialDraft?.phoneNumber || ''
  );
  const [lineId, setLineId] = useState(
    initialData?.contact?.lineId || initialDraft?.lineId || ''
  );
  const [facebook, setFacebook] = useState(
    initialData?.contact?.facebook || initialDraft?.facebook || ''
  );
  const [instagram, setInstagram] = useState(
    initialData?.contact?.instagram || initialDraft?.instagram || ''
  );
  const [aboutStory, setAboutStory] = useState(
    initialData?.aboutStory || initialDraft?.aboutStory || ''
  );

  // Function to clear saved draft and reset to blank
  const handleClearDraft = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftStorageKey);
    }
    setAgreedToCriteria(false);
    setFarmerFullName(currentUser?.displayName || '');
    setFarmerIdCardNumber('');
    setFarmerIdCardPhoto('');
    setFarmerIdCardFileType('image');
    setFarmerIdCardFileName('');
    setFarmName('');
    setFarmNameEn('');
    setProvince('จันทบุรี');
    setDistrict('เมืองจันทบุรี');
    setLocationAddress('');
    setCoordinates({ lat: 12.6114, lng: 102.1039 });
    setAreaRai(25);
    setTotalTreesEstimate(450);
    setTopVarietiesInput('หมอนทอง, ก้านยาว, ชะนี');
    setAtmospherePhotos([]);
    setHasSmartFarm(false);
    setSelectedTechIds([]);
    setCertificationList([
      {
        id: 'cert-1',
        name: 'GAP (Good Agricultural Practice)',
        nameTh: 'มาตรฐาน GAP การปฏิบัติทางการเกษตรที่ดี',
        shortCode: 'GAP',
        certNumber: '',
        issuedBy: 'กรมวิชาการเกษตร',
        validUntil: `${new Date().getFullYear() + 3}`,
        verified: false,
        documentPhoto: '',
        fileType: 'image',
        fileName: '',
      },
    ]);
    setPhoneNumber('');
    setLineId('');
    setFacebook('');
    setInstagram('');
    setAboutStory('');
    setUpdateNotes('');
    setStep(1);
  };

  // Sync state if initialData updates or modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setAgreedToCriteria(initialData.agreedToCriteria ?? true);
        setFarmerFullName(initialData.farmerFullName || currentUser?.displayName || '');
        setFarmerIdCardNumber(initialData.farmerIdCardNumber || '');
        setFarmerIdCardPhoto(initialData.farmerIdCardPhoto || '');
        setFarmerIdCardFileType(initialData.farmerIdCardFileType || 'image');
        setFarmName(initialData.farmName || '');
        setFarmNameEn(initialData.farmNameEn || '');
        setProvince(initialData.province || 'จันทบุรี');
        setDistrict(initialData.district || 'เมืองจันทบุรี');
        setLocationAddress(initialData.locationAddress || '');
        if (initialData.coordinates) {
          setCoordinates(initialData.coordinates);
        }
        if (initialData.googleMapsUrl !== undefined) {
          setGoogleMapsUrl(initialData.googleMapsUrl);
        }
        setAreaRai(initialData.areaRai || 25);
        setTotalTreesEstimate(initialData.totalTreesEstimate || 450);
        setTopVarietiesInput(initialData.topVarieties?.join(', ') || 'หมอนทอง, ก้านยาว, ชะนี');
        setAtmospherePhotos(
          initialData.atmospherePhotos && initialData.atmospherePhotos.length > 0
            ? initialData.atmospherePhotos
            : []
        );
        setHasSmartFarm(initialData.hasSmartFarm ?? false);
        setSelectedTechIds(initialData.smartTechnologies?.map((t) => t.id) || []);
        if (initialData.certificationList && initialData.certificationList.length > 0) {
          setCertificationList(initialData.certificationList);
        } else if (initialData.gapCertNumber) {
          setCertificationList([
            {
              id: 'cert-1',
              name: 'GAP (Good Agricultural Practice)',
              nameTh: 'มาตรฐาน GAP การปฏิบัติทางการเกษตรที่ดี',
              shortCode: 'GAP',
              certNumber: initialData.gapCertNumber,
              issuedBy: initialData.certIssuedBy || 'กรมวิชาการเกษตร',
              validUntil: initialData.certValidUntil || '2028',
              verified: true,
              documentPhoto: initialData.certDocumentPhoto || '',
              fileType:
                initialData.certDocumentPhoto?.includes('application/pdf') ||
                initialData.certDocumentPhoto?.toLowerCase().endsWith('.pdf')
                  ? 'pdf'
                  : 'image',
              fileName: '',
            },
          ]);
        }
        setPhoneNumber(initialData.contact?.phoneNumber || '');
        setLineId(initialData.contact?.lineId || '');
        setFacebook(initialData.contact?.facebook || '');
        setInstagram(initialData.contact?.instagram || '');
        setAboutStory(initialData.aboutStory || '');
        setUpdateNotes(
          initialData.updateNotes || (isUpdateMode ? 'ขอแก้ไขข้อมูลฟาร์มและปรับปรุงรายละเอียดเพิ่มเติม' : '')
        );
      } else {
        // Check if there is saved draft in localStorage
        try {
          const saved = localStorage.getItem(draftStorageKey);
          if (saved) {
            const draft = JSON.parse(saved);
            if (draft.agreedToCriteria !== undefined) setAgreedToCriteria(draft.agreedToCriteria);
            if (draft.farmerFullName) setFarmerFullName(draft.farmerFullName);
            if (draft.farmerIdCardNumber) setFarmerIdCardNumber(draft.farmerIdCardNumber);
            if (draft.farmerIdCardPhoto) setFarmerIdCardPhoto(draft.farmerIdCardPhoto);
            if (draft.farmerIdCardFileType) setFarmerIdCardFileType(draft.farmerIdCardFileType);
            if (draft.farmerIdCardFileName) setFarmerIdCardFileName(draft.farmerIdCardFileName);
            if (draft.farmName) setFarmName(draft.farmName);
            if (draft.farmNameEn !== undefined) setFarmNameEn(draft.farmNameEn);
            if (draft.province) setProvince(draft.province);
            if (draft.district) setDistrict(draft.district);
            if (draft.locationAddress !== undefined) setLocationAddress(draft.locationAddress);
            if (draft.coordinates) setCoordinates(draft.coordinates);
            if (draft.googleMapsUrl !== undefined) setGoogleMapsUrl(draft.googleMapsUrl);
            if (draft.areaRai !== undefined) setAreaRai(draft.areaRai);
            if (draft.totalTreesEstimate !== undefined) setTotalTreesEstimate(draft.totalTreesEstimate);
            if (draft.topVarietiesInput) setTopVarietiesInput(draft.topVarietiesInput);
            if (draft.atmospherePhotos) setAtmospherePhotos(draft.atmospherePhotos);
            if (draft.hasSmartFarm !== undefined) setHasSmartFarm(draft.hasSmartFarm);
            if (draft.selectedTechIds) setSelectedTechIds(draft.selectedTechIds);
            if (draft.certificationList) setCertificationList(draft.certificationList);
            if (draft.phoneNumber !== undefined) setPhoneNumber(draft.phoneNumber);
            if (draft.lineId !== undefined) setLineId(draft.lineId);
            if (draft.facebook !== undefined) setFacebook(draft.facebook);
            if (draft.instagram !== undefined) setInstagram(draft.instagram);
            if (draft.aboutStory !== undefined) setAboutStory(draft.aboutStory);
            if (draft.step) setStep(draft.step);
          }
        } catch {
          // ignore error
        }
      }
    }
  }, [initialData, isOpen, isUpdateMode, draftStorageKey, currentUser?.displayName]);

  // Auto-save draft to localStorage whenever user modifies registration form (only in create mode)
  useEffect(() => {
    if (!isUpdateMode && !submittedSuccess && typeof window !== 'undefined') {
      // Create a draft with lightweight payload to protect quota
      const draftData = {
        agreedToCriteria,
        farmerFullName,
        farmerIdCardNumber,
        farmerIdCardPhoto: farmerIdCardPhoto && farmerIdCardPhoto.length > 500 && farmerIdCardPhoto.startsWith('data:') ? '' : farmerIdCardPhoto,
        farmerIdCardFileType,
        farmerIdCardFileName,
        farmName,
        farmNameEn,
        province,
        district,
        locationAddress,
        coordinates,
        googleMapsUrl,
        areaRai,
        totalTreesEstimate,
        topVarietiesInput,
        atmospherePhotos: atmospherePhotos.filter((p) => typeof p === 'string' && (!p.startsWith('data:') || p.length < 500)),
        hasSmartFarm,
        selectedTechIds,
        certificationList: certificationList.map((c) => ({
          ...c,
          documentPhoto: c.documentPhoto && c.documentPhoto.length > 500 && c.documentPhoto.startsWith('data:') ? '' : c.documentPhoto,
        })),
        phoneNumber,
        lineId,
        facebook,
        instagram,
        aboutStory,
        step,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(draftData));
      } catch {
        // Clear if quota exceeded
        try {
          localStorage.removeItem(draftStorageKey);
        } catch {}
      }
    }
  }, [
    isUpdateMode,
    submittedSuccess,
    draftStorageKey,
    agreedToCriteria,
    farmerFullName,
    farmerIdCardNumber,
    farmerIdCardPhoto,
    farmerIdCardFileType,
    farmerIdCardFileName,
    farmName,
    farmNameEn,
    province,
    district,
    locationAddress,
    coordinates,
    googleMapsUrl,
    areaRai,
    totalTreesEstimate,
    topVarietiesInput,
    atmospherePhotos,
    hasSmartFarm,
    selectedTechIds,
    certificationList,
    phoneNumber,
    lineId,
    facebook,
    instagram,
    aboutStory,
    step,
  ]);

  // Upload local atmosphere photo (PNG/JPG) with auto compression
  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files) as File[]) {
      try {
        const compressed = await compressImageFile(file, 1200, 0.75);
        if (compressed) {
          setAtmospherePhotos((prev) => [...prev, compressed]);
        }
      } catch (err) {
        console.warn('Error compressing photo:', err);
      }
    }
  };

  // Upload Farmer ID Card (PDF / Image) with auto compression
  const handleIdCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    try {
      const compressed = await compressImageFile(file, 1200, 0.75);
      if (compressed) {
        setFarmerIdCardPhoto(compressed);
        setFarmerIdCardFileType(isPdf ? 'pdf' : 'image');
        setFarmerIdCardFileName(file.name);
      }
    } catch (err) {
      console.warn('Error processing ID card:', err);
    }
  };

  // Toggle technology
  const toggleTech = (id: string) => {
    if (selectedTechIds.includes(id)) {
      setSelectedTechIds(selectedTechIds.filter((item) => item !== id));
    } else {
      setSelectedTechIds([...selectedTechIds, id]);
    }
  };

  // Multiple Certifications handlers
  const handleAddCertificate = () => {
    const newId = `cert-${Date.now()}`;
    setCertificationList([
      ...certificationList,
      {
        id: newId,
        name: 'GAP (Good Agricultural Practice)',
        nameTh: 'มาตรฐาน GAP การปฏิบัติทางการเกษตรที่ดี',
        shortCode: 'GAP',
        certNumber: '',
        issuedBy: 'กรมวิชาการเกษตร',
        validUntil: `${new Date().getFullYear() + 3}`,
        verified: false,
        documentPhoto: '',
        fileType: 'image',
        fileName: '',
      },
    ]);
  };

  const handleUpdateCertField = (
    index: number,
    field: keyof CertificationDetail,
    value: any
  ) => {
    setCertificationList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSelectStandardOption = (index: number, code: string) => {
    const standard = STANDARD_OPTIONS.find((s) => s.code === code);
    if (!standard) return;

    setCertificationList((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        shortCode: standard.code,
        name: `${standard.code} Certification`,
        nameTh: standard.nameTh,
        issuedBy: standard.org,
      };
      return next;
    });
  };

  const handleCertDocUpload = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    try {
      const compressed = await compressImageFile(file, 1200, 0.75);
      if (compressed) {
        setCertificationList((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            documentPhoto: compressed,
            fileType: isPdf ? 'pdf' : 'image',
            fileName: file.name,
          };
          return next;
        });
      }
    } catch (err) {
      console.warn('Error processing certificate doc:', err);
    }
  };

  const handleRemoveCertificate = (index: number) => {
    if (certificationList.length <= 1) return;
    setCertificationList(certificationList.filter((_, i) => i !== index));
  };

  // Form Validation per step
  const validateCurrentStep = (targetStep: number = step): boolean => {
    setErrorMessage('');

    if (targetStep === 1) {
      if (!agreedToCriteria && !isUpdateMode) {
        setErrorMessage('กรุณาอ่านและกดยอมรับเกณฑ์มาตรฐาน 3 ข้อก่อนดำเนินการต่อ');
        return false;
      }
      return true;
    }

    if (targetStep === 2) {
      if (!farmerFullName.trim()) {
        setErrorMessage('กรุณาระบุชื่อ-นามสกุลจริงของเจ้าของสวน');
        return false;
      }
      const cleanId = farmerIdCardNumber.replace(/\D/g, '');
      if (cleanId.length > 0 && cleanId.length !== 13) {
        setErrorMessage('เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก');
        return false;
      }
      if (!farmerIdCardPhoto && !isUpdateMode) {
        setErrorMessage('กรุณาแนบรูปถ่ายหรือไฟล์ PDF บัตรประจำตัวประชาชนเพื่อยืนยันสิทธิ์');
        return false;
      }
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length > 0 && cleanPhone.length !== 10) {
        setErrorMessage('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก (เช่น 0812345678)');
        return false;
      }
      return true;
    }

    if (targetStep === 3) {
      if (!farmName.trim()) {
        setErrorMessage('กรุณาระบุชื่อฟาร์มภาษาไทย');
        return false;
      }
      if (!province.trim()) {
        setErrorMessage('กรุณาเลือกจังหวัด');
        return false;
      }
      if (!district.trim()) {
        setErrorMessage('กรุณาเลือกอำเภอ');
        return false;
      }
      return true;
    }

    if (targetStep === 4) {
      // Step 4 is Atmosphere Photos, Smart Farm, Story, and Socials.
      return true;
    }

    if (targetStep === 5) {
      if (certificationList.length === 0 || !certificationList[0].certNumber.trim()) {
        setErrorMessage('กรุณาระบุเลขที่ใบรับรองมาตรฐานอย่างน้อย 1 รายการ (เช่น GAP หรือ GI)');
        return false;
      }
      return true;
    }

    return true;
  };

  // Comprehensive validation across all steps before submitting
  const validateAllSteps = (): boolean => {
    for (let s = 1; s <= 5; s++) {
      if (!validateCurrentStep(s)) {
        setStep(s as any);
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateCurrentStep(step)) {
      setStep((prev) => Math.min(5, prev + 1) as any);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setErrorMessage('กรุณาเข้าสู่ระบบก่อนส่งคำขอลงทะเบียน');
      return;
    }

    // Comprehensive check across all 5 steps
    if (!validateAllSteps()) return;

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    setSubmitting(true);
    setErrorMessage('');

    try {
      const topVarieties = topVarietiesInput
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const contact: SocialContact = {
        phoneNumber: cleanPhone,
        lineId: lineId.trim(),
        facebook: facebook.trim(),
        instagram: instagram.trim(),
        locationAddress: locationAddress.trim(),
      };

      const finalSmartTech: SmartTechItem[] = hasSmartFarm
        ? AVAILABLE_SMART_TECH.filter((item) => selectedTechIds.includes(item.id)).map((item) => ({
            id: item.id,
            name: item.name,
            subtext: item.subtext,
            iconEmoji: item.iconEmoji,
            active: true,
          }))
        : [];

      const primaryCert = certificationList[0];

      // All farm registrations & manager requests are submitted to Admin Approval Hub first
      const newReq = await submitFarmRegistrationRequest({
        id: initialData?.id,
        createdAt: initialData?.createdAt,
        requestCategory: 'farm_verification',
        requestType: isUpdateMode ? 'update_farm' : 'new_farm',
        targetFarmId:
          targetFarmId ||
          initialData?.targetFarmId ||
          (isUpdateMode ? initialData?.createdFarmId : undefined),
        updateNotes: isUpdateMode ? updateNotes.trim() : undefined,
        userId: currentUser.uid,
        userDisplayName: currentUser.displayName || currentUser.username || farmerFullName.trim() || 'เกษตรกร',
        userEmailOrUsername: currentUser.email || currentUser.username || currentUser.uid,
        farmName: farmName.trim(),
        farmNameEn: farmNameEn.trim(),
        province: province.trim(),
        district: district.trim(),
        locationAddress: locationAddress.trim(),
        areaRai: Number(areaRai) || 1,
        totalTreesEstimate: Number(totalTreesEstimate) || 50,
        topVarieties: topVarieties.length > 0 ? topVarieties : ['หมอนทอง'],
        aboutStory: aboutStory.trim(),
        contact,
        gapCertNumber: primaryCert.certNumber.trim(),
        certIssuedBy: primaryCert.issuedBy.trim(),
        certValidUntil: primaryCert.validUntil.trim(),
        certDocumentPhoto: primaryCert.documentPhoto || '',
        certificationList: certificationList,
        atmospherePhotos:
          atmospherePhotos.length > 0
            ? atmospherePhotos
            : [
                'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80',
              ],
        hasSmartFarm,
        smartTechnologies: finalSmartTech,
        farmerFullName: farmerFullName.trim(),
        farmerIdCardNumber: farmerIdCardNumber.replace(/\D/g, ''),
        farmerIdCardPhoto,
        farmerIdCardFileType,
        agreedToCriteria,
        coordinates,
        googleMapsUrl: googleMapsUrl.trim(),
      });

      if (onRequestSubmitted) {
        onRequestSubmitted(newReq);
      }

      setSubmittedSuccess(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(draftStorageKey);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกคำขอ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };


  return {
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
  };
}
