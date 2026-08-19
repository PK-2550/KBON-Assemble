import React, { useState } from 'react';
import { X, Sprout, Plus } from 'lucide-react';
import { DurianFarm } from '../types';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">เพิ่มฟาร์มทุเรียนใหม่</h2>
            <p className="text-xs text-slate-500">บันทึกข้อมูลฟาร์มเข้าสู่ระบบ DuriTrack</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ชื่อฟาร์ม / สวนทุเรียน <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น สวนทุเรียนหมอนทองเมืองจันท์"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                จังหวัด
              </label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
              >
                <option value="จันทบุรี">จันทบุรี</option>
                <option value="ระยอง">ระยอง</option>
                <option value="ตราด">ตราด</option>
                <option value="ศรีสะเกษ">ศรีสะเกษ</option>
                <option value="นนทบุรี">นนทบุรี</option>
                <option value="ชุมพร">ชุมพร</option>
                <option value="สุราษฎร์ธานี">สุราษฎร์ธานี</option>
                <option value="ยะลา">ยะลา</option>
                <option value="อุตรดิตถ์">อุตรดิตถ์</option>
                <option value="ปราจีนบุรี">ปราจีนบุรี</option>
                <option value="กาญจนบุรี">กาญจนบุรี</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                คะแนนรีวิวเริ่มต้น (1-10)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={rating}
                onChange={(e) => setRating(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                จำนวนต้นทุเรียน (ต้น)
              </label>
              <input
                type="number"
                min="0"
                value={totalTrees}
                onChange={(e) => setTotalTrees(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ผลผลิตที่เก็บเกี่ยว (ลูก/ปี)
              </label>
              <input
                type="number"
                min="0"
                value={harvestedFruits}
                onChange={(e) => setHarvestedFruits(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              สายพันธุ์เด่น (คั่นด้วยจุลภาค)
            </label>
            <input
              type="text"
              placeholder="เช่น หมอนทอง, ชะนี, ก้านยาว"
              value={topVarietiesInput}
              onChange={(e) => setTopVarietiesInput(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              จุดเด่น / คำอธิบายฟาร์ม
            </label>
            <textarea
              rows={2}
              placeholder="เช่น ทุเรียนดินภูเขาไฟ หวานมันกรอบนอกนุ่มใน"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 resize-none text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md shadow-emerald-200 flex items-center gap-1"
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
