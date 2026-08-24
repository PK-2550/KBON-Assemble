import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Crosshair,
  ExternalLink,
  Link as LinkIcon,
  Check,
  Globe,
  Sparkles,
  Info,
} from 'lucide-react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface FarmLocationPickerProps {
  province: string;
  district: string;
  coordinates: Coordinates;
  googleMapsUrl?: string;
  onChange: (coords: Coordinates, mapUrl?: string) => void;
  farmName?: string;
}

// Approximate province center coordinates for Thailand
const PROVINCE_COORDINATES: Record<string, Coordinates> = {
  'จันทบุรี': { lat: 12.6114, lng: 102.1039 },
  'ระยอง': { lat: 12.6814, lng: 101.2816 },
  'ตราด': { lat: 12.2428, lng: 102.5175 },
  'ชุมพร': { lat: 10.4930, lng: 99.1800 },
  'สุราษฎร์ธานี': { lat: 9.1382, lng: 99.3217 },
  'นครศรีธรรมราช': { lat: 8.4304, lng: 99.9631 },
  'ยะลา': { lat: 6.5411, lng: 101.2813 },
  'สงขลา': { lat: 7.1756, lng: 100.6143 },
  'พัทลุง': { lat: 7.6167, lng: 100.0833 },
  'พังงา': { lat: 8.4509, lng: 98.5255 },
  'กระบี่': { lat: 8.0863, lng: 98.9063 },
  'ศรีสะเกษ': { lat: 15.1186, lng: 104.3220 },
  'อุบลราชธานี': { lat: 15.2449, lng: 104.8473 },
  'บุรีรัมย์': { lat: 14.9930, lng: 103.1029 },
  'นครราชสีมา': { lat: 14.9799, lng: 102.0978 },
  'เชียงใหม่': { lat: 18.7883, lng: 98.9853 },
  'อุตรดิตถ์': { lat: 17.6201, lng: 100.0993 },
  'ประจวบคีรีขันธ์': { lat: 11.8124, lng: 99.7972 },
  'นนทบุรี': { lat: 13.8621, lng: 100.5144 },
  'กรุงเทพมหานคร': { lat: 13.7563, lng: 100.5018 },
  'ปราจีนบุรี': { lat: 14.0510, lng: 101.3716 },
};

/**
 * Extract lat/lng from various Google Maps link formats or plain coordinates
 */
export function parseCoordinatesFromInput(input: string): Coordinates | null {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();

  // 1. Plain "lat, lng" or "lat lng" (e.g. "12.6114, 102.1039" or "12.611400 102.103900")
  const plainMatch = str.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
  if (plainMatch) {
    const lat = parseFloat(plainMatch[1]);
    const lng = parseFloat(plainMatch[3]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
  }

  // 2. Google Maps URLs with @lat,lng (e.g. https://www.google.com/maps/@12.6114,102.1039,15z)
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
  }

  // 3. Google Maps URLs with ?q=lat,lng or &q=lat,lng or query=lat,lng
  const queryMatch = str.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
  }

  // 4. Google Maps destination / place URLs (e.g. /destination/12.6114,102.1039)
  const destMatch = str.match(/destination=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (destMatch) {
    const lat = parseFloat(destMatch[1]);
    const lng = parseFloat(destMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    }
  }

  return null;
}

export const FarmLocationPicker: React.FC<FarmLocationPickerProps> = ({
  province,
  district,
  coordinates,
  googleMapsUrl: initialGoogleMapsUrl = '',
  onChange,
  farmName = 'สวนทุเรียน',
}) => {
  const [mapInputUrl, setMapInputUrl] = useState<string>(initialGoogleMapsUrl || '');
  const [isLocating, setIsLocating] = useState(false);
  const [parsedSuccess, setParsedSuccess] = useState<boolean>(false);

  // Auto-center coordinates when province changes if coordinates are at default
  useEffect(() => {
    if (province && PROVINCE_COORDINATES[province]) {
      const defaultCoord = PROVINCE_COORDINATES[province];
      if (
        !coordinates.lat ||
        !coordinates.lng ||
        (coordinates.lat === 12.6114 &&
          coordinates.lng === 102.1039 &&
          province !== 'จันทบุรี')
      ) {
        onChange(defaultCoord, mapInputUrl);
      }
    }
  }, [province]);

  // Handle URL or Coordinate text paste/change
  const handleMapInputChange = (val: string) => {
    setMapInputUrl(val);
    const parsed = parseCoordinatesFromInput(val);
    if (parsed) {
      onChange(parsed, val);
      setParsedSuccess(true);
      setTimeout(() => setParsedSuccess(false), 2500);
    } else {
      // Still pass mapUrl so user can store their custom link even if shortened
      onChange(coordinates, val);
    }
  };

  const handleGetCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (province && PROVINCE_COORDINATES[province]) {
        const defaultCoord = PROVINCE_COORDINATES[province];
        const newUrl = `https://www.google.com/maps?q=${defaultCoord.lat},${defaultCoord.lng}`;
        setMapInputUrl(newUrl);
        onChange(defaultCoord, newUrl);
      }
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const newCoords = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        const newUrl = `https://www.google.com/maps?q=${newCoords.lat},${newCoords.lng}`;
        setMapInputUrl(newUrl);
        onChange(newCoords, newUrl);
        setParsedSuccess(true);
        setTimeout(() => setParsedSuccess(false), 2500);
      },
      (error) => {
        setIsLocating(false);
        console.warn('Geolocation error:', error);
        if (province && PROVINCE_COORDINATES[province]) {
          const defaultCoord = PROVINCE_COORDINATES[province];
          const newUrl = `https://www.google.com/maps?q=${defaultCoord.lat},${defaultCoord.lng}`;
          setMapInputUrl(newUrl);
          onChange(defaultCoord, newUrl);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const directGoogleMapOpenUrl =
    mapInputUrl && (mapInputUrl.startsWith('http://') || mapInputUrl.startsWith('https://'))
      ? mapInputUrl
      : `https://www.google.com/maps?q=${coordinates.lat || 12.6114},${coordinates.lng || 102.1039}`;

  const searchLocationQuery = encodeURIComponent(
    `${farmName} ${district || ''} ${province || ''} ประเทศไทย`.trim()
  );
  const openSearchOnGoogleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${searchLocationQuery}`;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold text-white flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>พิกัดแปลงจริงบน Google Maps (Google Maps Location)</span>
            <span className="text-rose-400">*</span>
          </label>
          <p className="text-[11px] text-[#83A893]">
            วางลิงก์ Google Maps ของสวน หรือกดดึงพิกัดจากเครื่อง (GPS)
          </p>
        </div>

        {/* GPS Current Location button */}
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#143523] hover:bg-[#1a462e] border border-[#4ADE80]/40 text-[#4ADE80] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
          title="ดึงพิกัดตำแหน่งปัจจุบันจากอุปกรณ์ของคุณ"
        >
          {isLocating ? (
            <>
              <Crosshair className="w-3.5 h-3.5 animate-spin text-[#4ADE80]" />
              <span>กำลังดึงพิกัด...</span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5 text-[#4ADE80]" />
              <span>ดึงพิกัดจากเครื่อง (GPS)</span>
            </>
          )}
        </button>
      </div>

      {/* Main Google Maps Link Input Box */}
      <div className="p-3.5 bg-[#092215] border border-[#1c442c] rounded-2xl space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-[#4ADE80]" />
              <span>วางลิงก์ Google Maps แปลงสวน</span>
            </span>
            {parsedSuccess && (
              <span className="text-[10px] text-[#4ADE80] font-bold flex items-center gap-1 bg-[#143523] px-2 py-0.5 rounded-full border border-[#235b3a]">
                <Check className="w-3 h-3" />
                <span>ดึงพิกัดสำเร็จ</span>
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="วางลิงก์ Google Maps เช่น https://maps.app.goo.gl/... หรือแชร์พิกัดจาก Google Maps"
              value={mapInputUrl}
              onChange={(e) => handleMapInputChange(e.target.value)}
              className="w-full pl-3.5 pr-24 py-2.5 bg-[#04140b] border border-[#1c442c] rounded-xl text-white placeholder-[#527861] focus:outline-hidden focus:border-[#4ADE80] text-xs font-mono"
            />
            <div className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1">
              <a
                href={directGoogleMapOpenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-[#143523] hover:bg-[#1e4c33] text-[#4ADE80] hover:text-white border border-[#235b3a] rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="เปิดตรวจสอบพิกัดนี้บน Google Maps"
              >
                <ExternalLink className="w-3 h-3" />
                <span>เปิดดู</span>
              </a>
            </div>
          </div>
        </div>

        {/* Quick Helper: Open Google Maps to Find Orchard */}
        <div className="p-2.5 bg-[#04140b] rounded-xl border border-[#1c442c] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#83A893]">
            <Info className="w-4 h-4 text-[#E5A93C] shrink-0" />
            <span className="text-[11px]">
              ยังไม่มีลิงก์? ค้นหาและคัดลอกลิงก์แปลงสวนใน Google Maps ได้ทันที
            </span>
          </div>

          <a
            href={openSearchOnGoogleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gradient-to-r from-[#E5A93C] to-[#c78b23] hover:from-[#f3b544] hover:to-[#d89828] text-[#1c1202] rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all shadow-xs cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>ไปค้นหาใน Google Maps</span>
          </a>
        </div>
      </div>
    </div>
  );
};
