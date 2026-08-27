import React, { useMemo } from 'react';
import { Search, Star } from 'lucide-react';
import { IndividualTree } from '../types';

export type TreeFilter = 'all' | 'auto' | 'photo' | 'companion';
export type TreeSort = 'rating' | 'az' | 'yield' | 'diaries' | 'code';

interface FarmTreesTabProps {
  /** ต้นไม้ทั้งหมดของฟาร์มนี้ ยังไม่ผ่านการกรอง */
  trees: IndividualTree[];
  onSelectTree: (tree: IndividualTree) => void;

  /**
   * ตัวกรอง คำค้น และลำดับการเรียง อยู่ที่หน้าแม่ ไม่ได้เก็บในนี้
   *
   * เพราะการกดเข้าดูต้นใดต้นหนึ่ง ทำให้หน้าแม่ return หน้ารายละเอียดต้นไม้ออกมาแทน
   * คอมโพเนนต์นี้จึงถูก unmount ถ้าเก็บ state ไว้ในนี้ ค่าจะหายหมด
   * พอกดย้อนกลับจะเด้งกลับไปค่าตั้งต้น ซึ่งต่างจากพฤติกรรมเดิมก่อนแยกไฟล์
   */
  filter: TreeFilter;
  onFilterChange: (filter: TreeFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  sort: TreeSort;
  onSortChange: (sort: TreeSort) => void;
}

/**
 * แท็บรายชื่อต้นไม้รายต้น พร้อมตัวกรอง ค้นหา และเรียงลำดับ
 *
 * ตัวกรอง คำค้น และลำดับการเรียง เป็นสถานะของแท็บนี้ล้วน
 * ไม่มีส่วนอื่นของหน้าฟาร์มอ่านค่าเหล่านี้ จึงเก็บไว้ในนี้ได้
 *
 * ส่วนการเลือกต้นเพื่อเปิดหน้ารายละเอียด ส่งกลับขึ้นไปให้หน้าแม่จัดการ
 * เพราะการเปิดหน้ารายละเอียดแทนที่ทั้งหน้าฟาร์ม ไม่ใช่แค่แท็บนี้
 */
export const FarmTreesTab: React.FC<FarmTreesTabProps> = ({
  trees,
  onSelectTree,
  filter: selectedFilter,
  onFilterChange: setSelectedFilter,
  search: treeSearch,
  onSearchChange: setTreeSearch,
  sort: sortBy,
  onSortChange: setSortBy,
}) => {

  const filteredAndSortedTrees = useMemo(() => {
    let list = [...trees];

    if (selectedFilter === 'auto') {
      list = list.filter((t) => t.propagationCode === 'AUTO' || t.category === 'durian_main');
    } else if (selectedFilter === 'photo') {
      list = list.filter((t) => t.propagationCode === 'PHOTO' || t.category === 'durian_rare');
    } else if (selectedFilter === 'companion') {
      list = list.filter((t) => t.category === 'companion_fruit');
    }

    if (treeSearch.trim()) {
      const q = treeSearch.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.code.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.variety.toLowerCase().includes(q) ||
          t.zone.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'rating') {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.diariesCount - a.diariesCount;
      }
      if (sortBy === 'az') {
        return a.name.localeCompare(b.name, 'th');
      }
      if (sortBy === 'yield') {
        return b.yieldFruitCount - a.yieldFruitCount;
      }
      if (sortBy === 'diaries') {
        return b.diariesCount - a.diariesCount;
      }
      if (sortBy === 'code') {
        return a.code.localeCompare(b.code);
      }
      return 0;
    });

    return list;
  }, [trees, selectedFilter, treeSearch, sortBy]);

  // นับแยกตามกลุ่มไว้โชว์บนปุ่มกรอง คิดจากรายการเต็มเสมอ ไม่ใช่รายการที่กรองแล้ว
  const { autoCount, photoCount, companionCount } = useMemo(
    () => ({
      autoCount: trees.filter((t) => t.propagationCode === 'AUTO' || t.category === 'durian_main').length,
      photoCount: trees.filter((t) => t.propagationCode === 'PHOTO' || t.category === 'durian_rare').length,
      companionCount: trees.filter((t) => t.category === 'companion_fruit').length,
    }),
    [trees]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 w-full">
        <div className="flex flex-wrap items-center gap-1.5 w-full text-xs font-semibold">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer text-xs ${
              selectedFilter === 'all'
                ? 'bg-gold text-gold-ink shadow-md'
                : 'bg-surface border border-line text-fg-2 hover:text-white'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="text-[11px] opacity-90 font-mono font-bold">({trees.length})</span>
          </button>

          <button
            onClick={() => setSelectedFilter('auto')}
            className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer text-xs ${
              selectedFilter === 'auto'
                ? 'bg-gold text-gold-ink shadow-md'
                : 'bg-surface border border-line text-fg-2 hover:text-white'
            }`}
          >
            <span>สายพันธุ์หลัก</span>
            <span className="text-[11px] opacity-90 font-mono font-bold">({autoCount})</span>
          </button>

          <button
            onClick={() => setSelectedFilter('photo')}
            className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer text-xs ${
              selectedFilter === 'photo'
                ? 'bg-gold text-gold-ink shadow-md'
                : 'bg-surface border border-line text-fg-2 hover:text-white'
            }`}
          >
            <span>สายพันธุ์พิเศษ</span>
            <span className="text-[11px] opacity-90 font-mono font-bold">({photoCount})</span>
          </button>

          {companionCount > 0 && (
            <button
              onClick={() => setSelectedFilter('companion')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer text-xs ${
                selectedFilter === 'companion'
                  ? 'bg-gold text-gold-ink shadow-md'
                  : 'bg-surface border border-line text-fg-2 hover:text-white'
              }`}
            >
              <span>ไม้ผลร่วม</span>
              <span className="text-[11px] opacity-90 font-mono font-bold">({companionCount})</span>
            </button>
          )}
        </div>

        {/* Search and Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gold" />
            <input
              type="text"
              placeholder="ค้นหารหัสต้น / ชื่อต้น..."
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface border border-line rounded-xl text-xs text-white placeholder-[#688d77] focus:outline-hidden focus:border-gold shadow-inner"
            />
          </div>

          <div className="relative w-full">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as TreeSort)}
              className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-xs font-bold text-gold-soft focus:outline-hidden cursor-pointer shadow-inner"
            >
              <option value="rating" className="bg-surface text-white">คะแนนรีวิวสูงสุด ⭐</option>
              <option value="az" className="bg-surface text-white">ชื่อต้น (ก-ฮ) 🌳</option>
              <option value="code" className="bg-surface text-white">รหัสต้น (Tree Code) 🏷️</option>
              <option value="yield" className="bg-surface text-white">ผลผลิตต่อต้น 📈</option>
              <option value="diaries" className="bg-surface text-white">ประวัติการดูแล 📖</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tree List */}
      <div className="bg-surface rounded-3xl border border-line shadow-2xl overflow-hidden divide-y divide-line">
        {filteredAndSortedTrees.length === 0 ? (
          <div className="p-10 text-center text-fg-2 text-xs">
            ไม่พบรายชื่อต้นไม้ตามเงื่อนไขที่ค้นหา
          </div>
        ) : (
          /* แถวต้นไม้แบบตาราง เทียบเท่าตาราง Strains ของต้นแบบ
             เอารูปภาพประกอบขนาด 48px ออก เพราะเป็นรูปทุเรียนรูปเดียวกันทุกต้น
             จึงไม่ได้แยกแยะอะไร มีแต่กินพื้นที่และทำให้ไล่สายตาตามคอลัมน์ยาก */
          filteredAndSortedTrees.map((tree) => (
            <div
              key={tree.id}
              onClick={() => onSelectTree(tree)}
              className="group flex items-center gap-3 py-2.5 px-3 sm:px-4 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              {/* รหัสต้น -- ตัวยึดสายตาหลัก เป็นรหัสเดียวกับที่พิมพ์บนแท็ก NFC */}
              <span className="font-mono text-xs font-bold text-fg-3 shrink-0 w-[74px] sm:w-[86px]">
                {tree.code}
              </span>

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs sm:text-sm text-fg truncate group-hover:text-gold-soft transition-colors">
                  {tree.name}
                </div>
                <div className="text-[11px] text-fg-2 truncate mt-0.5">
                  {tree.variety}
                  <span className="hidden sm:inline"> · อายุ {tree.ageYears} ปี</span>
                </div>
              </div>

              {/* ผลผลิตต่อต้น */}
              <span className="hidden sm:block shrink-0 w-16 text-right text-xs text-fg-2 tabular-nums">
                {tree.yieldFruitCount} ลูก
              </span>

              {/* คะแนนรีวิว */}
              <span className="shrink-0 w-14 sm:w-16 flex items-center justify-end gap-1">
                <Star className="w-3 h-3 text-gold fill-gold" />
                <span className="font-bold text-xs text-fg tabular-nums">
                  {tree.rating.toFixed(1)}
                </span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
