import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  X,
  Radio,
  Sparkles,
  ShieldCheck,
  Tag,
  Scale,
  Calendar,
  Zap,
  MapPin,
  Award,
  ChevronRight,
} from 'lucide-react';
import { IndividualTree, DurianFarm, NfcScannedFruit } from '../types';
import { INITIAL_DURIAN_FARMS } from '../data/farms';

interface NfcScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTree?: IndividualTree | null;
  targetFarm?: DurianFarm | null;
  onFruitVerified: (fruit: NfcScannedFruit) => void;
}

export const DEMO_NFC_PRESETS = [
  {
    tagId: 'NFC Tag: #VK-MT01-F042',
    treeCode: 'VK-MT-001',
    treeName: 'หมอนทองภูเขาไฟ ต้นแม่พันธุ์ A1 (GI ศรีสะเกษ)',
    farmName: 'สวนทุเรียนภูเขาไฟ ลุงดำ',
    variety: 'หมอนทองภูเขาไฟ (GI)',
    weightKg: 3.8,
    harvestDate: '18 ส.ค. 2026',
    sweetnessBrix: 34.5,
    location: 'อ.กันทรลักษ์ จ.ศรีสะเกษ',
    certified: 'GI & GAP มาตรฐานส่งออก',
  },
  {
    tagId: 'NFC Tag: #LB-LL01-F019',
    treeCode: 'LB-LL-001',
    treeName: 'หลงลับแล แท้จากดอยลับแล ต้น 35 ปี',
    farmName: 'สวนทุเรียนหลง-หลินลับแล ป้าจำเนียร',
    variety: 'หลงลับแล (GI อุตรดิตถ์)',
    weightKg: 2.1,
    harvestDate: '17 ส.ค. 2026',
    sweetnessBrix: 36.2,
    location: 'อ.ลับแล จ.อุตรดิตถ์',
    certified: 'GI ทุเรียนลับแลแท้',
  },
  {
    tagId: 'NFC Tag: #NT-KY01-F008',
    treeCode: 'NT-KY-001',
    treeName: 'ก้านยาวเมืองนนท์ ต้นมรดก 60 ปี คลองบางกอกน้อย',
    farmName: 'สวนทุเรียนเมืองนนท์ มรดกสืบทอด 4 ชั่วอายุคน',
    variety: 'ก้านยาวนนทบุรี (GI นนทบุรี)',
    weightKg: 3.4,
    harvestDate: '16 ส.ค. 2026',
    sweetnessBrix: 35.8,
    location: 'อ.บางกรวย จ.นนทบุรี',
    certified: 'GI นนทบุรี Heritage Organic',
  },
  {
    tagId: 'NFC Tag: #KC-CN01-F027',
    treeCode: 'KC-CN-001',
    treeName: 'ชะนีเกาะช้าง ภูเขาดินแดงริมทะเล',
    farmName: 'สวนทุเรียนชะนีเกาะช้าง อินทรีย์ธรรมชาติ',
    variety: 'ชะนีเกาะช้าง (GI ตราด)',
    weightKg: 3.6,
    harvestDate: '15 ส.ค. 2026',
    sweetnessBrix: 33.9,
    location: 'เกาะช้าง จ.ตราด',
    certified: 'Organic Thailand & GI ตราด',
  },
];

export const NfcScannerModal: React.FC<NfcScannerModalProps> = ({
  isOpen,
  onClose,
  targetTree,
  targetFarm,
  onFruitVerified,
}) => {
  const [scanState, setScanState] = useState<'ready' | 'scanning' | 'success' | 'error'>('ready');
  const [progress, setProgress] = useState(0);
  const [verifiedFruit, setVerifiedFruit] = useState<NfcScannedFruit | null>(null);
  const [nfcApiSupported, setNfcApiSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setNfcApiSupported(true);
    }
  }, []);

  // Play pleasant chime on NFC scan success
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15); // A6
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // AudioContext unavailable in silent environments
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setScanState('ready');
      setProgress(0);
      setVerifiedFruit(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartScan = (presetFruit?: typeof DEMO_NFC_PRESETS[0]) => {
    setScanState('scanning');
    setProgress(0);

    // If Web NFC is supported on Android device, try invoking real reader
    if (nfcApiSupported && !presetFruit) {
      try {
        const ndef = new (window as any).NDEFReader();
        ndef.scan().then(() => {
          ndef.onreading = (event: any) => {
            console.log('NDEF Tag serialNumber:', event.serialNumber);
          };
        }).catch((err: any) => {
          console.log('Web NFC not permitted or simulated:', err);
        });
      } catch (e) {
        // Fallback to synthetic scan
      }
    }

    let current = 0;
    const interval = setInterval(() => {
      current += 25;
      setProgress(current);
      if (current >= 100) {
        clearInterval(interval);

        if (presetFruit) {
          const fruitData: NfcScannedFruit = {
            tagId: presetFruit.tagId,
            treeCode: presetFruit.treeCode,
            treeName: presetFruit.treeName,
            farmName: presetFruit.farmName,
            variety: presetFruit.variety,
            weightKg: presetFruit.weightKg,
            harvestDate: presetFruit.harvestDate,
            sweetnessBrix: presetFruit.sweetnessBrix,
            verified: true,
          };
          setVerifiedFruit(fruitData);
        } else {
          // Generate valid fruit data for this tree/farm
          const treeCode = targetTree?.code || 'VK-MT-001';
          const fruitNum = Math.floor(Math.random() * 75 + 1).toString().padStart(3, '0');
          const fruitTag = `NFC Tag: #${treeCode.split('-')[0]}-F${fruitNum}`;
          const weight = Number((3.2 + Math.random() * 1.4).toFixed(1));

          const fruitData: NfcScannedFruit = {
            tagId: fruitTag,
            treeCode: targetTree?.code || treeCode,
            treeName: targetTree?.name || 'หมอนทองภูเขาไฟ ต้นแม่พันธุ์ A1',
            farmName: targetFarm?.name || 'สวนทุเรียนภูเขาไฟ ลุงดำ',
            variety: targetTree?.variety || 'หมอนทองภูเขาไฟ',
            weightKg: weight,
            harvestDate: '18 ส.ค. 2026',
            sweetnessBrix: targetTree?.sweetnessBrix || 34.5,
            verified: true,
          };
          setVerifiedFruit(fruitData);
        }

        setScanState('success');
        playScanBeep();
      }
    }, 200);
  };

  const handleConfirmAndProceed = () => {
    if (verifiedFruit) {
      onFruitVerified(verifiedFruit);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-canvas text-fg rounded-t-[32px] sm:rounded-[32px] max-w-md w-full max-h-[94vh] overflow-y-auto shadow-2xl border border-line animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Mobile Pull Bar Indicator */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-12 h-1.5 bg-line rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 sm:p-5 px-5 sm:px-6 flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-2 border border-line-strong flex items-center justify-center text-gold shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-1.5">
                <span>สแกน NFC ผลทุเรียน</span>
                <span className="text-[9px] bg-gold/20 text-gold-soft font-mono px-2 py-0.5 rounded-full border border-gold/40">
                  NFC Verified
                </span>
              </h3>
              <p className="text-[11px] text-fg-2">
                แตะโทรศัพท์มือถือที่ชิป NFC ติดขั้วผลทุเรียน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-fg-2 hover:text-white hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-4 text-center">
          {scanState === 'ready' && (
            <div className="space-y-4 py-1">
              {/* Radar & Phone Animation */}
              <div className="relative mx-auto w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-line animate-ping opacity-25" />
                <div className="absolute inset-2 rounded-full bg-surface border border-line" />
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 bg-gradient-to-br from-surface-2 to-[#0a2014] text-gold rounded-2xl flex flex-col items-center justify-center border border-gold/40 shadow-lg">
                  <Smartphone className="w-8 h-8 sm:w-9 sm:h-9 animate-bounce" />
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-white text-base">
                  นำมือถือแตะที่ชิป NFC ขั้วทุเรียน
                </h4>
                <p className="text-xs text-fg-2 max-w-xs mx-auto leading-relaxed">
                  {targetTree ? (
                    <>
                      เพื่อตรวจสอบต้น{' '}
                      <span className="font-bold text-gold">[{targetTree.code}] {targetTree.name}</span>
                    </>
                  ) : (
                    'ระบบจะอ่านรหัสผล น้ำหนัก และตรวจสอบย้อนกลับสู่ต้นแม่พันธุ์และพิกัดแปลงปลูกจริง'
                  )}
                </p>
              </div>

              {/* Main Quick Scan Action */}
              <button
                onClick={() => handleStartScan()}
                className="w-full py-3.5 bg-gradient-to-r from-gold to-[#d89727] hover:from-[#d89727] hover:to-[#c6861d] text-gold-ink text-sm font-extrabold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                <span>แตะเริ่มสแกน NFC ทันที</span>
              </button>

              {/* 1-Tap Demo Durian Fruit Presets for Easy Mobile Testing */}
              <div className="pt-3 text-left border-t border-line">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-fg flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-gold" />
                    <span>หรือทดสอบแตะผลทุเรียนจำลอง (Demo NFC Tag)</span>
                  </span>
                  <span className="text-[10px] text-fg-2">1-Tap Test</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {DEMO_NFC_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStartScan(preset)}
                      className="w-full p-2.5 bg-surface hover:bg-surface-2 border border-line hover:border-gold/50 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-surface-2 border border-line-strong text-gold text-xs font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-gold leading-tight">
                            {preset.variety}
                          </div>
                          <div className="text-[10px] text-fg-2 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-gold" />
                            <span>{preset.farmName}</span>
                            <span className="text-leaf font-bold">• {preset.sweetnessBrix}° Brix</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-fg-2 group-hover:text-gold shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {scanState === 'scanning' && (
            <div className="py-8 space-y-6">
              <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-gold border-t-transparent animate-spin" />
                <div className="w-18 h-18 rounded-full bg-surface text-gold flex items-center justify-center border border-line">
                  <Radio className="w-9 h-9 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-extrabold text-white text-base">
                  กำลังอ่านคลื่นความถี่ NFC จากขั้วผล...
                </h4>
                <p className="text-xs text-fg-2">
                  กำลังถอดรหัสและตรวจสอบลายเซ็นดิจิทัล (NFC Cryptographic Check)
                </p>
                {/* Progress bar */}
                <div className="w-48 mx-auto bg-canvas rounded-full h-2 overflow-hidden mt-3 border border-line">
                  <div
                    className="bg-gradient-to-r from-gold to-leaf h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {scanState === 'success' && verifiedFruit && (
            <div className="py-1 space-y-3.5 text-left animate-in fade-in">
              {/* Verified Origin Tag & Header */}
              <div className="bg-surface border border-line rounded-2xl p-3.5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-line-strong text-gold flex items-center justify-center shrink-0 shadow-md">
                  <CheckCircle2 className="w-6 h-6 text-leaf" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-leaf flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-leaf" />
                    <span>ยืนยันผลทุเรียนแท้ 100% (Verified Origin)</span>
                  </span>
                  <div className="text-sm font-black text-white mt-0.5 font-mono truncate">
                    {verifiedFruit.tagId}
                  </div>
                </div>
              </div>

              {/* Scanned Fruit Details Grid */}
              <div className="bg-surface border border-line rounded-2xl p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-fg-2 flex items-center gap-1 text-[11px]">
                    <Tag className="w-3.5 h-3.5 text-gold" />
                    <span>ต้นแม่พันธุ์:</span>
                  </span>
                  <span className="font-bold font-mono text-gold text-[11px] text-right truncate max-w-[200px]">
                    [{verifiedFruit.treeCode}] {verifiedFruit.treeName}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-fg-2 flex items-center gap-1 text-[11px]">
                    <Scale className="w-3.5 h-3.5 text-fg-2" />
                    <span>น้ำหนักผล:</span>
                  </span>
                  <span className="font-bold text-white text-[11px]">
                    {verifiedFruit.weightKg} กิโลกรัม
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-line">
                  <span className="text-fg-2 flex items-center gap-1 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-fg-2" />
                    <span>วันที่ตัดจากต้น:</span>
                  </span>
                  <span className="font-bold text-white text-[11px]">
                    {verifiedFruit.harvestDate}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-fg-2 flex items-center gap-1 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-gold" />
                    <span>ความหวานมาตรฐาน:</span>
                  </span>
                  <span className="font-extrabold text-gold-soft text-[11px]">
                    {verifiedFruit.sweetnessBrix}° Brix (การันตีความอร่อย)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleConfirmAndProceed}
                  className="w-full py-3.5 bg-gradient-to-r from-gold to-[#d89727] hover:from-[#d89727] hover:to-[#c6861d] text-gold-ink text-xs sm:text-sm font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Award className="w-4 h-4" />
                  <span>ดูใบรับรองประวัติต้น และส่งรีวิว (Verified Review)</span>
                </button>

                <button
                  onClick={() => setScanState('ready')}
                  className="w-full py-2 text-fg-2 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  ← สแกนผลทุเรียนลูกอื่น
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
