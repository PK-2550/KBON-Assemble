import React from 'react';
import { Radio } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenNfcScanner: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenNfcScanner,
}) => {
  return (
    <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
      {/* Floating Center Circular NFC Scanner Button with Gold ring */}
      <button
        onClick={onOpenNfcScanner}
        className="pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-gold to-[#c28824] hover:from-[#f0b548] hover:to-gold-hi active:scale-95 text-gold-ink-2 rounded-full shadow-2xl border-4 border-well flex items-center justify-center transition-transform cursor-pointer ring-2 ring-gold/40"
        title="แตะสแกน NFC ผลทุเรียน"
        aria-label="สแกน NFC"
      >
        <Radio className="w-7 h-7 sm:w-8 sm:h-8 text-gold-ink-2 animate-pulse" />
      </button>
    </div>
  );
};
