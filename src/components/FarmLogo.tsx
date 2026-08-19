import React from 'react';

interface FarmLogoProps {
  name: string;
  rank: number;
  bgColor?: string;
  textColor?: string;
}

export const FarmLogo: React.FC<FarmLogoProps> = ({ name, rank, bgColor = '#1e293b', textColor = '#f8fafc' }) => {
  // Generate short initials or iconic symbol
  const initials = name
    .replace('สวนทุเรียน', '')
    .replace('สวน', '')
    .replace('ฟาร์มทุเรียน', '')
    .replace('ฟาร์ม', '')
    .trim()
    .slice(0, 2);

  // SVG durian leaf & fruit outline
  return (
    <div
      className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-sm tracking-wider shadow-xs relative overflow-hidden shrink-0 transition-transform duration-200 group-hover:scale-105 border border-slate-200/80"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* Subtle organic decorative background pattern */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
      
      <div className="flex flex-col items-center justify-center leading-none">
        <span className="text-xs font-semibold uppercase">{initials || `F${rank}`}</span>
        <span className="text-[9px] opacity-70 font-mono mt-0.5 font-normal">#{rank}</span>
      </div>
    </div>
  );
};
