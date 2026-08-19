import React from 'react';
import { Trees, Sprout, Star, Award, TrendingUp, MapPin } from 'lucide-react';
import { DurianFarm } from '../types';

interface DashboardViewProps {
  farms: DurianFarm[];
  onSelectFarm: (farm: DurianFarm) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ farms, onSelectFarm }) => {
  const totalTrees = farms.reduce((acc, f) => acc + f.totalTrees, 0);
  const totalHarvested = farms.reduce((acc, f) => acc + f.harvestedFruits, 0);
  const avgYieldPerTree = totalTrees > 0 ? (totalHarvested / totalTrees).toFixed(1) : '0';

  // Province breakdown
  const provinceStats = React.useMemo(() => {
    const map: Record<string, { count: number; harvested: number; trees: number }> = {};
    farms.forEach((f) => {
      if (!map[f.province]) {
        map[f.province] = { count: 0, harvested: 0, trees: 0 };
      }
      map[f.province].count += 1;
      map[f.province].harvested += f.harvestedFruits;
      map[f.province].trees += f.totalTrees;
    });
    return Object.entries(map)
      .map(([province, data]) => ({ province, ...data }))
      .sort((a, b) => b.harvested - a.harvested);
  }, [farms]);

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-500">ผลผลิตรวมทั้งระบบ</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Sprout className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
            {totalHarvested.toLocaleString()}{' '}
            <span className="text-base font-medium text-slate-400">ลูก</span>
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +12.4% เทียบกับฤดูกาลก่อน
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-500">จำนวนต้นทุเรียนขึ้นทะเบียน</span>
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <Trees className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
            {totalTrees.toLocaleString()}{' '}
            <span className="text-base font-medium text-slate-400">ต้น</span>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-2">
            เฉลี่ย {avgYieldPerTree} ลูก/ต้น/ปี
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-500">ฟาร์มมาตรฐาน GI / GAP</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
            {farms.filter((f) => f.certifications && f.certifications.length > 0).length}{' '}
            <span className="text-base font-medium text-slate-400">/ {farms.length} ฟาร์ม</span>
          </div>
          <div className="text-xs text-amber-600 font-semibold mt-2">
            100% ผ่านเกณฑ์ควบคุมคุณภาพ
          </div>
        </div>
      </div>

      {/* Province Ranking Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-600" />
          สรุปผลผลิตแยกตามจังหวัด
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-400 font-semibold">
                <th className="py-3 px-4">จังหวัด</th>
                <th className="py-3 px-4">จำนวนฟาร์ม</th>
                <th className="py-3 px-4">จำนวนต้น</th>
                <th className="py-3 px-4">ผลผลิตที่เก็บเกี่ยว</th>
                <th className="py-3 px-4 text-right">สัดส่วน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {provinceStats.map((item) => {
                const percentage = totalHarvested > 0 ? ((item.harvested / totalHarvested) * 100).toFixed(1) : '0';
                return (
                  <tr key={item.province} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800 flex items-center gap-2">
                      <span>🇹🇭</span>
                      <span>{item.province}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{item.count} สวน</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {item.trees.toLocaleString()} ต้น
                    </td>
                    <td className="py-3.5 px-4 text-emerald-600 font-bold font-mono">
                      {item.harvested.toLocaleString()} ลูก
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
                          <div
                            className="bg-emerald-600 h-full rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{percentage}%</span>
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
