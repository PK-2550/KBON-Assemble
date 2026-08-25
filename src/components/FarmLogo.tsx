import React from 'react';

interface FarmLogoProps {
  name: string;
  rank: number;
  bgColor?: string;
  textColor?: string;
}

/**
 * ตราสัญลักษณ์ฟาร์ม -- ใช้อักษรย่อจากชื่อ เพราะฟาร์มส่วนใหญ่ยังไม่มีโลโก้จริง
 *
 * ไม่แสดงเลขอันดับซ้อนในนี้แล้ว เพราะแถวมีคอลัมน์อันดับอยู่ข้าง ๆ อยู่แล้ว
 * การแสดงสองที่ทำให้อ่านสะดุดและกินพื้นที่ที่ควรเป็นของชื่อฟาร์ม
 */
export const FarmLogo: React.FC<FarmLogoProps> = ({
  name,
  rank,
  bgColor = '#132b1c',
  textColor = '#c8dcd0',
}) => {
  const initials =
    name
      .replace('สวนทุเรียน', '')
      .replace('ฟาร์มทุเรียน', '')
      .replace('สวน', '')
      .replace('ฟาร์ม', '')
      .trim()
      .slice(0, 2) || `F${rank}`;

  return (
    <div
      className="w-10 h-10 shrink-0 rounded-lg border border-line flex items-center justify-center text-sm font-bold"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {initials}
    </div>
  );
};
