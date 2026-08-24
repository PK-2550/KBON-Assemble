import React, { useState } from 'react';
import { X, Sprout, Plus } from 'lucide-react';
import { DurianFarm } from '../types';
import { THAILAND_REGIONS, getDistrictsByProvince } from '../constants/provinces';

interface AddFarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFarm: (newFarm: DurianFarm) => void;
  existingCount: number;
}

export const AddFarmModal: React.FC<AddFarmModalProps> = ({
  isOpen,
  onClose,
  onAddFarm,
  existingCount,
}) => {
  const [name, setName] = useState('');
  const [province, setProvince] = useState('จันทบุรี');
  const [district, setDistrict] = useState('เมืองจันทบุรี');
  const [totalTrees, setTotalTrees] = useState<number>(500);
  const [harvestedFruits, setHarvestedFruits] = useState<number>(12000);
  const [rating, setRating] = useState<number>(9.0);
  const [topVarietiesInput, setTopVarietiesInput] = useState('หมอนทอง, ก้านยาว');
  const [highlight, setHighlight] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const varieties = topVarietiesInput
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const newFarm: DurianFarm = {
      id: `farm-${Date.now()}`,
      rank: existingCount + 1,
      name: name.trim(),
      province: province.trim(),
      district: district.trim(),
      varietiesCount: Math.max(varieties.length, 1),
      topVarieties: varieties.length > 0 ? varieties : ['หมอนทอง'],
      totalTrees: Number(totalTrees) || 0,
      harvestedFruits: Number(harvestedFruits) || 0,
      rating: Number(rating) || 8.5,
      reviewCount: 1,
      highlight: highlight.trim() || 'สวนทุเรียนคุณภาพใส่ใจทุกขั้นตอนการเพาะปลูก',
      logoBgColor: '#065f46',
      logoTextColor: '#6ee7b7',
      certifications: ['GAP'],
    };

    onAddFarm(newFarm);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#092215] text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#18422b] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#8DA796] hover:text-white hover:bg-[#0e311f] rounded-full transition-colors border border-[#18422b]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-[#0e311f] text-[#E5A93C] border border-[#1e5236] flex items-center justify-center font-bold">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">เพิ่มฟาร์มทุเรียนใหม่</h2>
            <p className="text-xs text-[#8DA796]">บันทึกข้อมูลฟาร์มเข้าสู่ระบบ DuriTrack</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-[#8DA796] mb-1">
              ชื่อฟาร์ม / สวนทุเรียน <span className="text-[#E5A93C]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น สวนทุเรียนหมอนทองเมืองจันท์"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#04140b] border border-[#18422b] rounded-xl text-white placeholder-[#5d7c67] focus:outline-hidden focus:border-[#E5A93C]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#8DA796] mb-1">
                จังหวัด
              </label>
              <select
                value={province}
                onChange={(e) => {
                  const newProv = e.target.value;
                  setProvince(newProv);
                  const available = getDistrictsByProvince(newProv);
                  if (available.length > 0 && !available.includes(district)) {
                    setDistrict(available[0]);
                  }
                }}
                className="w-full px-3 py-2 bg-[#04140b] border border-[#18422b] rounded-xl focus:outline-hidden focus:border-[#E5A93C] text-white text-xs"
              >
                {THAILAND_REGIONS.map((group) => (
                  <optgroup key={group.region} label={`── ${group.region} ──`} className="bg-[#0e2619] text-[#F5D280] font-bold">
                    {group.provinces.map((prov) => (
                      <option key={prov} value={prov} className="bg-[#04140b] text-white font-normal">
                        {prov}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8DA796] mb-1">
                อำเภอ / เขต
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 bg-[#04140b] border border-[#18422b] rounded-xl focus:outline-hidden focus:border-[#E5A93C] text-white text-xs"
              >
                {getDistrictsByProvince(province).map((dist) => (
                  <option key={dist} value={dist} className="bg-[#04140b] text-white">
                    {dist}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#8DA796] mb-1">
                คะแนนรีวิว (1-10)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={rating}
                onChange={(e) => setRating(parseFloat(e.target.value))}
                className="w-full px-2.5 py-2 bg-[#04140b] border border-[#18422b] rounded-xl text-white focus:outline-hidden focus:border-[#E5A93C] text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8DA796] mb-1">
                ต้นทุเรียน (ต้น)
              </label>
              <input
                type="number"
                min="0"
                value={totalTrees}
                onChange={(e) => setTotalTrees(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-2 bg-[#04140b] border border-[#18422b] rounded-xl text-white focus:outline-hidden focus:border-[#E5A93C] text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8DA796] mb-1">
                ผลผลิต (ลูก/ปี)
              </label>
              <input
                type="number"
                min="0"
                value={harvestedFruits}
                onChange={(e) => setHarvestedFruits(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-2 bg-[#04140b] border border-[#18422b] rounded-xl text-white focus:outline-hidden focus:border-[#E5A93C] text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8DA796] mb-1">
              สายพันธุ์เด่น (คั่นด้วยจุลภาค)
            </label>
            <input
              type="text"
              placeholder="เช่น หมอนทอง, ชะนี, ก้านยาว"
              value={topVarietiesInput}
              onChange={(e) => setTopVarietiesInput(e.target.value)}
              className="w-full px-3 py-2 bg-[#04140b] border border-[#18422b] rounded-xl text-white placeholder-[#5d7c67] focus:outline-hidden focus:border-[#E5A93C]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8DA796] mb-1">
              จุดเด่น / คำอธิบายฟาร์ม
            </label>
            <textarea
              rows={2}
              placeholder="เช่น ทุเรียนดินภูเขาไฟ หวานมันกรอบนอกนุ่มใน"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              className="w-full px-3 py-2 bg-[#04140b] border border-[#18422b] rounded-xl focus:outline-hidden focus:border-[#E5A93C] resize-none text-xs text-white placeholder-[#5d7c67]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#18422b]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#8DA796] hover:text-white hover:bg-[#0e311f] rounded-xl"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-[#241603] bg-[#E5A93C] hover:bg-[#d4992e] rounded-xl shadow-md flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              บันทึกฟาร์ม
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
