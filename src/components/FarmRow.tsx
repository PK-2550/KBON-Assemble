import React from 'react';
import { Star, MapPin, Sprout, Package, Sparkles } from 'lucide-react';
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
/**
 * จำนวนตราสูงสุดที่แสดงในแถวเดียว
 *
 * สามใบพอดีกับที่ว่างข้างชื่อฟาร์มบนจอ sm โดยยังเหลือที่ให้ชื่อไทยความยาวปกติ
 * ที่เกินจากนี้ยุบเป็นตัวเลขนับ
 */
const MAX_BADGES = 3;

export const FarmRow: React.FC<FarmRowProps> = ({ farm, displayRank, onSelectFarm }) => {
  const rank = displayRank ?? farm.rank;
  const isTop3 = rank <= 3;
  const varieties = farm.varietiesCount || farm.topVarieties?.length || 0;
  /**
   * ตราใบรับรอง -- เอาเฉพาะใบที่ผ่านการตรวจของแอดมินแล้ว
   *
   * เดิมอ่านจาก farm.certifications ซึ่งเป็น array ข้อความชุดเก่าที่ไม่มีสถานะ
   * การตรวจติดมาด้วย ป้ายจึงขึ้นแม้ใบนั้นจะยังไม่ผ่าน
   *
   * approvalStatus เป็นค่าที่ใช้ตัดสิน ส่วน verified รองรับข้อมูลชุดเก่า
   * ที่ยังไม่มีฟิลด์ใหม่ เกณฑ์เดียวกับแถบตราในหน้ารายละเอียดฟาร์ม
   */
  const approvedCerts = (farm.certificationDetails ?? []).filter((c) =>
    c.approvalStatus ? c.approvalStatus === 'approved' : c.verified
  );

  // แถวในหน้ารายชื่อแคบ ถ้าปล่อยให้ตราขึ้นทุกใบ ชื่อฟาร์มจะถูกบีบจนอ่านไม่ออก
  const shownCerts = approvedCerts.slice(0, MAX_BADGES);
  const hiddenCertCount = approvedCerts.length - shownCerts.length;

  /**
   * ตรา Smart Farm -- ไม่ใช่ใบรับรอง จึงแยกสีจากตรา cert
   *
   * เป็นคุณสมบัติของสวน ไม่ได้ผ่านการตรวจของแอดมินแบบใบรับรอง เกณฑ์เดียวกับ
   * การ์ด Smart Farm ในหน้าโปรไฟล์ (FarmProfileHeaderCard) คือมีอุปกรณ์ที่ยัง
   * active อย่างน้อยหนึ่งตัว และไม่ได้ถูกปิดไว้
   */
  const activeSmartTech = (farm.smartTechnologies ?? []).filter((t) => t.active !== false);
  const showSmartFarm = farm.hasSmartFarm !== false && activeSmartTech.length > 0;

  return (
    <div
      onClick={() => onSelectFarm(farm)}
      id={`farm-item-${farm.id}`}
      /*
       * มือถือกับจอกว้างใช้ผังคนละแบบ ไม่ใช่แบบเดียวกันย่อ ๆ
       *
       * มือถือ  แถวเดียวแบบรายการ อันดับ โลโก้ ชื่อ แล้วคะแนนชิดขวา
       * จอกว้าง กริดคอลัมน์ตายตัวให้ทุกแถวเรียงตรงกันเป็นตาราง
       *         ตัวเลขที่มือถือซ่อนไว้เพราะไม่มีที่ ถูกดึงกลับมาเป็นคอลัมน์ของตัวเอง
       */
      className="group flex items-center gap-2 sm:gap-4 py-3 px-2.5 sm:px-4 hover:bg-surface-2 cursor-pointer transition-colors
                 lg:items-start lg:gap-4 lg:rounded-2xl lg:border lg:border-line lg:bg-surface
                 lg:px-5 lg:py-4 lg:hover:border-line-strong lg:hover:bg-surface-2"
    >
      {/* อันดับ -- ตัวเลขเปล่า ๆ ไม่ใส่มงกุฎ ให้เป็นหลักยึดสายตาเงียบ ๆ
          กว้างคงที่เพื่อให้ทุกแถวเรียงตรงกันแม้เลขจะขึ้นเป็นสองหลัก */}
      <span
        className={`w-6 shrink-0 text-center text-sm tabular-nums lg:pt-1 ${
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
          {/* บนมือถือตราย้ายไปบรรทัดรอง เพราะวางไว้ตรงนี้กินที่ชื่อไปราว 30px ต่อใบ
              ซึ่งมากพอที่จะทำให้ชื่อไทยส่วนใหญ่ถูกตัด */}
          {shownCerts.map((c) => (
            <span
              key={c.shortCode}
              className="hidden sm:inline shrink-0 px-1.5 py-px text-[9px] font-bold text-fg-2 border border-line-strong rounded"
            >
              {c.shortCode}
            </span>
          ))}
          {hiddenCertCount > 0 && (
            <span className="hidden sm:inline shrink-0 px-1.5 py-px text-[9px] font-bold text-fg-3 border border-line rounded">
              +{hiddenCertCount}
            </span>
          )}
          {showSmartFarm && (
            <span
              className="hidden sm:inline-flex items-center gap-0.5 shrink-0 px-1.5 py-px text-[9px] font-bold text-sky-300 border border-sky-500/40 bg-sky-500/10 rounded"
              title="สวนนี้ใช้เทคโนโลยี Smart Farm"
            >
              <Sparkles className="w-2.5 h-2.5" />
              Smart Farm
            </span>
          )}
        </div>

        {/* จังหวัดมาก่อนเพราะเป็นสิ่งที่คนกวาดตาหาเป็นอันดับแรก
            ของเดิมเอาธงชาติกับจำนวนสายพันธุ์ขึ้นก่อน แล้วดันจังหวัดไปท้ายสุดและจางสุด
            ธงชาติถูกตัดออกเพราะทุกฟาร์มอยู่ไทยหมด จึงไม่ได้บอกอะไร */}
        <div className="flex items-center gap-1.5 text-xs text-fg-2 mt-0.5 lg:hidden">
          {shownCerts.map((c) => (
            <span
              key={c.shortCode}
              className="sm:hidden shrink-0 px-1 py-px text-[9px] font-bold text-fg-2 border border-line-strong rounded"
            >
              {c.shortCode}
            </span>
          ))}
          {hiddenCertCount > 0 && (
            <span className="sm:hidden shrink-0 px-1 py-px text-[9px] font-bold text-fg-3 border border-line rounded">
              +{hiddenCertCount}
            </span>
          )}
          {/* บนมือถือแถวแคบ ใช้ไอคอนล้วนแทนชิปมีป้าย และล็อก shrink-0
              เหมือนตรา ให้จังหวัดเป็นตัวเดียวที่ยุบ ตามบทเรียนเรื่อง truncate */}
          {showSmartFarm && (
            <Sparkles className="sm:hidden shrink-0 w-3 h-3 text-sky-400" aria-label="Smart Farm" />
          )}
          {/* จังหวัดเป็นตัวเดียวที่ยอมให้ยุบเมื่อพื้นที่ไม่พอ ตรากับยอดผลผลิต
              ล็อก shrink-0 ไว้ ไม่งั้น ellipsis จะกินท้ายบรรทัดคือตัวเลขผลผลิต
              ทั้งที่ตัวการล้นคือตรา (2 ตรา + เลข 5 หลัก เกินคอลัมน์ ~4px) */}
          <span className="min-w-0 truncate text-fg-3">{farm.province}</span>

          {/* บนมือถือเอายอดผลผลิตมาต่อท้ายจังหวัดแทนจำนวนสายพันธุ์
              เพื่อคืนพื้นที่คอลัมน์ขวาให้ชื่อฟาร์ม ดูเหตุผลที่คอลัมน์ขวา */}
          <span className="sm:hidden shrink-0 text-line-strong">·</span>
          <span className="sm:hidden shrink-0 tabular-nums">
            {farm.harvestedFruits.toLocaleString()} ผลผลิต
          </span>

          {varieties > 0 && (
            <>
              <span className="hidden sm:inline text-line-strong">·</span>
              <span className="hidden sm:inline">{varieties} สายพันธุ์</span>
            </>
          )}
        </div>

        {/* จอกว้าง -- บรรทัดรองและแถบสถิติในการ์ด
            ตัวเลขวางเป็นไอคอนคู่ตัวเลขเรียงแนวนอน ไม่ใช่คอลัมน์ตาราง
            การ์ดจึงอ่านจบได้ในตัวเอง ไม่ต้องเงยไปดูหัวคอลัมน์ */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-fg-2 mt-1">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-fg-4" />
          <span className="truncate">{farm.province}</span>
        </div>

        <div className="hidden lg:flex items-center gap-5 mt-2.5 text-sm">
          <span className="flex items-center gap-1.5 text-fg-2">
            <Sprout className="w-4 h-4 shrink-0 text-leaf" />
            <span className="tabular-nums text-fg">{varieties || '—'}</span>
            <span className="text-xs">สายพันธุ์</span>
          </span>

          <span className="flex items-center gap-1.5 text-fg-2">
            <Package className="w-4 h-4 shrink-0 text-fg-3" />
            <span className="tabular-nums text-fg">{farm.harvestedFruits.toLocaleString()}</span>
            <span className="text-xs">ผลผลิต</span>
          </span>

          <span className="flex items-center gap-1.5">
            <Star className="w-4 h-4 shrink-0 text-gold fill-gold" />
            <span className="font-bold tabular-nums text-fg">{farm.rating.toFixed(1)}</span>
            <span className="text-xs text-fg-4">/10</span>
          </span>
        </div>
      </div>

      {/* คอลัมน์ขวา -- กว้างคงที่ให้ตัวเลขของทุกแถวเรียงตรงกัน
          บนมือถือเหลือแค่คะแนน ไม่มียอดผลผลิตและไม่มี /10
          เพราะจอ 375px มีที่ให้เนื้อหาแค่ 346px ถ้าคอลัมน์นี้กิน 86px
          ชื่อฟาร์มจะเหลือ 142px ซึ่งสั้นกว่าชื่อไทยเกือบทุกชื่อ (150-210px)
          พอลดเหลือ 48px ชื่อได้ 182px จึงพอในบรรทัดเดียวเกือบทั้งหมด */}
      <div className="shrink-0 text-right w-12 sm:w-[100px] lg:hidden">
        <div className="flex items-center justify-end gap-1">
          <Star className="w-3.5 h-3.5 text-gold fill-gold" />
          <span className="font-bold text-sm text-fg tabular-nums">
            {farm.rating.toFixed(1)}
            <span className="hidden sm:inline text-fg-4 font-normal text-xs">/10</span>
          </span>
        </div>
        <div className="hidden sm:block lg:hidden text-[11px] text-fg-2 tabular-nums mt-0.5">
          {farm.harvestedFruits.toLocaleString()} ผลผลิต
        </div>
      </div>
    </div>
  );
};
