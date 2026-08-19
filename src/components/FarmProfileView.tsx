import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Star,
  Trees,
  Sprout,
  MapPin,
  Globe,
  Phone,
  MessageCircle,
  Award,
  CheckCircle2,
  Share2,
  Heart,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Search,
  Cpu,
  Droplets,
  Radio,
  Sparkles,
  Layers,
  Calendar,
} from 'lucide-react';
import { DurianFarm, IndividualTree, FruitTreeVariety, UserRole } from '../types';
import { TreeDetailModal } from './TreeDetailModal';

interface FarmProfileViewProps {
  farm: DurianFarm;
  currentRole?: UserRole;
  onBack: () => void;
  onSelectVariety?: (variety: FruitTreeVariety) => void;
}

export const FarmProfileView: React.FC<FarmProfileViewProps> = ({
  farm,
  currentRole = 'user',
  onBack,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'auto' | 'photo' | 'companion'>('all');
  const [treeSearch, setTreeSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'az' | 'yield' | 'diaries' | 'code'>('rating');
  const [activeTab, setActiveTab] = useState<'trees' | 'smartfarm' | 'certs' | 'about'>('trees');
  const [selectedTree, setSelectedTree] = useState<IndividualTree | null>(null);

  const photos = farm.photos && farm.photos.length > 0 ? farm.photos : [
    'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1592417817098-8f3d6910985b?w=800&auto=format&fit=crop&q=80',
  ];

  const allTrees: IndividualTree[] = farm.individualTrees || [];

  // Filter & Sort individual trees
  const filteredAndSortedTrees = useMemo(() => {
    let list = [...allTrees];

    // Filter by tab / classification
    if (selectedFilter === 'auto') {
      list = list.filter((t) => t.propagationCode === 'AUTO' || t.category === 'durian_main');
    } else if (selectedFilter === 'photo') {
      list = list.filter((t) => t.propagationCode === 'PHOTO' || t.category === 'durian_rare');
    } else if (selectedFilter === 'companion') {
      list = list.filter((t) => t.category === 'companion_fruit');
    }

    // Filter by search query (Code or Name)
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

    // Sort
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
  }, [allTrees, selectedFilter, treeSearch, sortBy]);

  // Counts for pills
  const autoCount = allTrees.filter((t) => t.propagationCode === 'AUTO' || t.category === 'durian_main').length;
  const photoCount = allTrees.filter((t) => t.propagationCode === 'PHOTO' || t.category === 'durian_rare').length;
  const companionCount = allTrees.filter((t) => t.category === 'companion_fruit').length;

  // Farm initials for logo (e.g. TC or ภข)
  const farmInitials = (farm?.name || 'TC')
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase() || 'TC';

  // SmartFarm technology list per farm with realistic fallback
  const smartTechList = farm.smartTechnologies && farm.smartTechnologies.length > 0
    ? farm.smartTechnologies
    : [
        { id: 'st-d1', name: 'ระบบน้ำหยดอัตโนมัติ', subtext: 'ควบคุมผ่านแอปฯ', iconEmoji: '💧', active: true },
        { id: 'st-d2', name: 'เซ็นเซอร์วัดความชื้นดิน', subtext: 'ทุก 15 นาที', iconEmoji: '🌡️', active: true },
        { id: 'st-d3', name: 'โดรนพ่นปุ๋ย / สำรวจ', subtext: 'ลดการใช้สารเคมี 40%', iconEmoji: '🚁', active: true },
        { id: 'st-d4', name: 'Dashboard ติดตามสวน', subtext: 'Real-time บน SmartFarm App', iconEmoji: '📊', active: true },
        { id: 'st-d5', name: 'พลังงานแสงอาทิตย์', subtext: 'ลดต้นทุนพลังงาน 60%', iconEmoji: '☀️', active: true },
      ];

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Mobile-First Hero & Details Container matching user's uploaded layout */}
      <div className="bg-[#0e2619] text-[#f3f6f4] rounded-3xl overflow-hidden shadow-xl border border-[#1c442c]">
        {/* Top Hero Photo Gallery */}
        <div className="relative aspect-4/3 sm:aspect-16/9 bg-[#07190f] overflow-hidden">
          {/* Main Hero Image */}
          <img
            src={photos[activePhotoIndex]}
            alt={farm.name}
            className="w-full h-full object-cover transition-all duration-300"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e2619] via-transparent to-black/50 pointer-events-none" />

          {/* Top Bar: Back Button & Photo Counter Pill */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-xs font-bold text-[#F5D280] hover:text-white border border-[#E5A93C]/40 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#E5A93C]" />
              <span>กลับ</span>
            </button>

            <div className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[11px] font-bold text-white border border-white/10 font-mono tracking-wider">
              {activePhotoIndex + 1}/{photos.length}
            </div>
          </div>

          {/* Carousel Dot Indicators */}
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 z-10">
            {photos.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActivePhotoIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  activePhotoIndex === idx
                    ? 'w-6 bg-[#E5A93C]'
                    : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`รูปที่ ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Thumbnail Preview Strip */}
        <div className="px-4 pt-3 pb-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {photos.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActivePhotoIndex(idx)}
              className={`relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden transition-all duration-150 cursor-pointer ${
                activePhotoIndex === idx
                  ? 'ring-2 ring-[#E5A93C] ring-offset-2 ring-offset-[#0e2619] scale-102'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        {/* Farm Identity Header & Rating Card */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            {/* Left: Square Logo & Farm Name */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Square Logo Box in Gold/Emerald */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#143523] border border-[#225538] flex items-center justify-center text-[#E5A93C] font-black text-lg sm:text-xl shrink-0 shadow-inner font-serif">
                {farmInitials}
              </div>

              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  {farm.name}
                </h1>
                <div className="flex items-center gap-1 text-xs text-[#83A893] mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-[#E5A93C]" />
                  <span className="truncate">
                    {farm.district || 'อ.เมือง'} • {farm.province}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Rating Box */}
            <div className="shrink-0 bg-[#143523] border border-[#225538] rounded-2xl px-3.5 py-2 text-center shadow-xs">
              <div className="text-lg font-black text-[#E5A93C] tabular-nums leading-none">
                {farm.rating.toFixed(1)}
              </div>
              <div className="flex items-center justify-center gap-0.5 text-[#E5A93C] text-[10px] my-1">
                {'★'.repeat(5)}
              </div>
              <div className="text-[10px] text-[#83A893] font-medium">
                {farm.reviewCount || 7} รีวิว
              </div>
            </div>
          </div>

          {/* Social / Contact Action Buttons (Facebook, Instagram, LINE OA) */}
          <div className="grid grid-cols-3 gap-2 text-xs font-bold">
            {/* Facebook */}
            <a
              href={farm.contact?.facebook || 'https://facebook.com'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#0c2238] border border-blue-800/60 hover:bg-[#122e4d] text-blue-300 rounded-xl transition-all text-center"
            >
              <span className="font-extrabold">f</span>
              <span className="truncate">Facebook</span>
            </a>

            {/* Instagram */}
            <a
              href={farm.contact?.instagram ? `https://instagram.com/${farm.contact.instagram}` : 'https://instagram.com'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#261322] border border-pink-900/60 hover:bg-[#341a2e] text-pink-300 rounded-xl transition-all text-center"
            >
              <span>📷</span>
              <span className="truncate">Instagram</span>
            </a>

            {/* LINE OA */}
            <a
              href={farm.contact?.lineId ? `https://line.me/R/ti/p/${encodeURIComponent(farm.contact.lineId)}` : 'https://line.me'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-[#122b1c] border border-[#234d34] hover:bg-[#183a26] text-[#4ADE80] rounded-xl transition-all text-center"
            >
              <span>💬</span>
              <span className="truncate">LINE OA</span>
            </a>
          </div>

          {/* Key Stats Grid (2 Rows × 3 Columns matching uploaded screenshot) */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {/* Row 1, Col 1: ต้นทุเรียน */}
            <div className="bg-[#122b1c] border border-[#1c442c] rounded-2xl p-3 text-center flex flex-col items-center justify-center shadow-xs">
              <span className="text-base mb-1">🌳</span>
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {farm.totalTrees.toLocaleString()}
              </div>
              <div className="text-[11px] text-[#83A893] font-medium">ต้นทุเรียน</div>
            </div>

            {/* Row 1, Col 2: ไร่ */}
            <div className="bg-[#122b1c] border border-[#1c442c] rounded-2xl p-3 text-center flex flex-col items-center justify-center shadow-xs">
              <span className="text-base mb-1">📐</span>
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {farm.areaRai || 48}
              </div>
              <div className="text-[11px] text-[#83A893] font-medium">ไร่</div>
            </div>

            {/* Row 1, Col 3: สายพันธุ์ */}
            <div className="bg-[#122b1c] border border-[#1c442c] rounded-2xl p-3 text-center flex flex-col items-center justify-center shadow-xs">
              <span className="text-base mb-1">🔬</span>
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {farm.varietiesCount || farm.topVarieties?.length || 6}
              </div>
              <div className="text-[11px] text-[#83A893] font-medium">สายพันธุ์</div>
            </div>

            {/* Row 2, Col 1: เก็บ/ปี */}
            <div className="bg-[#122b1c] border border-[#1c442c] rounded-2xl p-3 text-center flex flex-col items-center justify-center shadow-xs">
              <span className="text-base mb-1">🪚</span>
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {farm.harvestRounds || 3}
              </div>
              <div className="text-[11px] text-[#83A893] font-medium">เก็บ/ปี</div>
            </div>

            {/* Row 2, Col 2: กก./ปี หรือผลผลิต */}
            <div className="bg-[#122b1c] border border-[#1c442c] rounded-2xl p-3 text-center flex flex-col items-center justify-center shadow-xs">
              <span className="text-base mb-1">⚖️</span>
              <div className="text-base sm:text-lg font-black text-white tabular-nums">
                {farm.harvestedFruits ? (farm.harvestedFruits * 3.5).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '2,840'}
              </div>
              <div className="text-[11px] text-[#83A893] font-medium">กก./ปี</div>
            </div>

            {/* Row 2, Col 3: คะแนนรีวิว */}
            <div className="bg-[#122b1c] border border-[#1c442c] rounded-2xl p-3 text-center flex flex-col items-center justify-center shadow-xs">
              <span className="text-base mb-1">⭐</span>
              <div className="text-base sm:text-lg font-black text-[#E5A93C] tabular-nums">
                {farm.rating.toFixed(1)}/5
              </div>
              <div className="text-[11px] text-[#83A893] font-medium">คะแนนรีวิว</div>
            </div>
          </div>

          {/* SmartFarm Innovation Card matching exact design from uploaded screenshot */}
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#122b1c] border border-[#1c442c] p-4 sm:p-5 shadow-lg">
            {/* Background Ambient Glow */}
            <div className="absolute top-0 right-0 w-64 h-32 bg-emerald-600/10 blur-3xl pointer-events-none" />

            {/* Top Header */}
            <div className="flex items-center justify-between mb-2 relative z-10">
              <div>
                <h3 className="font-serif font-black text-[#F5D280] text-base sm:text-lg tracking-wide leading-tight">
                  SmartFarm
                </h3>
                <p className="text-xs text-[#83A893] font-medium mt-0.5">เทคโนโลยีภายในฟาร์ม</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#153e28] text-[#4ADE80] border border-[#225739] shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                ใช้งานจริง
              </span>
            </div>

            {/* Technologies List */}
            <div className="divide-y divide-[#1c442c] relative z-10">
              {smartTechList.map((item) => (
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
                      <div className="text-[11px] sm:text-xs text-[#83A893] font-medium mt-0.5 truncate">
                        {item.subtext}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    <span className="block w-2.5 h-2.5 rounded-full bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.8)] ring-2 ring-emerald-500/30" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Clean 3-Column Responsive Grid without horizontal scrollbar */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full pt-1">
        <button
          onClick={() => setActiveTab('trees')}
          className={`py-2.5 px-1 sm:px-3 rounded-2xl transition-all font-bold text-center flex items-center justify-center gap-1 cursor-pointer text-xs sm:text-sm ${
            activeTab === 'trees'
              ? 'bg-[#E5A93C] text-[#1c1202] shadow-md font-extrabold'
              : 'bg-[#0e2619] text-[#83A893] hover:text-white hover:bg-[#143523] border border-[#1c442c]'
          }`}
        >
          <span>🌳</span>
          <span className="truncate">รายชื่อต้นไม้ ({allTrees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('certs')}
          className={`py-2.5 px-1 sm:px-3 rounded-2xl transition-all font-bold text-center flex items-center justify-center gap-1 cursor-pointer text-xs sm:text-sm ${
            activeTab === 'certs'
              ? 'bg-[#E5A93C] text-[#1c1202] shadow-md font-extrabold'
              : 'bg-[#0e2619] text-[#83A893] hover:text-white hover:bg-[#143523] border border-[#1c442c]'
          }`}
        >
          <span>📜</span>
          <span className="truncate">ใบรับรอง ({farm.certificationDetails?.length || farm.certifications?.length || 1})</span>
        </button>

        <button
          onClick={() => setActiveTab('about')}
          className={`py-2.5 px-1 sm:px-3 rounded-2xl transition-all font-bold text-center flex items-center justify-center gap-1 cursor-pointer text-xs sm:text-sm ${
            activeTab === 'about'
              ? 'bg-[#E5A93C] text-[#1c1202] shadow-md font-extrabold'
              : 'bg-[#0e2619] text-[#83A893] hover:text-white hover:bg-[#143523] border border-[#1c442c]'
          }`}
        >
          <span>📖</span>
          <span className="truncate">ประวัติฟาร์ม</span>
        </button>
      </div>

      {/* Tab: Individual Trees List */}
      {activeTab === 'trees' && (
        <div className="space-y-3">
          {/* Filter Pills and Search Bar without horizontal scrollbar */}
          <div className="flex flex-col gap-2.5 w-full">
            {/* Filter Pills with natural wrapping for mobile */}
            <div className="flex flex-wrap items-center gap-1.5 w-full text-xs font-semibold">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer text-xs ${
                  selectedFilter === 'all'
                    ? 'bg-[#E5A93C] text-[#1c1202] shadow-md'
                    : 'bg-[#0e2619] border border-[#1c442c] text-[#83A893] hover:text-white'
                }`}
              >
                <span>ทั้งหมด</span>
                <span className="text-[11px] opacity-90 font-mono font-bold">({allTrees.length})</span>
              </button>

              <button
                onClick={() => setSelectedFilter('auto')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer text-xs ${
                  selectedFilter === 'auto'
                    ? 'bg-[#E5A93C] text-[#1c1202] shadow-md'
                    : 'bg-[#0e2619] border border-[#1c442c] text-[#83A893] hover:text-white'
                }`}
              >
                <span>สายพันธุ์หลัก</span>
                <span className="text-[11px] opacity-90 font-mono font-bold">({autoCount})</span>
              </button>

              <button
                onClick={() => setSelectedFilter('photo')}
                className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer text-xs ${
                  selectedFilter === 'photo'
                    ? 'bg-[#E5A93C] text-[#1c1202] shadow-md'
                    : 'bg-[#0e2619] border border-[#1c442c] text-[#83A893] hover:text-white'
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
                      ? 'bg-[#E5A93C] text-[#1c1202] shadow-md'
                      : 'bg-[#0e2619] border border-[#1c442c] text-[#83A893] hover:text-white'
                  }`}
                >
                  <span>ไม้ผลร่วม</span>
                  <span className="text-[11px] opacity-90 font-mono font-bold">({companionCount})</span>
                </button>
              )}
            </div>

            {/* Quick Search and Sort Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#E5A93C]" />
                <input
                  type="text"
                  placeholder="ค้นหารหัสต้น / ชื่อต้น..."
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#0e2619] border border-[#1c442c] rounded-xl text-xs text-white placeholder-[#688d77] focus:outline-hidden focus:border-[#E5A93C] shadow-inner"
                />
              </div>

              <div className="relative w-full">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-[#0e2619] border border-[#1c442c] rounded-xl px-3 py-2 text-xs font-bold text-[#F5D280] focus:outline-hidden cursor-pointer shadow-inner"
                >
                  <option value="rating" className="bg-[#0e2619] text-white">คะแนนรีวิวสูงสุด ⭐</option>
                  <option value="az" className="bg-[#0e2619] text-white">ชื่อต้น (ก-ฮ) 🌳</option>
                  <option value="code" className="bg-[#0e2619] text-white">รหัสต้น (Tree Code) 🏷️</option>
                  <option value="yield" className="bg-[#0e2619] text-white">ผลผลิตต่อต้น 📈</option>
                  <option value="diaries" className="bg-[#0e2619] text-white">บันทึกดูแล (Diaries) 📖</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sequential Tree List Items */}
          <div className="bg-[#0e2619] rounded-3xl border border-[#1c442c] shadow-2xl overflow-hidden divide-y divide-[#1c442c]">
            {filteredAndSortedTrees.length === 0 ? (
              <div className="p-10 text-center text-[#83A893] text-xs">
                ไม่พบรายชื่อต้นไม้ตามเงื่อนไขที่ค้นหา
              </div>
            ) : (
              filteredAndSortedTrees.map((tree) => (
                <div
                  key={tree.id}
                  onClick={() => setSelectedTree(tree)}
                  className="group flex items-center justify-between p-3.5 sm:p-4 hover:bg-[#143523] transition-colors cursor-pointer"
                >
                  {/* Left: Thumbnail + Name + Code + Zone */}
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {/* Tree Photo Thumbnail */}
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#07190f] shrink-0 border border-[#1c442c]">
                      <img
                        src="https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=200&auto=format&fit=crop&q=80"
                        alt={tree.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-[#0e2619]/90 text-[8px] font-bold text-[#E5A93C] text-center py-0.2 uppercase border-t border-[#1c442c]">
                        {tree.propagationCode || 'AUTO'}
                      </div>
                    </div>

                    {/* Tree Details */}
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-white group-hover:text-[#E5A93C] truncate transition-colors">
                          {tree.name}
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-[#F5D280] bg-[#E5A93C]/20 px-1.5 py-0.2 rounded-sm border border-[#E5A93C]/40">
                          {tree.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[#83A893] mt-0.5">
                        <span className="text-[#c8dcd0] font-medium">{tree.variety}</span>
                        <span className="text-[#1c442c]">•</span>
                        <span>โซน: {tree.zone}</span>
                        <span className="text-[#1c442c]">•</span>
                        <span>อายุ {tree.ageYears} ปี</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Rating + Diaries Count */}
                  <div className="flex flex-col items-end shrink-0 text-right pl-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-[#E5A93C] fill-[#E5A93C]" />
                      <span className="font-extrabold text-xs sm:text-sm text-white tabular-nums">
                        {tree.rating.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-[#83A893]">/10</span>
                    </div>

                    <div className="text-[10px] text-[#83A893] mt-0.5 tabular-nums">
                      {tree.diariesCount} บันทึก • {tree.yieldFruitCount} ลูก
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Certifications */}
      {activeTab === 'certs' && (
        <div className="bg-[#0e2619] rounded-3xl border border-[#1c442c] p-5 shadow-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1c442c] pb-3">
            <ShieldCheck className="w-5 h-5 text-[#E5A93C]" />
            <h3 className="font-bold text-sm text-white">
              ใบรับรองมาตรฐานทางการเกษตร (GAP / GI)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {farm.certificationDetails && farm.certificationDetails.length > 0 ? (
              farm.certificationDetails.map((cert, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl border border-[#1c442c] bg-[#122b1c] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#E5A93C]">{cert.shortCode}</span>
                    <span className="text-[10px] font-bold bg-[#E5A93C]/20 text-[#F5D280] px-2 py-0.5 rounded-full border border-[#E5A93C]/40">
                      ตรวจสอบแล้ว
                    </span>
                  </div>
                  <div className="text-xs text-white font-semibold">{cert.nameTh}</div>
                  <div className="text-[11px] text-[#83A893] font-mono">
                    เลขที่: {cert.certNumber}
                  </div>
                  <div className="text-[10px] text-[#83A893]">
                    ออกโดย: {cert.issuedBy}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-2xl border border-[#1c442c] bg-[#122b1c] text-xs text-[#F5D280] font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
                <span>ได้รับการรับรองมาตรฐาน GAP กรมวิชาการเกษตร (ตรวจสอบแล้ว)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: About Farm Story */}
      {activeTab === 'about' && (
        <div className="bg-[#0e2619] rounded-3xl border border-[#1c442c] p-5 shadow-2xl space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <span>📖</span>
            <span>ประวัติความเป็นมาและเรื่องราวของฟาร์ม</span>
          </h3>
          <p className="text-xs text-[#83A893] leading-relaxed whitespace-pre-line">
            {farm.aboutStory || farm.highlight || 'ฟาร์มทุเรียนคุณภาพ มุ่งเน้นการผลิตทุเรียนคุณภาพสูงด้วยระบบเกษตรแม่นยำ พร้อมระบบติดตามตรวจสอบย้อนกลับด้วยเทคโนโลยี NFC'}
          </p>
        </div>
      )}

      {/* Tree Detail Modal when a tree is clicked */}
      {selectedTree && (
        <TreeDetailModal
          tree={selectedTree}
          farm={farm}
          currentRole={currentRole}
          onClose={() => setSelectedTree(null)}
        />
      )}
    </div>
  );
};
