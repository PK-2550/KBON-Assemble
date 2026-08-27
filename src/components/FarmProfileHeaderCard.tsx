import React from 'react';
import {
  ArrowLeft,
  MapPin,
  Star,
  Share2,
  Phone,
  Send,
  Camera,
  FileEdit,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { DurianFarm, SmartTechItem } from '../types';

/**
 * ตัวเลขหนึ่งตัวในแถบสถิติ -- ค่าอยู่บน ป้ายกำกับอยู่ล่าง
 * ตั้งขนาดใหญ่โดยตั้งใจ ตัวเลขคือสิ่งที่คนมาดูหน้าฟาร์มอยากรู้ก่อน
 */
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0">
    <div className="text-xl sm:text-2xl font-black text-fg tabular-nums leading-none">{value}</div>
    <div className="text-[11px] sm:text-xs text-fg-2 mt-1.5 truncate">{label}</div>
  </div>
);

interface FarmProfileHeaderCardProps {
  farm: DurianFarm;
  /** รูปบรรยากาศที่ใช้ทั้งเป็นแบนเนอร์และรูปปก คำนวณที่หน้าแม่ */
  photos: string[];
  /** จำนวนต้นที่ขึ้นทะเบียน มาจากรายการเดียวกับที่แท็บต้นไม้ใช้ */
  registeredTreeCount: number;
  /**
   * รายการเทคโนโลยีตั้งต้น ส่งมาจากหน้าแม่ ไม่ประกาศซ้ำในนี้
   * ยังไม่มีฟิลด์ active เพราะเติมให้ตอนส่งเข้าโมดัล จึงยังไม่ใช่ SmartTechItem เต็มรูป
   */
  defaultSmartTech: Omit<SmartTechItem, 'active'>[];
  isOwnerOrAdmin: boolean;

  /**
   * ข้อความแจ้งสำเร็จ อยู่ที่หน้าแม่เพราะมีสามที่ที่ตั้งค่านี้
   * คือปุ่มแชร์ การบันทึกรูป และการส่งคำขอแก้ไข
   */
  successToast: string;

  /**
   * สถานะกางเรื่องราวฟาร์ม เก็บที่หน้าแม่ ไม่ได้เก็บในนี้
   *
   * ถ้าเก็บในนี้ พอผู้ใช้กางเรื่องราวแล้วกดดูต้นไม้ การ์ดนี้จะถูก unmount
   * ตาม early-return ของหน้าแม่ พอย้อนกลับมาเรื่องราวจะหุบเอง
   * ซึ่งต่างจากพฤติกรรมเดิมก่อนแยกไฟล์
   */
  storyExpanded: boolean;
  onToggleStory: () => void;

  onBack: () => void;
  onOpenGallery: () => void;
  onShare: () => void;
  onOpenPhotoManager: () => void;
  onOpenUpdateRequest: () => void;
  /**
   * เปิดโมดัลตั้งค่า SmartFarm พร้อมค่าตั้งต้น
   *
   * รับค่าตั้งต้นเป็นอาร์กิวเมนต์ เพราะปุ่มสองปุ่มในการ์ดนี้ส่งค่าคนละชุด
   * ปุ่มรูปเฟืองส่งค่าเดิมของสวน ปุ่มเพิ่มระบบส่ง false กับรายการตั้งต้น
   */
  onOpenSmartTechConfig: (hasSmartFarm: boolean, techList: SmartTechItem[]) => void;
}

/**
 * การ์ดหัวหน้าฟาร์ม แบนเนอร์ ชื่อ สถิติ ปุ่มติดต่อ เรื่องราว
 * ลิงก์โซเชียล แถบผู้จัดการสวน และการ์ดสถานะ SmartFarm
 */
export const FarmProfileHeaderCard: React.FC<FarmProfileHeaderCardProps> = ({
  farm: currentFarm,
  photos,
  registeredTreeCount,
  defaultSmartTech,
  isOwnerOrAdmin,
  successToast,
  storyExpanded,
  onToggleStory,
  onBack,
  onOpenGallery,
  onShare,
  onOpenPhotoManager,
  onOpenUpdateRequest,
  onOpenSmartTechConfig,
}) => {
  const farmInitials =
    (currentFarm?.name || 'TC')
      .split(' ')
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase() || 'TC';

  const activeSmartTech = currentFarm.smartTechnologies?.filter((t) => t.active) || [];
  const showSmartFarmCard = currentFarm.hasSmartFarm !== false && activeSmartTech.length > 0;

  return (
  <div className="bg-surface text-fg rounded-3xl overflow-hidden shadow-xl border border-line">
    {/* แบนเนอร์พื้นหลัง -- รูปบรรยากาศสวนใบแรก ใช้เป็นพื้นหลังเฉย ๆ
        หรี่แสงลงมากเพื่อให้เป็นฉากหลัง ไม่แย่งความสนใจจากเนื้อหา
        ต้นแบบก็ใช้แบนเนอร์กว้างเต็มด้านบนแบบนี้ */}
    <div className="relative h-28 sm:h-40 bg-canvas overflow-hidden">
      <img
        src={photos[0]}
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent pointer-events-none" />

      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-canvas/70 hover:bg-canvas backdrop-blur-md rounded-full text-xs font-bold text-fg border border-line transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับ</span>
        </button>

        {isOwnerOrAdmin && (
          <button
            onClick={() => onOpenPhotoManager()}
            className="px-3 py-1.5 bg-gold hover:bg-gold-hi text-gold-ink text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">จัดการรูป</span>
          </button>
        )}
      </div>
    </div>

    {/* Farm Identity Header & Rating Card */}
    <div className="p-4 sm:p-6 space-y-5">
      {/* การ์ดรูปแนวตั้ง + ตัวตนของฟาร์ม วางคู่กันแบบต้นแบบ
          รูปเป็นการ์ดใบเดียวมีป้ายนับ กดแล้วเปิดดูรูปที่เหลือด้วยการเลื่อนลง
          ของเดิมเป็นแกลเลอรีเต็มความกว้างพร้อมแถบรูปย่อ ซึ่งกินพื้นที่บนสุด
          ของหน้าไปมากทั้งที่รูปบรรยากาศไม่ใช่ข้อมูลที่คนมาหา */}
      <div className="flex items-start gap-3.5 sm:gap-5 -mt-12 sm:-mt-16 relative z-10">
        <button
          onClick={() => onOpenGallery()}
          className="relative shrink-0 w-[38%] max-w-[170px] aspect-3/4 rounded-2xl overflow-hidden border border-line bg-canvas cursor-pointer group"
        >
          <img
            src={photos[0]}
            alt={`บรรยากาศ${currentFarm.name}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-canvas/85 text-fg text-[11px] font-bold tabular-nums">
            1/{photos.length}
          </span>
        </button>

        <div className="min-w-0 flex-1 pt-12 sm:pt-16">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-surface-2 border border-line-strong flex items-center justify-center text-gold font-black text-xl sm:text-2xl font-serif mb-2.5">
            {farmInitials}
          </div>

          <h1 className="text-xl sm:text-3xl font-black text-fg tracking-tight leading-tight">
            {currentFarm.name}
          </h1>
          <div className="flex items-center gap-1 text-xs sm:text-sm text-fg-2 mt-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {currentFarm.district ? `${currentFarm.district} · ` : ''}
              {currentFarm.province}
            </span>
          </div>
        </div>
      </div>

      {/* ตัวเลขชูโรง -- อันดับกับคะแนน วางคู่กันและตั้งขนาดใหญ่
          เหมือนที่ต้นแบบชู #1 กับ 8.9 ให้เห็นก่อนอย่างอื่น
          ของเดิมสองค่านี้ถูกยัดรวมไปกับสถิติอื่นในขนาด 16px จนจมหาย */}
      <div className="flex items-stretch rounded-2xl border border-line overflow-hidden">
        <div className="flex-1 py-3.5 text-center">
          <div className="text-3xl sm:text-4xl font-black text-fg tabular-nums leading-none">
            #{currentFarm.rank}
          </div>
          <div className="text-[11px] sm:text-xs text-fg-2 mt-1.5">อันดับทำเนียบ</div>
        </div>

        <div className="w-px bg-line" />

        <div className="flex-1 py-3.5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Star className="w-6 h-6 sm:w-7 sm:h-7 text-gold fill-gold" />
            <span className="text-3xl sm:text-4xl font-black text-gold tabular-nums leading-none">
              {currentFarm.rating.toFixed(1)}
            </span>
          </div>
          <div className="text-[11px] sm:text-xs text-fg-2 mt-1.5 tabular-nums">
            {currentFarm.reviewCount.toLocaleString()} รีวิว
          </div>
        </div>
      </div>

      {/* ปุ่มหลัก -- ตำแหน่งเดียวกับ Buy Now / Message ของต้นแบบ
          โทรหาฟาร์มเป็นสิ่งที่ผู้ซื้อทำจริงมากที่สุด จึงให้เป็นปุ่มเด่นสุดของหน้า */}
      <div className="flex items-center gap-2.5">
        {currentFarm.contact?.phoneNumber ? (
          <a
            href={`tel:${currentFarm.contact.phoneNumber.replace(/[^0-9+]/g, '')}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gold hover:bg-gold-hi text-gold-ink text-base font-bold rounded-2xl transition-colors"
          >
            <Phone className="w-5 h-5" />
            <span>ติดต่อฟาร์ม</span>
          </a>
        ) : null}

        <button
          onClick={onShare}
          className="shrink-0 flex items-center justify-center gap-2 px-5 py-3.5 bg-surface-2 border border-line hover:border-line-strong text-fg-2 hover:text-fg text-base font-bold rounded-2xl transition-colors cursor-pointer"
        >
          <Share2 className="w-5 h-5" />
          <span className="hidden sm:inline">แชร์</span>
        </button>
      </div>

      {/* สถิติรอง -- วางไว้ใต้ปุ่มตามลำดับของต้นแบบ
          แสดงเฉพาะค่าที่มีข้อมูลจริง ของเดิมเติมค่าปลอมเมื่อไม่มีข้อมูล
          (พื้นที่ 48 ไร่ เก็บ 3 รอบต่อปี น้ำหนักคำนวณจากผลคูณ 3.5)
          ซึ่งแสดงเลขที่แต่งขึ้นราวกับเป็นข้อเท็จจริงของฟาร์มนั้น */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-4">
        <Stat label="ต้นทุเรียน" value={currentFarm.totalTrees.toLocaleString()} />
        <Stat label="ผลผลิตสะสม" value={currentFarm.harvestedFruits.toLocaleString()} />
        <Stat
          label="สายพันธุ์"
          value={String(currentFarm.varietiesCount || currentFarm.topVarieties?.length || 0)}
        />
        {currentFarm.areaRai ? <Stat label="พื้นที่ (ไร่)" value={String(currentFarm.areaRai)} /> : null}
        {currentFarm.establishedYear ? (
          <Stat label="ก่อตั้งเมื่อ" value={String(currentFarm.establishedYear)} />
        ) : null}
        <Stat label="ต้นที่ขึ้นทะเบียน" value={String(registeredTreeCount)} />
      </div>

      {/* เรื่องราวของฟาร์ม -- ย้ายขึ้นมาไว้ใต้สถิติตามผังต้นแบบ
          ของเดิมซ่อนอยู่ในแท็บ "ประวัติฟาร์ม" ซึ่งคนส่วนใหญ่ไม่ได้กดเข้าไปดู */}
      {(currentFarm.highlight || currentFarm.aboutStory) && (
        <div className="space-y-1.5">
          {currentFarm.highlight && (
            <p className="text-sm text-fg font-medium leading-relaxed">{currentFarm.highlight}</p>
          )}
          {currentFarm.aboutStory && (
            <>
              <p
                className={`text-xs text-fg-2 leading-relaxed ${
                  storyExpanded ? '' : 'line-clamp-3'
                }`}
              >
                {currentFarm.aboutStory}
              </p>
              <button
                onClick={() => onToggleStory()}
                className="text-xs font-bold text-gold-soft hover:text-gold cursor-pointer"
              >
                {storyExpanded ? 'ย่อลง' : 'อ่านเพิ่มเติม'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ช่องทางติดต่อ -- ย้ายลงมาไว้ใต้เรื่องราวตามผังต้นแบบ
          ของเดิมอยู่เหนือสถิติ ซึ่งดันเนื้อหาหลักของฟาร์มให้ลงไปอยู่ล่าง */}
      <div className="grid grid-cols-3 gap-2 text-xs font-bold">
        <a
          href={currentFarm.contact?.facebook || 'https://facebook.com'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-surface-2 border border-line hover:border-line-strong text-fg-2 hover:text-fg rounded-xl transition-colors"
        >
          <span className="font-extrabold">f</span>
          <span className="truncate">Facebook</span>
        </a>

        <a
          href={currentFarm.contact?.instagram ? `https://instagram.com/${currentFarm.contact.instagram}` : 'https://instagram.com'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-surface-2 border border-line hover:border-line-strong text-fg-2 hover:text-fg rounded-xl transition-colors"
        >
          <span>📷</span>
          <span className="truncate">Instagram</span>
        </a>

        <a
          href={currentFarm.contact?.lineId ? `https://line.me/R/ti/p/${encodeURIComponent(currentFarm.contact.lineId)}` : 'https://line.me'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-surface-2 border border-line hover:border-line-strong text-fg-2 hover:text-fg rounded-xl transition-colors"
        >
          <span>💬</span>
          <span className="truncate">LINE OA</span>
        </a>
      </div>

      {/* Success Toast for Update Request */}
      {successToast && (
        <div className="p-3 bg-purple-950/80 border border-purple-500/60 rounded-2xl text-xs font-bold text-purple-200 flex items-center gap-2 animate-in slide-in-from-top shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Manager Action Banner: Request Farm Edit/Update to Admin */}
      {isOwnerOrAdmin && (
        <div className="p-3.5 bg-gradient-to-r from-purple-950/40 via-surface to-indigo-950/40 border border-purple-700/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-900/60 border border-purple-600/50 flex items-center justify-center text-purple-300 shrink-0">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>แผงควบคุมผู้จัดการสวน (Manager Hub)</span>
                <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded-md">
                  Manager
                </span>
              </div>
              <p className="text-[11px] text-fg-2">
                ต้องการแก้ไขข้อมูลที่กรอกผิด หรือเพิ่มเติมใบรับรอง / บรรยากาศสวน?
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenUpdateRequest()}
            className="w-full sm:w-auto px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>ส่งคำขอแก้ไขข้อมูลสวน (หา Admin)</span>
          </button>
        </div>
      )}


      {/* SmartFarm Innovation Section (Optional & Toggleable by Farm Manager) */}
      {showSmartFarmCard ? (
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#122b1c] border border-line p-4 sm:p-5 shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-32 bg-emerald-600/10 blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-2 relative z-10">
            <div>
              <h3 className="font-serif font-black text-gold-soft text-base sm:text-lg tracking-wide leading-tight flex items-center gap-1.5">
                <span>SmartFarm</span>
                <span className="text-xs font-normal text-fg-2">({activeSmartTech.length} ระบบ)</span>
              </h3>
              <p className="text-xs text-fg-2 font-medium mt-0.5">เทคโนโลยีแม่นยำภายในฟาร์ม</p>
            </div>

            <div className="flex items-center gap-2">
              {isOwnerOrAdmin && (
                <button
                  onClick={() =>
                    onOpenSmartTechConfig(
                      currentFarm.hasSmartFarm ?? true,
                      currentFarm.smartTechnologies && currentFarm.smartTechnologies.length > 0
                        ? currentFarm.smartTechnologies
                        : defaultSmartTech.map((t) => ({ ...t, active: true }))
                    )
                  }
                  className="p-1.5 bg-surface-2 hover:bg-[#1f4e34] text-gold-soft rounded-xl border border-[#225739] transition-colors cursor-pointer text-xs flex items-center gap-1"
                  title="ตั้งค่า SmartFarm"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ตั้งค่า</span>
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#153e28] text-leaf border border-[#225739] shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-leaf animate-pulse" />
                ใช้งานจริง
              </span>
            </div>
          </div>

          {/* Technologies List */}
          <div className="divide-y divide-line relative z-10">
            {activeSmartTech.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-3 first:pt-2 last:pb-1"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <span className="text-xl sm:text-2xl w-8 text-center shrink-0">
                    {item.iconEmoji}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-white truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] sm:text-xs text-fg-2 font-medium mt-0.5 truncate">
                      {item.subtext}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pl-2">
                  <span className="block w-2.5 h-2.5 rounded-full bg-leaf shadow-[0_0_8px_rgba(74,222,128,0.8)] ring-2 ring-emerald-500/30" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Traditional Farming Banner (When SmartFarm is disabled or not present) */
        <div className="p-4 rounded-2xl bg-[#122b1c] border border-line flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">🌱</span>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white">
                วิถีเกษตรประณีตและธรรมชาติ (Traditional Sustainable Practice)
              </div>
              <p className="text-[11px] text-fg-2 truncate">
                ดูแลด้วยภูมิปัญญาชาวสวนทุเรียนดั้งเดิมและปุ๋ยอินทรีย์บำรุงดินธรรมชาติ
              </p>
            </div>
          </div>

          {isOwnerOrAdmin && (
            <button
              onClick={() =>
                onOpenSmartTechConfig(
                  false,
                  defaultSmartTech.map((t) => ({ ...t, active: true }))
                )
              }
              className="shrink-0 ml-2 px-3 py-1.5 bg-surface-2 hover:bg-[#1f4e34] text-gold text-xs font-bold rounded-xl border border-[#225739] transition-colors cursor-pointer"
            >
              ⚙️ เพิ่มระบบ SmartFarm
            </button>
          )}
        </div>
      )}
    </div>
  </div>
  );
};
