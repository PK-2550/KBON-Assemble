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
  BookOpen,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import { DurianFarm, IndividualTree, FruitTreeVariety } from '../types';
import { FarmLogo } from './FarmLogo';
import { TreeDetailModal } from './TreeDetailModal';

interface FarmProfileViewProps {
  farm: DurianFarm;
  onBack: () => void;
  onSelectVariety?: (variety: FruitTreeVariety) => void;
}

export const FarmProfileView: React.FC<FarmProfileViewProps> = ({
  farm,
  onBack,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showFullStory, setShowFullStory] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'auto' | 'photo' | 'companion'>('all');
  const [treeSearch, setTreeSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'az' | 'yield' | 'diaries' | 'code'>('rating');
  const [activeTab, setActiveTab] = useState<'trees' | 'varieties' | 'certs' | 'gallery'>('trees');
  const [selectedTree, setSelectedTree] = useState<IndividualTree | null>(null);

  const photos = farm.photos && farm.photos.length > 0 ? farm.photos : [
    'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800&auto=format&fit=crop&q=80',
  ];

  const handleNextPhoto = () => {
    setActivePhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrevPhoto = () => {
    setActivePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const allTrees: IndividualTree[] = farm.individualTrees || [];

  // Filter & Sort individual trees matching the reference image
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

  // Split into left and right columns for the 2-column screenshot layout
  const leftColTrees = filteredAndSortedTrees.filter((_, i) => i % 2 === 0);
  const rightColTrees = filteredAndSortedTrees.filter((_, i) => i % 2 === 1);

  // Counts for pills
  const autoCount = allTrees.filter((t) => t.propagationCode === 'AUTO' || t.category === 'durian_main').length;
  const photoCount = allTrees.filter((t) => t.propagationCode === 'PHOTO' || t.category === 'durian_rare').length;
  const companionCount = allTrees.filter((t) => t.category === 'companion_fruit').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-emerald-700 transition-all shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับสู่หน้ารายชื่อฟาร์มทั้งหมด</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('คัดลอกลิงก์ฟาร์มเรียบร้อยแล้ว');
              }
            }}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs"
            title="แชร์ลิงก์ฟาร์ม"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Farm Hero Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Photo Gallery Card with 1/N badge */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-3/4 shadow-md group">
              <img
                src={photos[activePhotoIndex]}
                alt={farm.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 pointer-events-none" />

              {/* Photo Slider Controls */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={handlePrevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-xs transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-xs transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* 1 / N indicator pill */}
              <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-white tracking-wider">
                {activePhotoIndex + 1} / {photos.length}
              </div>

              {/* Overlay Farm Badge */}
              <div className="absolute bottom-3 left-3 text-white">
                <span className="text-[10px] font-bold bg-emerald-600/90 backdrop-blur-xs px-2 py-0.5 rounded-sm">
                  สวนทุเรียนมาตรฐาน GAP
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Farm Profile Header, Stats Strip, Bio, Social Contacts & Certs */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col justify-between space-y-4">
            {/* Top row: Logo + Farm Title + Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <FarmLogo
                  name={farm.name}
                  rank={farm.rank}
                  bgColor={farm.logoBgColor}
                  textColor={farm.logoTextColor}
                />
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    ฟาร์มและสวนทุเรียน (Breeder / Orchard)
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                    {farm.name}
                  </h1>
                  {farm.nameEn && (
                    <p className="text-xs text-slate-400 font-medium">{farm.nameEn}</p>
                  )}
                </div>
              </div>

              {/* Action Buttons (Buy Now, Message, Follow) */}
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                {farm.contact?.phoneNumber && (
                  <a
                    href={`tel:${farm.contact.phoneNumber}`}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-200/80 transition-all flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>ติดต่อสั่งซื้อ</span>
                  </a>
                )}
                {farm.contact?.lineId && (
                  <a
                    href={`https://line.me/R/ti/p/${encodeURIComponent(farm.contact.lineId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>แชท LINE</span>
                  </a>
                )}
                <button
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`px-4 py-2 border text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    isFollowing
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      isFollowing ? 'fill-emerald-600 text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{isFollowing ? 'กำลังติดตาม' : 'ติดตามฟาร์ม'}</span>
                </button>
              </div>
            </div>

            {/* Horizontal Stats Badges Strip */}
            <div className="flex items-center gap-4 sm:gap-6 py-3 border-y border-slate-100 overflow-x-auto text-xs">
              <div className="shrink-0">
                <div className="text-base font-bold text-slate-900">#{farm.rank}</div>
                <div className="text-[11px] text-slate-400">อันดับในประเทศ</div>
              </div>

              <div className="w-px h-8 bg-slate-200 shrink-0" />

              <div className="shrink-0">
                <div className="flex items-center gap-1 text-base font-bold text-slate-900">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>{farm.rating.toFixed(1)}</span>
                </div>
                <div className="text-[11px] text-slate-400">{farm.reviewCount} รีวิว</div>
              </div>

              <div className="w-px h-8 bg-slate-200 shrink-0" />

              <div className="shrink-0">
                <div className="text-base font-bold text-emerald-600 font-mono">
                  {farm.harvestedFruits.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">ผลผลิตที่เก็บเกี่ยว</div>
              </div>

              <div className="w-px h-8 bg-slate-200 shrink-0" />

              <div className="shrink-0">
                <div className="flex items-center gap-1 text-base font-bold text-slate-900">
                  <Trees className="w-4 h-4 text-emerald-600" />
                  <span>{farm.totalTrees.toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-slate-400">ต้นทุเรียน</div>
              </div>

              <div className="w-px h-8 bg-slate-200 shrink-0" />

              <div className="shrink-0">
                <div className="flex items-center gap-1 text-sm font-bold text-slate-800">
                  <span>🇹🇭</span>
                  <span>{farm.province}</span>
                </div>
                <div className="text-[11px] text-slate-400">{farm.district || 'ประเทศไทย'}</div>
              </div>

              <div className="w-px h-8 bg-slate-200 shrink-0" />

              <div className="shrink-0">
                <div className="text-base font-bold text-indigo-600">
                  {allTrees.length}
                </div>
                <div className="text-[11px] text-slate-400">ต้นที่ลงทะเบียน</div>
              </div>
            </div>

            {/* Farm Bio with Show More */}
            <div className="text-xs text-slate-600 leading-relaxed">
              <p className={showFullStory ? '' : 'line-clamp-2'}>
                {farm.aboutStory || farm.highlight}
              </p>
              {farm.aboutStory && (
                <button
                  onClick={() => setShowFullStory(!showFullStory)}
                  className="text-emerald-700 font-bold hover:underline mt-1 inline-block"
                >
                  {showFullStory ? 'ย่อข้อมูล ▲' : 'ดูเพิ่มเติม (Show more) ▼'}
                </button>
              )}
            </div>

            {/* Social Media & Contact Links Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
              {farm.contact?.websiteUrl && (
                <a
                  href={farm.contact.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-emerald-700 font-medium hover:bg-emerald-50/50 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>เว็บไซต์สวน</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}

              {farm.contact?.facebook && (
                <a
                  href={farm.contact.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 hover:border-blue-300 rounded-lg text-blue-700 font-medium hover:bg-blue-100/60 transition-colors"
                >
                  <span className="font-bold">f</span>
                  <span>เพจเฟสบุ๊ค</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}

              {farm.contact?.instagram && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 border border-pink-200 rounded-lg text-pink-700 font-medium">
                  <span className="font-bold">IG</span>
                  <span>{farm.contact.instagram}</span>
                </div>
              )}

              {farm.contact?.lineId && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-medium">
                  <span className="font-bold">LINE</span>
                  <span>ID: {farm.contact.lineId}</span>
                </div>
              )}

              {farm.contact?.locationAddress && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate max-w-xs">{farm.contact.locationAddress}</span>
                </div>
              )}
            </div>

            {/* Certifications Display (GPA/GAP/GI) */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  ใบรับรองมาตรฐานทางการเกษตร (Certificates & GPA/GAP/GI):
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {farm.certificationDetails && farm.certificationDetails.length > 0 ? (
                  farm.certificationDetails.map((cert, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1">
                          <span>{cert.shortCode}</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1 rounded-xs">
                            ตรวจสอบแล้ว
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          เลขที่: {cert.certNumber}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">
                          ออกโดย: {cert.issuedBy}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-2.5 rounded-xl border border-blue-200/80 bg-blue-50/40 flex items-center gap-2 text-xs text-blue-800">
                    <Award className="w-4 h-4 text-blue-600" />
                    <span>มาตรฐาน GAP กรมวิชาการเกษตร (ตรวจสอบแล้ว)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-sm font-semibold text-slate-500 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('trees')}
          className={`pb-3 transition-colors cursor-pointer shrink-0 ${
            activeTab === 'trees'
              ? 'text-emerald-700 border-b-2 border-emerald-600 font-bold'
              : 'hover:text-slate-800'
          }`}
        >
          รายชื่อต้นไม้แต่ละต้น ({allTrees.length})
        </button>
        <button
          onClick={() => setActiveTab('certs')}
          className={`pb-3 transition-colors cursor-pointer shrink-0 ${
            activeTab === 'certs'
              ? 'text-emerald-700 border-b-2 border-emerald-600 font-bold'
              : 'hover:text-slate-800'
          }`}
        >
          ใบรับรอง & มาตรฐาน GPA/GAP ({farm.certificationDetails?.length || farm.certifications?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('gallery')}
          className={`pb-3 transition-colors cursor-pointer shrink-0 ${
            activeTab === 'gallery'
              ? 'text-emerald-700 border-b-2 border-emerald-600 font-bold'
              : 'hover:text-slate-800'
          }`}
        >
          รูปภาพสวน ({photos.length})
        </button>
      </div>

      {/* Tab: Individual Trees List matching the user's uploaded screenshot */}
      {activeTab === 'trees' && (
        <div className="space-y-4">
          {/* Top Filter Bar with All 124 | Autoflower 105 | Photoperiod 19 and Sort Selector */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Filter Pills matching the screenshot */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar text-xs font-semibold">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  selectedFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>ทั้งหมด</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedFilter === 'all'
                      ? 'bg-slate-700 text-slate-100'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {allTrees.length}
                </span>
              </button>

              <button
                onClick={() => setSelectedFilter('auto')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  selectedFilter === 'auto'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>เสียบยอด/สายพันธุ์หลัก (Auto)</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedFilter === 'auto'
                      ? 'bg-slate-700 text-slate-100'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {autoCount}
                </span>
              </button>

              <button
                onClick={() => setSelectedFilter('photo')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  selectedFilter === 'photo'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>ต้นดั้งเดิม/สายพันธุ์พิเศษ (Photo)</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedFilter === 'photo'
                      ? 'bg-slate-700 text-slate-100'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {photoCount}
                </span>
              </button>

              {companionCount > 0 && (
                <button
                  onClick={() => setSelectedFilter('companion')}
                  className={`px-3.5 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    selectedFilter === 'companion'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>ไม้ผลร่วม</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                      selectedFilter === 'companion'
                        ? 'bg-slate-700 text-slate-100'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {companionCount}
                  </span>
                </button>
              )}
            </div>

            {/* Search & Sort Dropdown matching top right of screenshot */}
            <div className="flex items-center gap-2.5">
              {/* Quick Search by Tree Code / Name */}
              <div className="relative w-44 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหารหัสต้น / ชื่อต้น..."
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500 shadow-2xs"
                />
              </div>

              {/* Sort selector matching "Sort by a-z ▾" */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
                <span className="text-slate-400 font-medium hidden sm:inline">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer shadow-2xs"
                >
                  <option value="rating">ความนิยมรีวิวสูงสุด (Rating High)</option>
                  <option value="az">ชื่อต้น (a-z)</option>
                  <option value="code">รหัสต้น (Tree Code)</option>
                  <option value="yield">ผลผลิตต่อต้น (Fruit Yield)</option>
                  <option value="diaries">บันทึกการดูแล (Diaries)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Detailed 2-Column Tree List matching screenshot */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredAndSortedTrees.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                ไม่พบรายชื่อต้นไม้ตามเงื่อนไขที่ค้นหา
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* Left Column of Trees */}
                <div className="divide-y divide-slate-100">
                  {leftColTrees.map((tree) => (
                    <IndividualTreeRowItem
                      key={tree.id}
                      tree={tree}
                      onSelect={() => setSelectedTree(tree)}
                    />
                  ))}
                </div>

                {/* Right Column of Trees */}
                <div className="divide-y divide-slate-100">
                  {rightColTrees.map((tree) => (
                    <IndividualTreeRowItem
                      key={tree.id}
                      tree={tree}
                      onSelect={() => setSelectedTree(tree)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-center text-[11px] text-slate-400 py-1">
            คลิกที่แถวต้นไม้เพื่อดูรายละเอียดประวัติการให้ปุ๋ย, ค่าความหวาน Brix, พิกัดแปลง และสมุดบันทึกการดูแล
          </div>
        </div>
      )}

      {/* Certifications Tab */}
      {activeTab === 'certs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-800">
              รายละเอียดใบรับรองมาตรฐานและคุณภาพสวน (GPA / GAP / GI)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {farm.certificationDetails?.map((cert, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm text-slate-900">{cert.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    ผ่านการรับรอง
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-1">
                  <div>
                    <span className="text-slate-400">เลขที่ใบรับรอง:</span>{' '}
                    <span className="font-mono font-bold text-slate-800">{cert.certNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">หน่วยงานผู้ออก:</span> {cert.issuedBy}
                  </div>
                  <div>
                    <span className="text-slate-400">หมดอายุ / ต่ออายุ:</span> {cert.validUntil}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gallery Tab */}
      {activeTab === 'gallery' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h3 className="text-lg font-bold text-slate-800 mb-4">รูปภาพบรรยากาศในสวน</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((url, idx) => (
              <div
                key={idx}
                className="rounded-xl overflow-hidden aspect-4/3 border border-slate-200 shadow-2xs group relative"
              >
                <img
                  src={url}
                  alt={`สวนรูปที่ ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tree Detail Modal for inspecting tree passport & logs */}
      <TreeDetailModal
        tree={selectedTree}
        farm={farm}
        onClose={() => setSelectedTree(null)}
      />
    </div>
  );
};

// Row item component rendering individual tree matching the user's uploaded screenshot columns
interface IndividualTreeRowItemProps {
  tree: IndividualTree;
  onSelect: () => void;
}

const IndividualTreeRowItem: React.FC<IndividualTreeRowItemProps> = ({ tree, onSelect }) => {
  return (
    <div
      onClick={onSelect}
      className="p-2.5 px-3 sm:px-4 flex items-center justify-between hover:bg-emerald-50/40 transition-colors cursor-pointer group text-xs"
    >
      {/* 1. Left: Tree Name + Code + Badge + Planted Date */}
      <div className="min-w-0 pr-2 flex items-center gap-2">
        <div className="truncate">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[11px] font-bold text-slate-400 group-hover:text-emerald-700 transition-colors">
              [{tree.code}]
            </span>
            <span className="font-bold text-slate-800 group-hover:text-emerald-900 transition-colors truncate">
              {tree.name}
            </span>
          </div>
          {tree.plantedDate && (
            <div className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
              <span>🌱 ปลูกเมื่อ: {tree.plantedDate}</span>
              <span>•</span>
              <span>อายุ {tree.ageYears} ปี</span>
            </div>
          )}
        </div>

        {/* Year/Special Badge matching screenshot e.g. "2026 NEW" */}
        {tree.badge && (
          <div className="shrink-0 flex flex-col items-center">
            {tree.badge.includes('2026') ? (
              <div className="leading-none text-center">
                <span className="text-[9px] font-bold text-slate-500 font-mono block">2026</span>
                <span className="text-[8px] font-extrabold text-amber-600 uppercase tracking-tighter">NEW</span>
              </div>
            ) : tree.badge.includes('2025') ? (
              <div className="leading-none text-center">
                <span className="text-[9px] font-bold text-slate-500 font-mono block">2025</span>
                <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-tighter">NEW</span>
              </div>
            ) : (
              <span className="text-[9px] font-bold px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded-xs">
                {tree.badge}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Middle-Right: Gender symbol ♀ + Auto/Photo badge + Yield + Diary Logs + Star Rating */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 text-right">
        {/* Symbol matching pink ♀ in screenshot */}
        <span className="text-pink-500 font-bold text-sm select-none" title="ต้นสมบูรณ์เพศ / ดอกสมบูรณ์">
          ♀
        </span>

        {/* Auto (A) / Photo (P) badge matching screenshot */}
        <div className="flex flex-col items-center w-5">
          {tree.propagationCode === 'AUTO' ? (
            <div className="leading-none text-center">
              <span className="text-emerald-600 font-bold text-xs font-mono">A</span>
              <span className="text-[7px] text-emerald-600 font-bold uppercase tracking-tighter block">AUTO</span>
            </div>
          ) : (
            <div className="leading-none text-center">
              <span className="text-purple-600 font-bold text-xs font-mono">P</span>
              <span className="text-[7px] text-purple-600 font-bold uppercase tracking-tighter block">PHOTO</span>
            </div>
          )}
        </div>

        {/* Fruit Yield per plant matching "84 g/p" in screenshot */}
        <div className="w-14 sm:w-16 text-right">
          <span className="font-mono text-slate-700 font-semibold text-xs">
            {tree.yieldFruitCount} ลูก
          </span>
          <span className="text-[9px] text-slate-400 block -mt-0.5">
            ({tree.yieldWeightKg}kg)
          </span>
        </div>

        {/* Diary log count matching open book icon + number in screenshot */}
        <div className="flex items-center gap-1 w-11 sm:w-12 justify-end text-slate-600 font-mono">
          <BookOpen className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
          <span>{tree.diariesCount}</span>
        </div>

        {/* Star Rating with yellow star matching screenshot */}
        <div className="flex items-center gap-1 w-10 sm:w-11 justify-end font-mono font-bold text-slate-800">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>{tree.rating.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};
