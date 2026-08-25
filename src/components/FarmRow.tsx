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
      className="group flex items-center gap-2.5 sm:gap-4 py-3 px-3 sm:px-4 min-h-[84px] sm:min-h-0 hover:bg-surface-2 cursor-pointer transition-colors"
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
        <div className="flex items-start sm:items-center gap-1.5">
          {/* บนมือถือปล่อยให้ขึ้นได้ 2 บรรทัด เพราะชื่อฟาร์มไทยยาวกว่าที่จอกว้าง 375px
              จะใส่ในบรรทัดเดียวไหว ถ้าตัดบรรทัดเดียวจะเหลือแค่ราว 100px
              ซึ่งกินความหมายไปมาก ส่วนบนจอกว้างตัดบรรทัดเดียวพอ
              แถวถูกตรึงความสูงขั้นต่ำไว้แล้ว ทุกแถวจึงยังสูงเท่ากัน */}
          <h3 className="font-bold text-sm text-fg line-clamp-2 sm:truncate group-hover:text-gold-soft transition-colors">
            {farm.name}
          </h3>
          {hasGi && (
            <span className="shrink-0 px-1.5 py-px text-[9px] font-bold text-fg-2 border border-line-strong rounded">
              GI
            </span>
          )}
        </div>

        {/* จังหวัดมาก่อนเพราะเป็นสิ่งที่คนกวาดตาหาเป็นอันดับแรก
            ของเดิมเอาธงชาติกับจำนวนสายพันธุ์ขึ้นก่อน แล้วดันจังหวัดไปท้ายสุดและจางสุด
            ธงชาติถูกตัดออกเพราะทุกฟาร์มอยู่ไทยหมด จึงไม่ได้บอกอะไร */}
        <div className="flex items-center gap-1.5 text-xs text-fg-2 mt-0.5 truncate">
          <span className="text-fg-3">{farm.province}</span>
          {varieties > 0 && (
            <>
              <span className="text-line-strong">·</span>
              <span>{varieties} สายพันธุ์</span>
            </>
          )}
        </div>
      </div>

      {/* คะแนนและผลผลิต -- ชิดขวา กว้างคงที่ให้ตัวเลขเรียงเป็นคอลัมน์เดียวกัน */}
      <div className="shrink-0 text-right w-[86px] sm:w-[100px]">
        <div className="flex items-center justify-end gap-1">
          <Star className="w-3.5 h-3.5 text-gold fill-gold" />
          <span className="font-bold text-sm text-fg tabular-nums">
            {farm.rating.toFixed(1)}
            <span className="text-fg-4 font-normal text-xs">/10</span>
          </span>
        </div>
        <div className="text-[11px] text-fg-2 tabular-nums mt-0.5">
          {farm.harvestedFruits.toLocaleString()} ผลผลิต
        </div>
      </div>
    </div>
  );
};
