import React from 'react';
import { ImageIcon, Upload, Trash2, Check, Cpu, Sparkles, Share2, Facebook, Instagram } from 'lucide-react';
import { AVAILABLE_SMART_TECH } from '../constants/farmRegistrationOptions';

// Authentic High-Quality Durian Garden / Orchard Photos
const SAMPLE_GARDEN_PHOTOS = [
  {
    url: 'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80',
    title: 'ต้นทุเรียนและผลดกสมบูรณ์',
  },
  {
    url: 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=800&auto=format&fit=crop&q=80',
    title: 'ทิวทัศน์สวนทุเรียนร่มรื่น',
  },
  {
    url: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800&auto=format&fit=crop&q=80',
    title: 'แปลงปลูกทุเรียนเนินเขา',
  },
  {
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    title: 'ต้นทุเรียนใบเขียวสมบูรณ์',
  },
  {
    url: 'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=800&auto=format&fit=crop&q=80',
    title: 'ความเขียวชอุ่มยามเช้าในสวน',
  },
];

interface FarmRegistrationStep4Props {
  atmospherePhotos: string[];
  /**
   * รับ setter ของ React ตรง ๆ ไม่ใช่ callback ธรรมดา
   * เพราะโค้ดเดิมเรียกแบบส่งฟังก์ชันเข้าไป เช่น prev => [...prev, url]
   * ซึ่งจำเป็นตอนเพิ่มรูปหลายใบติดกัน ถ้าเปลี่ยนเป็นรับค่าสำเร็จรูป
   * การเพิ่มรูปพร้อมกันหลายใบจะอ่านค่าเก่าแล้วเขียนทับกันเอง
   */
  onAtmospherePhotosChange: React.Dispatch<React.SetStateAction<string[]>>;
  /** input ไฟล์ของขั้นนี้ ถือไว้ที่ hook เพราะ handler อัปโหลดอยู่ที่นั่น */
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  onPhotoFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;

  hasSmartFarm: boolean;
  onHasSmartFarmChange: (value: boolean) => void;
  selectedTechIds: string[];
  onSelectedTechIdsChange: React.Dispatch<React.SetStateAction<string[]>>;
  onToggleTech: (id: string) => void;

  aboutStory: string;
  onAboutStoryChange: (value: string) => void;
  facebook: string;
  onFacebookChange: (value: string) => void;
  instagram: string;
  onInstagramChange: (value: string) => void;
}

/**
 * ขั้นที่ 4 ของฟอร์มขึ้นทะเบียนสวน
 *
 * รวมสี่เรื่องไว้ในขั้นเดียวตามของเดิม คือรูปบรรยากาศสวน
 * เทคโนโลยี SmartFarm เรื่องราวของสวน และช่องทางโซเชียล
 * ไม่แตกย่อยเป็นสี่ไฟล์ เพราะสี่ส่วนนี้ไม่ได้ใช้ตรรกะร่วมกันเลย
 * แยกไปก็เพิ่มการส่ง prop ต่อกันเป็นทอด ๆ โดยไม่ได้ลดความซับซ้อนจริง
 *
 * ไม่มีสถานะของตัวเอง ค่าทั้งหมดมาจาก useFarmRegistrationForm ที่หน้าแม่
 *
 * ระวังเรื่องหมายเลขขั้น คอมเมนต์เดิมในไฟล์ต้นทางเรียกส่วนนี้ว่าขั้นที่ 5
 * แต่ที่ render จริงคือ step === 4
 */
export const FarmRegistrationStep4: React.FC<FarmRegistrationStep4Props> = ({
  atmospherePhotos,
  onAtmospherePhotosChange,
  photoInputRef,
  onPhotoFileUpload,
  hasSmartFarm,
  onHasSmartFarmChange,
  selectedTechIds,
  onSelectedTechIdsChange,
  onToggleTech,
  aboutStory,
  onAboutStoryChange,
  facebook,
  onFacebookChange,
  instagram,
  onInstagramChange,
}) => (
    <div className="space-y-4 animate-in fade-in">
      {/* Section 1: Atmosphere Photos */}
      <div className="p-3.5 bg-well rounded-2xl border border-line space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-white flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-leaf" />
            <span>ภาพถ่ายบรรยากาศสวนทุเรียน ({atmospherePhotos.length} รูป)</span>
          </label>
          <span className="text-[10px] text-fg-2">JPG / PNG (บีบอัดอัตโนมัติ)</span>
        </div>
        <p className="text-[11px] text-fg-2">
          อัปโหลดภาพแปลงทุเรียน ต้นทุเรียน ผลผลิต หรือสภาพแวดล้อมเพื่อสร้างความเชื่อมั่นแก่ผู้บริโภค
        </p>

        {/* Hidden file input */}
        <input
          type="file"
          ref={photoInputRef}
          multiple
          accept="image/*"
          onChange={onPhotoFileUpload}
          className="hidden"
        />

        {/* Upload button and Drop Area */}
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="w-full py-4 border-2 border-dashed border-[#235b3a] hover:border-leaf bg-canvas rounded-xl flex flex-col items-center justify-center gap-1.5 text-xs text-fg-2 hover:text-white transition-all cursor-pointer"
        >
          <Upload className="w-5 h-5 text-leaf" />
          <span className="font-bold text-white">คลิกเพื่ออัปโหลดภาพถ่ายบรรยากาศสวนของคุณ</span>
          <span className="text-[10px] text-[#527861]">สามารถเลือกได้หลายรูป ระบบจะปรับขนาดภาพให้อัตโนมัติ</span>
        </button>

        {/* Uploaded Photos Grid */}
        {atmospherePhotos.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-bold text-fg-2 flex items-center justify-between">
              <span>รูปภาพที่เลือกไว้ ({atmospherePhotos.length} รูป):</span>
              <button
                type="button"
                onClick={() => onAtmospherePhotosChange([])}
                className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                ลบทั้งหมด
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {atmospherePhotos.map((photoUrl, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-xl overflow-hidden border border-[#235b3a] aspect-video bg-black/40"
                >
                  <img
                    src={photoUrl}
                    alt={`Farm atmosphere ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onAtmospherePhotosChange((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-lg opacity-90 group-hover:opacity-100 transition-all cursor-pointer"
                    title="ลบรูปนี้"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Pick from High-Quality Samples */}
        <div className="pt-2 border-t border-line/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-gold-soft flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>หรือเลือกจากรูปภาพสวนตัวอย่างมาตรฐาน:</span>
            </span>
            <span className="text-[10px] text-[#527861]">คลิกเพื่อเพิ่ม</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SAMPLE_GARDEN_PHOTOS.map((sample, sIdx) => {
              const isAlreadyAdded = atmospherePhotos.includes(sample.url);
              return (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => {
                    if (isAlreadyAdded) {
                      onAtmospherePhotosChange((prev) =>
                        prev.filter((p) => p !== sample.url)
                      );
                    } else {
                      onAtmospherePhotosChange((prev) => [...prev, sample.url]);
                    }
                  }}
                  className={`relative rounded-lg overflow-hidden border aspect-video cursor-pointer transition-all ${
                    isAlreadyAdded
                      ? 'border-leaf ring-2 ring-leaf/50'
                      : 'border-line opacity-75 hover:opacity-100'
                  }`}
                  title={sample.title}
                >
                  <img
                    src={sample.url}
                    alt={sample.title}
                    className="w-full h-full object-cover"
                  />
                  {isAlreadyAdded && (
                    <div className="absolute inset-0 bg-leaf/30 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white drop-shadow-xs" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 2: Smart Farm & Precision Agriculture */}
      <div className="p-3.5 bg-well rounded-2xl border border-line space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-surface-2 text-leaf flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                เทคโนโลยีแปลงปลูกอัจฉริยะ (Smart Farm / IoT)
              </h4>
              <p className="text-[10px] text-fg-2">
                แสดงตราสัญลักษณ์นวัตกรรมและเทคโนโลยีที่ใช้ในสวน
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={hasSmartFarm}
              onChange={(e) => {
                onHasSmartFarmChange(e.target.checked);
                if (e.target.checked && selectedTechIds.length === 0) {
                  onSelectedTechIdsChange(['st-d1', 'st-d2']);
                }
              }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-line peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-leaf"></div>
          </label>
        </div>

        {hasSmartFarm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in">
            {AVAILABLE_SMART_TECH.map((tech) => {
              const isSelected = selectedTechIds.includes(tech.id);
              return (
                <button
                  key={tech.id}
                  type="button"
                  onClick={() => onToggleTech(tech.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0f2e1e] border-leaf text-white shadow-xs'
                      : 'bg-panel border-line text-fg-2 hover:border-[#2a613f]'
                  }`}
                >
                  <span className="text-base shrink-0">{tech.iconEmoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span className="truncate">{tech.name}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-leaf shrink-0 ml-1" />
                      )}
                    </div>
                    <p className="text-[10px] text-fg-2 line-clamp-1">
                      {tech.subtext}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Farm Heritage & Story */}
      <div className="p-3.5 bg-well rounded-2xl border border-line space-y-2">
        <label className="block text-xs font-bold text-white flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          <span>เรื่องราวและความเป็นมาของสวน (Farm Story / Heritage)</span>
        </label>
        <textarea
          rows={3}
          placeholder="เล่าเรื่องราว ความพิถีพิถันในการดูแลต้นทุเรียน การปลูกแบบ Net Zero หรือประวัติความเป็นมาของสวน..."
          value={aboutStory}
          onChange={(e) => onAboutStoryChange(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-panel border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs resize-none"
        />
      </div>

      {/* Section 4: Additional Social Media Links */}
      <div className="p-3.5 bg-well rounded-2xl border border-line space-y-3">
        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5 text-leaf" />
          <span>ช่องทางโซเชียลมีเดียเพิ่มเติมของสวน</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-fg-2 mb-1 font-semibold flex items-center gap-1">
              <Facebook className="w-3 h-3 text-[#1877F2]" />
              <span>Facebook Page / Profile</span>
            </label>
            <input
              type="text"
              placeholder="เช่น สวนทุเรียนจันทบูรณ์ หรือ ลิงก์แฟนเพจ"
              value={facebook}
              onChange={(e) => onFacebookChange(e.target.value)}
              className="w-full px-3 py-2 bg-panel border border-line rounded-xl text-white text-xs focus:outline-hidden focus:border-leaf"
            />
          </div>
          <div>
            <label className="block text-[11px] text-fg-2 mb-1 font-semibold flex items-center gap-1">
              <Instagram className="w-3 h-3 text-[#E4405F]" />
              <span>Instagram (ถ้ามี)</span>
            </label>
            <input
              type="text"
              placeholder="เช่น @durian_chanthaburi"
              value={instagram}
              onChange={(e) => onInstagramChange(e.target.value)}
              className="w-full px-3 py-2 bg-panel border border-line rounded-xl text-white text-xs focus:outline-hidden focus:border-leaf"
            />
          </div>
        </div>
      </div>
    </div>
);
