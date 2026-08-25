import React, { useState, useEffect } from 'react';
import {
  Trees,
  Sprout,
  Star,
  Award,
  TrendingUp,
  MapPin,
  ShieldCheck,
  PlusCircle,
  Clock,
  CheckCircle2,
  Database,
  ArrowRight,
  Sparkles,
  BarChart3,
  Layers,
} from 'lucide-react';
import { DurianFarm } from '../types';
import { useAuth } from '../context/AuthContext';
import { subscribeAllFarmRequests } from '../services/farmRequestService';

interface DashboardViewProps {
  farms: DurianFarm[];
  onSelectFarm: (farm: DurianFarm) => void;
  isAdmin?: boolean;
  onOpenAdminApproval?: () => void;
  onOpenAddFarm?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  farms,
  onSelectFarm,
  isAdmin: propIsAdmin,
  onOpenAdminApproval,
  onOpenAddFarm,
}) => {
  // isAdmin จาก context อ่าน role จาก JWT ที่ server เซ็น
  // ของเดิมเรียก isUserAdmin() ซึ่งให้สิทธิ์แอดมินจากชื่อผู้ใช้หรืออีเมลฝั่ง client
  const { isAdmin: contextIsAdmin } = useAuth();
  const isAdmin = propIsAdmin ?? contextIsAdmin;
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Subscribe to pending requests count for Admin
  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = subscribeAllFarmRequests((reqs) => {
      const pending = reqs.filter((r) => r.status === 'pending').length;
      setPendingRequestsCount(pending);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  const totalTrees = farms.reduce((acc, f) => acc + (f.totalTrees || 0), 0);
  const totalHarvested = farms.reduce((acc, f) => acc + (f.harvestedFruits || 0), 0);
  const avgYieldPerTree = totalTrees > 0 ? (totalHarvested / totalTrees).toFixed(1) : '0';
  const certifiedFarmsCount = farms.filter((f) => f.certifications && f.certifications.length > 0).length;

  // Province breakdown
  const provinceStats = React.useMemo(() => {
    const map: Record<string, { count: number; harvested: number; trees: number }> = {};
    farms.forEach((f) => {
      if (!map[f.province]) {
        map[f.province] = { count: 0, harvested: 0, trees: 0 };
      }
      map[f.province].count += 1;
      map[f.province].harvested += f.harvestedFruits || 0;
      map[f.province].trees += f.totalTrees || 0;
    });
    return Object.entries(map)
      .map(([province, data]) => ({ province, ...data }))
      .sort((a, b) => b.harvested - a.harvested);
  }, [farms]);

  // Variety distribution estimate based on top varieties
  const varietyStats = React.useMemo(() => {
    const counts: Record<string, number> = {
      'หมอนทอง (Monthong)': 0,
      'ก้านยาว (Kan Yao)': 0,
      'ชะนี (Chanee)': 0,
      'พวงมณี (Puang Manee)': 0,
      'นกกระจิบ / สายพันธุ์อื่นๆ': 0,
    };

    farms.forEach((f) => {
      const farmHarvest = f.harvestedFruits || 0;
      if (f.topVarieties?.some((v) => v.includes('หมอนทอง'))) {
        counts['หมอนทอง (Monthong)'] += Math.round(farmHarvest * 0.65);
      }
      if (f.topVarieties?.some((v) => v.includes('ก้านยาว'))) {
        counts['ก้านยาว (Kan Yao)'] += Math.round(farmHarvest * 0.15);
      }
      if (f.topVarieties?.some((v) => v.includes('ชะนี'))) {
        counts['ชะนี (Chanee)'] += Math.round(farmHarvest * 0.1);
      }
      if (f.topVarieties?.some((v) => v.includes('พวงมณี'))) {
        counts['พวงมณี (Puang Manee)'] += Math.round(farmHarvest * 0.05);
      }
      counts['นกกระจิบ / สายพันธุ์อื่นๆ'] += Math.round(farmHarvest * 0.05);
    });

    const totalEstimated = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([name, val]) => ({
      name,
      val,
      percentage: ((val / totalEstimated) * 100).toFixed(1),
    }));
  }, [farms]);

  // Top 5 Ranked Farms
  const topFarms = React.useMemo(() => {
    return [...farms]
      .sort((a, b) => (b.harvestedFruits || 0) - (a.harvestedFruits || 0))
      .slice(0, 5);
  }, [farms]);

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-panel rounded-3xl p-5 border border-line-soft shadow-xl text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-fg-3">ผลผลิตรวมทั้งระบบ</span>
            <div className="w-8 h-8 rounded-xl bg-[#0e311f] border border-[#1e5236] text-gold flex items-center justify-center">
              <Sprout className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {totalHarvested.toLocaleString()}{' '}
            <span className="text-sm font-medium text-fg-3">ลูก</span>
          </div>
          <div className="text-xs text-gold font-semibold mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +12.4% เทียบกับฤดูกาลก่อน
          </div>
        </div>

        <div className="bg-panel rounded-3xl p-5 border border-line-soft shadow-xl text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-fg-3">จำนวนต้นทุเรียนขึ้นทะเบียน</span>
            <div className="w-8 h-8 rounded-xl bg-[#0e311f] border border-[#1e5236] text-gold flex items-center justify-center">
              <Trees className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {totalTrees.toLocaleString()}{' '}
            <span className="text-sm font-medium text-fg-3">ต้น</span>
          </div>
          <div className="text-xs text-fg-3 font-medium mt-2">
            เฉลี่ย {avgYieldPerTree} ลูก/ต้น/ปี
          </div>
        </div>

        <div className="bg-panel rounded-3xl p-5 border border-line-soft shadow-xl text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-fg-3">ฟาร์มมาตรฐาน GI / GAP</span>
            <div className="w-8 h-8 rounded-xl bg-[#0e311f] border border-[#1e5236] text-gold flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {certifiedFarmsCount}{' '}
            <span className="text-sm font-medium text-fg-3">/ {farms.length} ฟาร์ม</span>
          </div>
          <div className="text-xs text-leaf font-semibold mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {farms.length > 0 ? `${((certifiedFarmsCount / farms.length) * 100).toFixed(0)}% ได้รับการรับรอง` : '100%'}
          </div>
        </div>

        <div className="bg-panel rounded-3xl p-5 border border-line-soft shadow-xl text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-fg-3">คำขอลงทะเบียนรออนุมัติ</span>
            <div className="w-8 h-8 rounded-xl bg-[#0e311f] border border-[#1e5236] text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-300 tracking-tight">
            {pendingRequestsCount}{' '}
            <span className="text-sm font-medium text-fg-3">รายการ</span>
          </div>
          <div className="text-xs text-fg-3 font-medium mt-2">
            {pendingRequestsCount > 0 ? 'ต้องการการตรวจสอบจาก Admin' : 'ตรวจสอบครบถ้วนทุกรายการ'}
          </div>
        </div>
      </div>

      {/* Grid: Variety Breakdown & Top Farms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Variety Distribution */}
        <div className="bg-panel rounded-3xl p-5 border border-line-soft shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gold" />
              สัดส่วนผลผลิตแยกตามสายพันธุ์
            </h3>
            <span className="text-xs text-fg-3">โดยประมาณ</span>
          </div>

          <div className="space-y-3.5">
            {varietyStats.map((item, idx) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gold" />
                    {item.name}
                  </span>
                  <span className="text-fg-3 font-mono font-bold">
                    {item.percentage}% ({item.val.toLocaleString()} ลูก)
                  </span>
                </div>
                <div className="w-full bg-well rounded-full h-2.5 overflow-hidden border border-line-soft">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor:
                        idx === 0
                          ? '#E5A93C'
                          : idx === 1
                          ? '#4ADE80'
                          : idx === 2
                          ? '#38BDF8'
                          : idx === 3
                          ? '#F472B6'
                          : '#A78BFA',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Performing Farms Leaderboard */}
        <div className="bg-panel rounded-3xl p-5 border border-line-soft shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-gold fill-gold" />
              5 อันดับฟาร์มผลผลิตสูงสุด
            </h3>
            <span className="text-xs text-fg-3">Leaderboard</span>
          </div>

          <div className="space-y-2.5">
            {topFarms.map((farm, idx) => (
              <div
                key={farm.id}
                onClick={() => onSelectFarm(farm)}
                className="p-3 bg-[#0d2a1b] hover:bg-[#123623] border border-[#1e5236] rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      idx === 0
                        ? 'bg-gold text-gold-ink'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-900'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-line-soft text-fg-3'
                    }`}
                  >
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {farm.name}
                    </h4>
                    <p className="text-[11px] text-fg-3 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gold" />
                      <span>{farm.province}</span>
                      <span>• {farm.totalTrees} ต้น</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <div className="text-xs font-bold text-gold font-mono">
                      {(farm.harvestedFruits || 0).toLocaleString()} ลูก
                    </div>
                    <div className="text-[10px] text-fg-3">
                      ⭐ {farm.rating?.toFixed(1) || '5.0'}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-fg-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Province Ranking Table */}
      <div className="bg-panel rounded-3xl p-5 border border-line-soft shadow-xl text-white">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-gold" />
          สรุปผลผลิตแยกตามจังหวัดทั่วประเทศ
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line-soft text-xs uppercase text-fg-3 font-semibold">
                <th className="py-3 px-4">จังหวัด</th>
                <th className="py-3 px-4">จำนวนฟาร์ม</th>
                <th className="py-3 px-4">จำนวนต้น</th>
                <th className="py-3 px-4">ผลผลิตที่เก็บเกี่ยว</th>
                <th className="py-3 px-4 text-right">สัดส่วน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft/50">
              {provinceStats.map((item) => {
                const percentage = totalHarvested > 0 ? ((item.harvested / totalHarvested) * 100).toFixed(1) : '0';
                return (
                  <tr key={item.province} className="hover:bg-[#0e311f]/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <span>🇹🇭</span>
                      <span>{item.province}</span>
                    </td>
                    <td className="py-3.5 px-4 text-fg-3">{item.count} สวน</td>
                    <td className="py-3.5 px-4 text-fg-3 font-mono">
                      {item.trees.toLocaleString()} ต้น
                    </td>
                    <td className="py-3.5 px-4 text-gold font-bold font-mono">
                      {item.harvested.toLocaleString()} ลูก
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 bg-well rounded-full h-2 overflow-hidden hidden sm:block border border-line-soft">
                          <div
                            className="bg-gold h-full rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-fg-3">{percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

