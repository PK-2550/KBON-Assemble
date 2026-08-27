import React from 'react';
import { THAILAND_REGIONS, getDistrictsByProvince } from '../constants/provinces';
import { FarmLocationPicker } from './FarmLocationPicker';

interface FarmRegistrationStep3Props {
  farmName: string;
  onFarmNameChange: (value: string) => void;
  farmNameEn: string;
  onFarmNameEnChange: (value: string) => void;
  province: string;
  onProvinceChange: (value: string) => void;
  district: string;
  onDistrictChange: (value: string) => void;
  locationAddress: string;
  onLocationAddressChange: (value: string) => void;
  coordinates: { lat: number; lng: number };
  onCoordinatesChange: (value: { lat: number; lng: number }) => void;
  googleMapsUrl: string;
  onGoogleMapsUrlChange: (value: string) => void;
  areaRai: number;
  onAreaRaiChange: (value: number) => void;
  totalTreesEstimate: number;
  onTotalTreesEstimateChange: (value: number) => void;
  topVarietiesInput: string;
  onTopVarietiesInputChange: (value: string) => void;
}

/**
 * ขั้นที่ 3 ของฟอร์มขึ้นทะเบียนสวน -- ข้อมูลสวน ที่ตั้ง และพิกัดแปลง
 *
 * ไม่มีสถานะของตัวเอง ค่าทั้งหมดมาจาก useFarmRegistrationForm ที่หน้าแม่
 *
 * รายชื่ออำเภอคำนวณในนี้จากจังหวัดที่เลือก เพราะไม่มีส่วนอื่นของฟอร์มใช้
 * เดิมคำนวณใหม่ทุกรอบ render อยู่แล้ว การย้ายมาไว้ตรงนี้จึงให้ผลเท่าเดิม
 */
export const FarmRegistrationStep3: React.FC<FarmRegistrationStep3Props> = ({
  farmName,
  onFarmNameChange,
  farmNameEn,
  onFarmNameEnChange,
  province,
  onProvinceChange,
  district,
  onDistrictChange,
  locationAddress,
  onLocationAddressChange,
  coordinates,
  onCoordinatesChange,
  googleMapsUrl,
  onGoogleMapsUrlChange,
  areaRai,
  onAreaRaiChange,
  totalTreesEstimate,
  onTotalTreesEstimateChange,
  topVarietiesInput,
  onTopVarietiesInputChange,
}) => {
  const availableDistricts = getDistrictsByProvince(province);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-fg-2 mb-1">
            ชื่อฟาร์ม (ภาษาไทย) <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            placeholder="เช่น สวนทุเรียนจันทบูรณ์ พรีเมียม"
            value={farmName}
            onChange={(e) => onFarmNameChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-fg-2 mb-1">
            ชื่อฟาร์ม (English - ถ้ามี)
          </label>
          <input
            type="text"
            placeholder="e.g. Chanthaburi Durian Orchard"
            value={farmNameEn}
            onChange={(e) => onFarmNameEnChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs"
          />
        </div>
      </div>

      {/* Province & District Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-fg-2 mb-1">
            จังหวัด <span className="text-rose-400">*</span>
          </label>
          <select
            value={province}
            onChange={(e) => {
              const newProv = e.target.value;
              onProvinceChange(newProv);
              const districts = getDistrictsByProvince(newProv);
              if (districts.length > 0) {
                onDistrictChange(districts[0]);
              }
            }}
            className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs"
          >
            {THAILAND_REGIONS.map((region) => (
              <optgroup key={region.region} label={region.region}>
                {region.provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-fg-2 mb-1">
            อำเภอ/เขต <span className="text-rose-400">*</span>
          </label>
          <select
            value={district}
            onChange={(e) => onDistrictChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs"
          >
            {availableDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-fg-2 mb-1">
          ที่อยู่แปลงปลูกโดยละเอียด
        </label>
        <input
          type="text"
          placeholder="เช่น 12/4 หมู่ 3 ต.เขาวัว อ.ท่าใหม่"
          value={locationAddress}
          onChange={(e) => onLocationAddressChange(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-leaf text-xs"
        />
      </div>

      {/* Interactive GPS Location Picker Component */}
      <div className="pt-1">
        <FarmLocationPicker
          province={province}
          district={district}
          coordinates={coordinates}
          googleMapsUrl={googleMapsUrl}
          onChange={(coords, mapUrl) => {
            onCoordinatesChange(coords);
            if (mapUrl !== undefined) {
              onGoogleMapsUrlChange(mapUrl);
            }
          }}
          farmName={farmName || 'สวนทุเรียน'}
        />
      </div>

      {/* Farm Size & Estimates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div>
          <label className="block text-xs font-bold text-fg-2 mb-1">
            พื้นที่แปลง (ไร่)
          </label>
          <input
            type="number"
            min={1}
            value={areaRai}
            onChange={(e) => onAreaRaiChange(Number(e.target.value) || 1)}
            className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-fg-2 mb-1">
            จำนวนต้นโดยประมาณ
          </label>
          <input
            type="number"
            min={1}
            value={totalTreesEstimate}
            onChange={(e) => onTotalTreesEstimateChange(Number(e.target.value) || 10)}
            className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-fg-2 mb-1">
            พันธุ์ทุเรียนหลัก
          </label>
          <input
            type="text"
            placeholder="หมอนทอง, ก้านยาว, ชะนี"
            value={topVarietiesInput}
            onChange={(e) => onTopVarietiesInputChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-well border border-line rounded-xl text-white focus:outline-hidden focus:border-leaf text-xs"
          />
        </div>
      </div>
    </div>
  );
};
