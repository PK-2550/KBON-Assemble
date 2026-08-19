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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#092215] rounded-3xl p-5 border border-[#18422b] shadow-xl text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#8DA796]">ผลผลิตรวมทั้งระบบ</span>
            <div className="w-8 h-8 rounded-xl bg-[#0e311f] border border-[#1e5236] text-[#E5A93C] flex items-center justify-center">
              <Sprout className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {totalHarvested.toLocaleString()}{' '}
            <span className="text-sm font-medium text-[#8DA796]">ลูก</span>
          </div>
          <div className="text-xs text-[#E5A93C] font-semibold mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +12.4% เทียบกับฤดูกาลก่อน
          </div>
        </div>

        <div className="bg-[#092215] rounded-3xl p-5 border border-[#18422b] shadow-xl text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#8DA796]">จำนวนต้นทุเรียนขึ้นทะเบียน</span>
            <div className="w-8 h-8 rounded-xl bg-[#0e311f] border border-[#1e5236] text-[#E5A93C] flex items-center justify-center">
              <Trees className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {totalTrees.toLocaleString()}{' '}
            <span className="text-sm font-medium text-[#8DA796]">ต้น</span>
          </div>
          <div className="text-xs text-[#8DA796] font-medium mt-2">
            เฉลี่ย {avgYieldPerTree} ลูก/ต้น/ปี
          </div>
        </div>

        <div className="bg-[#092215] rounded-3xl p-5 border border-[#18422b] shadow-xl text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#8DA796]">ฟาร์มมาตรฐาน GI / GAP</span>
            <div className="w-8 h-8 rounded-xl bg-[#0e311f] border border-[#1e5236] text-[#E5A93C] flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {farms.filter((f) => f.certifications && f.certifications.length > 0).length}{' '}
            <span className="text-sm font-medium text-[#8DA796]">/ {farms.length} ฟาร์ม</span>
          </div>
          <div className="text-xs text-[#E5A93C] font-semibold mt-2">
            100% ผ่านเกณฑ์ควบคุมคุณภาพ
          </div>
        </div>
      </div>

      {/* Province Ranking Table */}
      <div className="bg-[#092215] rounded-3xl p-5 border border-[#18422b] shadow-xl text-white">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#E5A93C]" />
          สรุปผลผลิตแยกตามจังหวัด
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#18422b] text-xs uppercase text-[#8DA796] font-semibold">
                <th className="py-3 px-4">จังหวัด</th>
                <th className="py-3 px-4">จำนวนฟาร์ม</th>
                <th className="py-3 px-4">จำนวนต้น</th>
                <th className="py-3 px-4">ผลผลิตที่เก็บเกี่ยว</th>
                <th className="py-3 px-4 text-right">สัดส่วน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18422b]/50">
              {provinceStats.map((item) => {
                const percentage = totalHarvested > 0 ? ((item.harvested / totalHarvested) * 100).toFixed(1) : '0';
                return (
                  <tr key={item.province} className="hover:bg-[#0e311f]/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <span>🇹🇭</span>
                      <span>{item.province}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#8DA796]">{item.count} สวน</td>
                    <td className="py-3.5 px-4 text-[#8DA796] font-mono">
                      {item.trees.toLocaleString()} ต้น
                    </td>
                    <td className="py-3.5 px-4 text-[#E5A93C] font-bold font-mono">
                      {item.harvested.toLocaleString()} ลูก
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 bg-[#04140b] rounded-full h-2 overflow-hidden hidden sm:block border border-[#18422b]">
                          <div
                            className="bg-[#E5A93C] h-full rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-[#8DA796]">{percentage}%</span>
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
