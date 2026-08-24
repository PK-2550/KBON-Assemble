/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_DURIAN_FARMS } from './data/farms';
import {
  DurianFarm,
  SortField,
  FruitTreeVariety,
  UserRole,
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
import { TreeDetailModal } from './components/TreeDetailModal';
import { FarmRegistrationModal } from './components/FarmRegistrationModal';
import { AdminApprovalHubModal } from './components/AdminApprovalHubModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AuthScreen } from './components/AuthScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { subscribeFarms, saveFarmToFirestore, seedFarmsIfEmpty } from './services/firestoreService';
import { isUserAdmin } from './services/authService';
import { Trees, Loader2, ArrowLeft } from 'lucide-react';

function MainAppContent() {
  const { currentUser, userProfile, loading, updateUserRole } = useAuth();

  const [farms, setFarms] = useState<DurianFarm[]>(INITIAL_DURIAN_FARMS);
  const [currentRole, setCurrentRole] = useState<UserRole>('user');
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
  const [adminApprovalInitialTab, setAdminApprovalInitialTab] = useState<'manager_application' | 'farm_verification'>('manager_application');
  const [isGlobalNfcScannerOpen, setIsGlobalNfcScannerOpen] = useState(false);
  const [activeScannedTree, setActiveScannedTree] = useState<{ tree: IndividualTree; farm: DurianFarm } | null>(null);
  const [isGuestPreview, setIsGuestPreview] = useState(false);

  const isAdmin = isUserAdmin(currentUser);

  // Sync role when user profile is loaded
  useEffect(() => {
    if (isAdmin) {
      setCurrentRole('admin');
    } else if (userProfile?.role) {
      setCurrentRole(userProfile.role);
    }
  }, [userProfile, isAdmin]);

  // Synchronize farms in real-time with Firebase Firestore kbon-pop-db
  useEffect(() => {
    seedFarmsIfEmpty().then((loadedFarms) => {
      if (loadedFarms && loadedFarms.length > 0) {
        setFarms(loadedFarms);
      }
    });

    const unsubscribe = subscribeFarms((firestoreFarms) => {
      if (firestoreFarms && firestoreFarms.length > 0) {
        setFarms(firestoreFarms);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle role change
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    if (currentUser) {
      updateUserRole(newRole);
    }
  };

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
    setFarms((prev) => [newFarm, ...prev]);
    try {
      await saveFarmToFirestore(newFarm);
    } catch (err) {
      console.error('Failed to save new farm to Firestore:', err);
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

  const handleGlobalFruitScanned = (scannedFruit: NfcScannedFruit) => {
    // Find matching farm and tree
    let matchedFarm = farms.find((f) => (f.name && f.name.includes(scannedFruit.farmName)) || f.id === 'farm-01' || f.id === 'farm-1') || farms[0];
    let matchedTree = matchedFarm?.individualTrees?.find((t) => t.code === scannedFruit.treeCode) || matchedFarm?.individualTrees?.[0];

    if (matchedFarm && matchedTree) {
      setSelectedFarm(matchedFarm);
      setActiveScannedTree({ tree: matchedTree, farm: matchedFarm });
    } else if (matchedFarm) {
      setSelectedFarm(matchedFarm);
    }
    setActiveTab('farms');
  };

  // If Firebase Auth is still initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-[#07190f] flex flex-col items-center justify-center text-[#83A893]">
        <div className="w-12 h-12 rounded-2xl bg-[#0e2619] border border-[#1c442c] flex items-center justify-center text-[#E5A93C] mb-4 shadow-xl">
          <Trees className="w-6 h-6" />
        </div>
        <Loader2 className="w-6 h-6 text-[#E5A93C] animate-spin mb-2" />
        <span className="text-xs font-semibold tracking-wider text-[#83A893]">
          กำลังเตรียมระบบความปลอดภัยและการยืนยันตัวตน...
        </span>
      </div>
    );
  }

  // If not logged in and not in guest preview mode, show the Authentication screen
  if (!currentUser && !isGuestPreview) {
    return <AuthScreen onGuestAccess={() => setIsGuestPreview(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#07190f] flex flex-col font-sans text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        onOpenNfcScanner={() => setIsGlobalNfcScannerOpen(true)}
        onOpenRegisterFarm={(req) => {
          setEditingRequest(req || null);
          setIsRegisterFarmModalOpen(true);
        }}
        onOpenAdminApproval={(tab) => {
          if (tab === 'manager_application' || tab === 'farm_verification') {
            setAdminApprovalInitialTab(tab);
          } else {
            setAdminApprovalInitialTab('manager_application');
          }
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
        <div className="bg-[#0e2619] border-b border-[#1c442c] px-3 py-1.5 text-center text-xs font-semibold text-[#83A893] flex items-center justify-center gap-2">
          <span>โหมดเข้าชมชั่วคราว (Guest Preview)</span>
          <button
            onClick={() => setIsGuestPreview(false)}
            className="underline text-[#E5A93C] font-bold hover:text-[#f5d280] cursor-pointer ml-1"
          >
            เข้าสู่ระบบ
          </button>
        </div>
      )}

      {/* Main Content Area - Mobile-First centered container */}
      <main className="flex-1 px-3.5 py-3 max-w-md md:max-w-xl w-full mx-auto flex flex-col gap-3 pb-24">
        {/* If a Farm is selected, show the comprehensive FarmProfileView */}
        {selectedFarm ? (
          <FarmProfileView
            farm={selectedFarm}
            currentRole={currentRole}
            onBack={() => setSelectedFarm(null)}
            onSelectVariety={(variety: FruitTreeVariety) => {
              console.log('Selected variety:', variety.name);
            }}
          />
        ) : (
          <>
            {activeTab === 'farms' && (
              <>
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
                  currentRole={currentRole}
                  onOpenNfcScanner={() => setIsGlobalNfcScannerOpen(true)}
                />

                {/* Quick Stats Summary Ribbon (Visible only for Admin Account) */}
                {isAdmin && currentRole === 'admin' && (
                  <StatsBar farms={filteredAndSortedFarms} />
                )}

                {/* Farms Grid or List View */}
                <FarmList
                  farms={filteredAndSortedFarms}
                  viewMode={viewMode}
                  onSelectFarm={(farm) => setSelectedFarm(farm)}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                  currentRole={currentRole}
                />
              </>
            )}

            {activeTab === 'dashboard' && (
              <div className="space-y-4 sm:space-y-6">
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
          DuriTrack Smart Agri-System v2.5 • {currentRole === 'user' ? 'โหมดผู้บริโภค (User Flow)' : currentRole === 'manager' ? 'โหมดผู้จัดการสวน (Manager Flow)' : 'โหมดผู้ดูแลระบบ (Admin Flow)'}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-600 font-semibold flex items-center gap-1">
              <span>Firebase Auth & Firestore:</span>
              <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-200 text-[10px]">
                kbon-pop-db
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
        initialMasterTab={adminApprovalInitialTab}
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
        onFruitVerified={handleGlobalFruitScanned}
      />

      {/* Scanned Tree Passport Modal */}
      {activeScannedTree && (
        <TreeDetailModal
          tree={activeScannedTree.tree}
          farm={activeScannedTree.farm}
          currentRole={currentRole}
          onClose={() => setActiveScannedTree(null)}
        />
      )}
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
