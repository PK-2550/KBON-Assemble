import React from 'react';
import { Star } from 'lucide-react';
import { DurianFarm } from '../types';
import { FarmLogo } from './FarmLogo';

interface FarmRowProps {
  farm: DurianFarm;
  displayRank?: number;
  onSelectFarm: (farm: DurianFarm) => void;
}

/**
 * แถวหนึ่งรายการในตารางจัดอันดับฟาร์ม
 *
 * โครงเดียวกับตาราง Breeders Rating: อันดับ | โลโก้ | ชื่อ + ที่ตั้ง | คะแนน + ผลผลิต
 *
 * สีทองสงวนไว้ให้คะแนนรีวิวเท่านั้น ของเดิมใช้ทองกับอันดับ ดาว คะแนน ป้าย GI
 * และชื่อตอน hover พร้อมกัน พอทุกอย่างเป็นทองก็ไม่มีอะไรเด่นจริง
 */
export const FarmRow: React.FC<FarmRowProps> = ({ farm, displayRank, onSelectFarm }) => {
  const rank = displayRank ?? farm.rank;
  const isTop3 = rank <= 3;
  const varieties = farm.varietiesCount || farm.topVarieties?.length || 0;
  const hasGi = farm.certifications?.some((c) => c.includes('GI'));

  return (
    <div
      onClick={() => onSelectFarm(farm)}
      id={`farm-item-${farm.id}`}
      className="group flex items-center gap-2 sm:gap-4 py-3 px-2.5 sm:px-4 hover:bg-surface-2 cursor-pointer transition-colors"
    >
      {/* อันดับ -- ตัวเลขเปล่า ๆ ไม่ใส่มงกุฎ ให้เป็นหลักยึดสายตาเงียบ ๆ
          กว้างคงที่เพื่อให้ทุกแถวเรียงตรงกันแม้เลขจะขึ้นเป็นสองหลัก */}
      <span
        className={`w-6 shrink-0 text-center text-sm tabular-nums ${
          isTop3 ? 'font-bold text-fg' : 'font-medium text-fg-4'
        }`}
      >
        {rank}
      </span>

      <FarmLogo
        name={farm.name}
        rank={rank}
        bgColor={farm.logoBgColor}
        textColor={farm.logoTextColor}
      />

      {/* ชื่อและที่ตั้ง -- min-w-0 จำเป็น ไม่งั้น truncate ไม่ทำงานใน flex */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="font-bold text-sm text-fg truncate group-hover:text-gold-soft transition-colors">
            {farm.name}
          </h3>
          {/* บนมือถือป้าย GI ย้ายไปบรรทัดรอง เพราะวางไว้ตรงนี้กินที่ชื่อไปราว 30px
              ซึ่งมากพอที่จะทำให้ชื่อไทยส่วนใหญ่ถูกตัด */}
          {hasGi && (
            <span className="hidden sm:inline shrink-0 px-1.5 py-px text-[9px] font-bold text-fg-2 border border-line-strong rounded">
              GI
            </span>
          )}
        </div>

        {/* จังหวัดมาก่อนเพราะเป็นสิ่งที่คนกวาดตาหาเป็นอันดับแรก
            ของเดิมเอาธงชาติกับจำนวนสายพันธุ์ขึ้นก่อน แล้วดันจังหวัดไปท้ายสุดและจางสุด
            ธงชาติถูกตัดออกเพราะทุกฟาร์มอยู่ไทยหมด จึงไม่ได้บอกอะไร */}
        <div className="flex items-center gap-1.5 text-xs text-fg-2 mt-0.5 truncate">
          {hasGi && (
            <span className="sm:hidden shrink-0 px-1 py-px text-[9px] font-bold text-fg-2 border border-line-strong rounded">
              GI
            </span>
          )}
          <span className="text-fg-3">{farm.province}</span>

          {/* บนมือถือเอายอดผลผลิตมาต่อท้ายจังหวัดแทนจำนวนสายพันธุ์
              เพื่อคืนพื้นที่คอลัมน์ขวาให้ชื่อฟาร์ม ดูเหตุผลที่คอลัมน์ขวา */}
          <span className="sm:hidden text-line-strong">·</span>
          <span className="sm:hidden tabular-nums">
            {farm.harvestedFruits.toLocaleString()} ผลผลิต
          </span>

          {varieties > 0 && (
            <>
              <span className="hidden sm:inline text-line-strong">·</span>
              <span className="hidden sm:inline">{varieties} สายพันธุ์</span>
            </>
          )}
        </div>
      </div>

      {/* คอลัมน์ขวา -- กว้างคงที่ให้ตัวเลขของทุกแถวเรียงตรงกัน
          บนมือถือเหลือแค่คะแนน ไม่มียอดผลผลิตและไม่มี /10
          เพราะจอ 375px มีที่ให้เนื้อหาแค่ 346px ถ้าคอลัมน์นี้กิน 86px
          ชื่อฟาร์มจะเหลือ 142px ซึ่งสั้นกว่าชื่อไทยเกือบทุกชื่อ (150-210px)
          พอลดเหลือ 48px ชื่อได้ 182px จึงพอในบรรทัดเดียวเกือบทั้งหมด */}
      <div className="shrink-0 text-right w-12 sm:w-[100px]">
        <div className="flex items-center justify-end gap-1">
          <Star className="w-3.5 h-3.5 text-gold fill-gold" />
          <span className="font-bold text-sm text-fg tabular-nums">
            {farm.rating.toFixed(1)}
            <span className="hidden sm:inline text-fg-4 font-normal text-xs">/10</span>
          </span>
        </div>
        <div className="hidden sm:block text-[11px] text-fg-2 tabular-nums mt-0.5">
          {farm.harvestedFruits.toLocaleString()} ผลผลิต
        </div>
      </div>
    </div>
  );
};
