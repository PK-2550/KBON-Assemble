/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DurianFarm,
  SortField,
  FruitTreeVariety,
  NfcScannedFruit,
  IndividualTree,
  FarmRegistrationRequest,
} from './types';
import { Navbar } from './components/Navbar';
import { HeaderBar } from './components/HeaderBar';
import { StatsBar } from './components/StatsBar';
import { FarmList } from './components/FarmList';
import { FarmProfileView } from './components/FarmProfileView';
import { DashboardView } from './components/DashboardView';
import { AddFarmModal } from './components/AddFarmModal';
import { NfcScannerModal } from './components/NfcScannerModal';
import { TreeDetailView } from './components/TreeDetailView';
import { FarmRegistrationModal } from './components/FarmRegistrationModal';
import { AdminApprovalHubModal } from './components/AdminApprovalHubModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AuthScreen } from './components/AuthScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { fetchFarms, createFarm } from './services/farmService';
import { Trees, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

/**
 * เพดานความกว้างของแต่ละหน้า
 *
 * LEGACY คือค่าเดิมที่ main เคยบังคับให้ทุกหน้า หน้าที่ยังไม่ได้ออกแบบใหม่
 * ใช้ค่านี้ต่อไป จะได้ไม่เปลี่ยนหน้าตาโดยไม่ตั้งใจระหว่างทยอยออกแบบใหม่
 *
 * WIDE ใช้กับหน้าที่ออกแบบมาให้ใช้พื้นที่แนวนอนจริง เพดาน 1536px
 * กว้างพอให้ตารางหลายคอลัมน์อ่านสบาย แต่ไม่ยืดจนบรรทัดยาวเกินกวาดสายตา
 */
const PAGE_WIDTH_LEGACY = 'w-full max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex flex-col gap-3';
const PAGE_WIDTH_WIDE = 'w-full max-w-screen-2xl mx-auto flex flex-col gap-3';
function MainAppContent() {
  const { currentUser, loading, roleMode, isAdmin, setRoleMode, connectionError, retryConnection } =
    useAuth();

  const [farms, setFarms] = useState<DurianFarm[]>([]);
  const [farmsError, setFarmsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'farms' | 'dashboard'>('farms');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('harvested');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedFarm, setSelectedFarm] = useState<DurianFarm | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRegisterFarmModalOpen, setIsRegisterFarmModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<FarmRegistrationRequest | null>(null);
  const [isAdminApprovalModalOpen, setIsAdminApprovalModalOpen] = useState(false);
  const [isGlobalNfcScannerOpen, setIsGlobalNfcScannerOpen] = useState(false);
  // เก็บผลที่สแกนได้ไว้ด้วย ไม่ใช่แค่ต้นกับฟาร์ม
  // เพราะหน้ารายละเอียดต้นไม้ใช้ค่านี้เป็นหลักฐานว่าผู้ใช้ถือผลจริงอยู่ในมือ
  // จึงจะเปิดฟอร์มเขียนรีวิวให้
  const [activeScannedTree, setActiveScannedTree] = useState<{
    tree: IndividualTree;
    farm: DurianFarm;
    fruit: NfcScannedFruit;
  } | null>(null);
  const [isGuestPreview, setIsGuestPreview] = useState(false);

  /**
   * โหลดข้อมูลฟาร์มจาก API
   *
   * ของเดิมใช้ onSnapshot ของ Firestore ซึ่งอัปเดตให้เองแบบ realtime
   * Postgres + REST ไม่มีของแบบนั้น จึงใช้วิธีโหลดตอนเปิดหน้า
   * แล้วเรียกซ้ำหลังบันทึกข้อมูลแทน
   */
  const loadFarms = useCallback(async () => {
    try {
      const data = await fetchFarms();
      setFarms(data);
      setFarmsError(null);
    } catch (err) {
      setFarmsError(err instanceof Error ? err.message : 'โหลดข้อมูลฟาร์มไม่สำเร็จ');
    }
  }, []);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  // Extract unique provinces list
  const provinces = useMemo(() => {
    const unique = Array.from(new Set(farms.map((f) => f.province)));
    return unique.sort((a, b) => (a as string).localeCompare(b as string, 'th'));
  }, [farms]);

  // Filter & sort farms
  const filteredAndSortedFarms = useMemo(() => {
    let result = [...farms];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          (f?.name && f.name.toLowerCase().includes(q)) ||
          (f?.nameEn && f.nameEn.toLowerCase().includes(q)) ||
          (f?.province && f.province.toLowerCase().includes(q)) ||
          (f?.topVarieties && f.topVarieties.some((v) => v.toLowerCase().includes(q)))
      );
    }

    // Filter by province
    if (selectedProvince) {
      result = result.filter((f) => f.province === selectedProvince);
    }

    // Sort results
    result.sort((a, b) => {
      if (sortBy === 'harvested') {
        return (b.harvestedFruits || 0) - (a.harvestedFruits || 0);
      }
      if (sortBy === 'trees') {
        return (b.totalTrees || 0) - (a.totalTrees || 0);
      }
      if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '', 'th');
      }
      return (a.rank || 0) - (b.rank || 0);
    });

    return result;
  }, [farms, searchQuery, selectedProvince, sortBy]);

  const handleAddFarm = async (newFarm: DurianFarm) => {
    try {
      await createFarm(newFarm);
      // ดึงข้อมูลใหม่ทั้งชุดแทนการ push เข้า state เอง
      // จะได้เห็นค่าที่ server บันทึกจริง ไม่ใช่ค่าที่เราเดาไว้ฝั่งนี้
      await loadFarms();
      setFarmsError(null);
    } catch (err) {
      setFarmsError(err instanceof Error ? err.message : 'บันทึกฟาร์มใหม่ไม่สำเร็จ');
    }
  };

  const handleFarmApprovedByAdmin = (approvedFarm: DurianFarm) => {
    setFarms((prev) => {
      const exists = prev.some((f) => f.id === approvedFarm.id);
      if (exists) {
        return prev.map((f) => (f.id === approvedFarm.id ? approvedFarm : f));
      }
      return [approvedFarm, ...prev];
    });
  };

  const handleTabChange = (tab: 'farms' | 'dashboard') => {
    setActiveTab(tab);
    setSelectedFarm(null);
  };

  const handleSelectManagedFarm = (farmId: string) => {
    const target = farms.find((f) => f.id === farmId);
    if (target) {
      setSelectedFarm(target);
      setActiveTab('farms');
    }
  };

  /**
   * เปิดพาสปอร์ตของต้นไม้ที่เพิ่งสแกนแท็ก NFC มา
   *
   * ค้นด้วยรหัสต้นข้ามทุกฟาร์ม เพราะรหัสต้นเป็น unique ทั้งระบบ
   * ไม่ต้องเดาว่าอยู่ฟาร์มไหนจากชื่อ
   *
   * ถ้าหารหัสนั้นไม่เจอ ต้องบอกว่าไม่เจอ ห้ามเปิดต้นอื่นแทน
   * ของเดิมถ้าหาไม่เจอจะตกไปใช้ฟาร์มแรกและต้นแรกในรายการ ผู้ใช้ที่สแกน
   * แท็กหนึ่งจึงเห็นข้อมูลของอีกต้นโดยไม่รู้ตัว ซึ่งขัดกับหน้าที่ของระบบ
   * ตรวจสอบย้อนกลับโดยตรง การแสดงต้นผิดแย่กว่าการบอกว่าหาไม่เจอ
   */
  const handleGlobalFruitScanned = (scannedFruit: NfcScannedFruit) => {
    setActiveTab('farms');

    for (const farm of farms) {
      const tree = farm.individualTrees?.find((t) => t.code === scannedFruit.treeCode);
      if (tree) {
        setFarmsError(null);
        setSelectedFarm(farm);
        setActiveScannedTree({ tree, farm, fruit: scannedFruit });
        return;
      }
    }

    setActiveScannedTree(null);
    setFarmsError(
      `ไม่พบต้นไม้รหัส ${scannedFruit.treeCode} ในระบบ — แท็กนี้อาจยังไม่ได้ขึ้นทะเบียน`
    );
  };

  // ระหว่างถาม server ว่ามี session อยู่ไหม
  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-fg-2">
        <div className="w-12 h-12 rounded-2xl bg-surface border border-line flex items-center justify-center text-gold mb-4 shadow-xl">
          <Trees className="w-6 h-6" />
        </div>
        <Loader2 className="w-6 h-6 text-gold animate-spin mb-2" />
        <span className="text-xs font-semibold tracking-wider text-fg-2">
          กำลังเตรียมระบบความปลอดภัยและการยืนยันตัวตน...
        </span>
      </div>
    );
  }

  /**
   * ติดต่อเซิร์ฟเวอร์ไม่ได้ -- ต้องบอกให้ชัด ไม่ใช่โยนหน้า login ใส่
   *
   * ถ้าเด้งไปหน้าเข้าสู่ระบบ ผู้ใช้จะนึกว่าตัวเองหลุดจากระบบแล้วพยายามล็อกอินซ้ำ ๆ
   * ทั้งที่ปัญหาจริงคือเซิร์ฟเวอร์ไม่ทำงาน
   */
  if (connectionError && !currentUser) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-fg-2 px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-sm font-bold text-white mb-1.5">ติดต่อเซิร์ฟเวอร์ไม่ได้</h1>
        <p className="text-xs text-fg-2 max-w-xs leading-relaxed mb-1">{connectionError}</p>
        <p className="text-[11px] text-fg-4 max-w-xs leading-relaxed mb-4">
          ตรวจว่าฐานข้อมูลทำงานอยู่ (docker compose up -d) แล้วสั่ง npm run dev อีกครั้ง
        </p>
        <button
          onClick={() => {
            // ลองใหม่ทั้งสองอย่างพร้อมกัน ไม่งั้นผู้ใช้ต้องกดสองรอบ
            // (รอบแรกได้ session กลับมา แต่รายชื่อฟาร์มยังว่างอยู่)
            retryConnection();
            loadFarms();
          }}
          className="px-4 py-2 bg-gold hover:bg-gold-hi text-gold-ink-2 text-xs font-bold rounded-xl cursor-pointer shadow-md"
        >
          ลองเชื่อมต่อใหม่
        </button>
      </div>
    );
  }

  // If not logged in and not in guest preview mode, show the Authentication screen
  if (!currentUser && !isGuestPreview) {
    return <AuthScreen onGuestAccess={() => setIsGuestPreview(true)} />;
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-sans text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        currentRole={roleMode}
        onRoleChange={setRoleMode}
        onOpenNfcScanner={() => setIsGlobalNfcScannerOpen(true)}
        onOpenRegisterFarm={(req) => {
          setEditingRequest(req || null);
          setIsRegisterFarmModalOpen(true);
        }}
        onOpenAdminApproval={() => {
          // Navbar ส่งชื่อแท็บมาด้วย แต่ AdminApprovalHubModal ไม่มีแท็บหลักให้เลือก
          // มีแค่ตัวกรองสถานะ (รอดำเนินการ/อนุมัติแล้ว/ตีกลับ) จึงไม่มีอะไรให้ส่งต่อ
          setIsAdminApprovalModalOpen(true);
        }}
        farms={farms}
        onSelectFarm={(farm) => {
          setSelectedFarm(farm);
          setActiveTab('farms');
        }}
      />

      {/* Guest Mode Banner (if exploring without login) */}
      {!currentUser && isGuestPreview && (
        <div className="bg-surface border-b border-line px-3 py-1.5 text-center text-xs font-semibold text-fg-2 flex items-center justify-center gap-2">
          <span>โหมดเข้าชมชั่วคราว (Guest Preview)</span>
          <button
            onClick={() => setIsGuestPreview(false)}
            className="underline text-gold font-bold hover:text-gold-soft cursor-pointer ml-1"
          >
            เข้าสู่ระบบ
          </button>
        </div>
      )}

      {/* แจ้งเตือนเมื่อติดต่อเซิร์ฟเวอร์ไม่ได้ หรือบันทึกข้อมูลไม่สำเร็จ
          เดิม Firestore ทำงานแบบ offline cache ได้ แอปเลยไม่เคยต้องบอกผู้ใช้ว่าต่อไม่ติด
          พอเป็น API จริงแล้ว ถ้าเงียบไว้ผู้ใช้จะเห็นแค่หน้าว่างโดยไม่รู้สาเหตุ */}
      {farmsError && (
        <div className="bg-rose-950/60 border-b border-rose-800 px-3 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-rose-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{farmsError}</span>
          <button
            onClick={loadFarms}
            className="underline text-rose-100 font-bold hover:text-white cursor-pointer ml-1"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* Main Content Area - Mobile-First centered container */}
      <main
        /*
         * ความกว้างของเนื้อหาเป็นหน้าที่ของแต่ละหน้า ไม่ใช่ของ main
         *
         * เดิม main กำหนดเพดาน 896px ให้ทุกหน้าพร้อมกัน หน้ารายชื่อฟาร์มที่ควร
         * ใช้พื้นที่แนวนอนได้เต็มที่จึงถูกบีบไปด้วย บนจอ 1920px เหลือขอบว่าง
         * ข้างละราว 500px
         *
         * ย้ายเพดานไปไว้ที่แต่ละหน้าแทน หน้าที่ยังไม่ได้ออกแบบใหม่ใช้ค่าเดิม
         * ผ่าน PAGE_WIDTH_LEGACY จึงไม่มีหน้าไหนเปลี่ยนไปโดยไม่ตั้งใจ
         */
        className="flex-1 px-3.5 py-3 w-full flex flex-col gap-3 pb-24"
      >
        {/* If a Farm is selected, show the comprehensive FarmProfileView */}
        {/* ต้นไม้ที่เพิ่งสแกน NFC มา -- แสดงเป็นหน้าเต็มแทนเนื้อหาหลัก
            ของเดิมเปิดเป็นหน้าต่างซ้อนทับหน้าที่อยู่เบื้องหลัง */}
        {activeScannedTree ? (
          <div className={PAGE_WIDTH_LEGACY}>
          <TreeDetailView
            tree={activeScannedTree.tree}
            farm={activeScannedTree.farm}
            scannedFruit={activeScannedTree.fruit}
            currentRole={roleMode}
            onBack={() => setActiveScannedTree(null)}
          />
          </div>
        ) : selectedFarm ? (
          <div className={PAGE_WIDTH_LEGACY}>
          <FarmProfileView
            farm={selectedFarm}
            currentRole={roleMode}
            onBack={() => setSelectedFarm(null)}
            onSelectVariety={(variety: FruitTreeVariety) => {
              console.log('Selected variety:', variety.name);
            }}
          />
          </div>
        ) : (
          <>
            {activeTab === 'farms' && (
              <div className={PAGE_WIDTH_WIDE}>
                {/* Header & Controls */}
                <HeaderBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  selectedProvince={selectedProvince}
                  onProvinceChange={setSelectedProvince}
                  provinces={provinces}
                  totalFarms={farms.length}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                  currentRole={roleMode}
                  onOpenNfcScanner={() => setIsGlobalNfcScannerOpen(true)}
                />

                {/* Quick Stats Summary Ribbon (Visible only for Admin Account) */}
                {isAdmin && roleMode === 'admin' && (
                  <StatsBar farms={filteredAndSortedFarms} />
                )}

                {/* Farms Grid or List View */}
                <FarmList
                  farms={filteredAndSortedFarms}
                  viewMode={viewMode}
                  onSelectFarm={(farm) => setSelectedFarm(farm)}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                  currentRole={roleMode}
                />
              </div>
            )}

            {activeTab === 'dashboard' && (
              <div className={`${PAGE_WIDTH_LEGACY} space-y-4 sm:space-y-6`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
                  <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                      แดชบอร์ดภาพรวมการผลิต
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                      วิเคราะห์สถิติจำนวนต้น ปริมาณผลผลิต และการกระจายตัวของฟาร์มทั่วประเทศ
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('farms')}
                    className="self-start sm:self-auto px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>กลับสู่รายชื่อฟาร์ม</span>
                  </button>
                </div>

                <DashboardView
                  farms={farms}
                  onSelectFarm={(farm) => setSelectedFarm(farm)}
                  isAdmin={isAdmin}
                  onOpenAdminApproval={() => setIsAdminApprovalModalOpen(true)}
                  onOpenAddFarm={() => setIsAddModalOpen(true)}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Interface Footer with Database Status */}
      <footer className="hidden md:flex bg-white border-t border-slate-200 h-12 px-4 sm:px-8 items-center justify-between shrink-0">
        <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">
          DuriTrack Smart Agri-System v2.5 • {roleMode === 'user' ? 'โหมดผู้บริโภค (User Flow)' : roleMode === 'manager' ? 'โหมดผู้จัดการสวน (Manager Flow)' : 'โหมดผู้ดูแลระบบ (Admin Flow)'}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-600 font-semibold flex items-center gap-1">
              <span>PostgreSQL:</span>
              <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-200 text-[10px]">
                duritrack
              </span>
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-400">
            {currentUser ? `ผู้ใช้: ${currentUser.displayName || currentUser.username || currentUser.email}` : 'พร้อมใช้งาน'}
          </span>
        </div>
      </footer>

      {/* Farm Registration & Upgrade Modal (Shopee/Lazada style Manager Flow) */}
      <FarmRegistrationModal
        isOpen={isRegisterFarmModalOpen}
        initialData={editingRequest || undefined}
        onClose={() => {
          setIsRegisterFarmModalOpen(false);
          setEditingRequest(null);
        }}
        onRequestSubmitted={() => {
          setEditingRequest(null);
        }}
      />

      {/* Admin Approval & Verification Hub Modal */}
      <AdminApprovalHubModal
        isOpen={isAdminApprovalModalOpen}
        onClose={() => setIsAdminApprovalModalOpen(false)}
        onFarmApproved={handleFarmApprovedByAdmin}
      />

      {/* Add New Farm Modal (Admin Quick Entry) */}
      <AddFarmModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddFarm={handleAddFarm}
        existingCount={farms.length}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        onOpenNfcScanner={() => setIsGlobalNfcScannerOpen(true)}
      />

      {/* Global NFC Scanner Modal (User Flow & Quick Access) */}
      <NfcScannerModal
        isOpen={isGlobalNfcScannerOpen}
        onClose={() => setIsGlobalNfcScannerOpen(false)}
        targetTree={null}
        targetFarm={selectedFarm}
        farms={farms}
        onFruitVerified={handleGlobalFruitScanned}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
