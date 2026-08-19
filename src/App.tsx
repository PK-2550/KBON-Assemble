/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { INITIAL_DURIAN_FARMS } from './data/farms';
import { DurianFarm, SortField, FruitTreeVariety } from './types';
import { Navbar } from './components/Navbar';
import { HeaderBar } from './components/HeaderBar';
import { StatsBar } from './components/StatsBar';
import { FarmList } from './components/FarmList';
import { FarmProfileView } from './components/FarmProfileView';
import { DashboardView } from './components/DashboardView';
import { AddFarmModal } from './components/AddFarmModal';

export default function App() {
  const [farms, setFarms] = useState<DurianFarm[]>(INITIAL_DURIAN_FARMS);
  const [activeTab, setActiveTab] = useState<'farms' | 'dashboard'>('farms');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('harvested');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedFarm, setSelectedFarm] = useState<DurianFarm | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
          f.name.toLowerCase().includes(q) ||
          (f.nameEn && f.nameEn.toLowerCase().includes(q)) ||
          f.province.toLowerCase().includes(q) ||
          f.topVarieties.some((v) => v.toLowerCase().includes(q))
      );
    }

    // Filter by province
    if (selectedProvince) {
      result = result.filter((f) => f.province === selectedProvince);
    }

    // Sort results
    result.sort((a, b) => {
      if (sortBy === 'harvested') {
        return b.harvestedFruits - a.harvestedFruits;
      }
      if (sortBy === 'trees') {
        return b.totalTrees - a.totalTrees;
      }
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'th');
      }
      return a.rank - b.rank;
    });

    return result;
  }, [farms, searchQuery, selectedProvince, sortBy]);

  const handleAddFarm = (newFarm: DurianFarm) => {
    setFarms((prev) => [newFarm, ...prev]);
  };

  const handleTabChange = (tab: 'farms' | 'dashboard' | 'harvests') => {
    setActiveTab(tab);
    setSelectedFarm(null); // Return to list if switching tabs
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Sleek Interface Top Navigation */}
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto flex flex-col gap-6">
        {/* If a Farm is selected, show the comprehensive FarmProfileView matching user screenshot */}
        {selectedFarm ? (
          <FarmProfileView
            farm={selectedFarm}
            onBack={() => setSelectedFarm(null)}
            onSelectVariety={(variety: FruitTreeVariety) => {
              // Quick alert/info for variety, ready for the next step of tree-level features
              console.log('Selected variety:', variety.name);
            }}
          />
        ) : (
          <>
            {activeTab === 'farms' && (
              <>
                {/* Header & Controls matching Sleek Interface */}
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
                />

                {/* Quick Stats Summary Ribbon */}
                <StatsBar farms={filteredAndSortedFarms} />

                {/* Farms Grid or List View */}
                <FarmList
                  farms={filteredAndSortedFarms}
                  viewMode={viewMode}
                  onSelectFarm={(farm) => setSelectedFarm(farm)}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                />
              </>
            )}

            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                      แดชบอร์ดภาพรวมการผลิต
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                      วิเคราะห์สถิติจำนวนต้น ปริมาณผลผลิต และการกระจายตัวของฟาร์มทั่วประเทศ
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('farms')}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 cursor-pointer shadow-2xs"
                  >
                    ← กลับสู่หน้ารายชื่อฟาร์ม
                  </button>
                </div>

                <DashboardView
                  farms={farms}
                  onSelectFarm={(farm) => setSelectedFarm(farm)}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Sleek Interface Footer */}
      <footer className="bg-white border-t border-slate-200 h-12 px-4 sm:px-8 flex items-center justify-between shrink-0 mt-8">
        <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">
          DuriTrack Smart Agri-System v2.4
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-500 font-medium">System Online</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-400">ข้อมูลอัปเดตแบบเรียลไทม์</span>
        </div>
      </footer>

      {/* Add New Farm Modal */}
      <AddFarmModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddFarm={handleAddFarm}
        existingCount={farms.length}
      />
    </div>
  );
}
