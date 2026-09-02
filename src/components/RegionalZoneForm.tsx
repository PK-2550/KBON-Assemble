import React, { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save, X } from 'lucide-react';
import { THAILAND_PROVINCES_ALL } from '../constants/provinces';
import { cleanZoneName } from '../shared/regionalZoneName';
import {
  createRegionalZone,
  updateRegionalZone,
  type RegionalZone,
  type SimilarZone,
  type RegionalZoneWriteResult,
} from '../services/regionalCertificationService';

/**
 * ฟอร์มสร้างและแก้ไขโซนใบรับรองระดับภูมิภาค
 *
 * เปิดจากการ์ดคำขอในหน้าจับคู่ ซึ่งเป็นนาทีที่แอดมินเพิ่งรู้ตัวว่าไม่มีโซนไหนตรง
 * ข้อมูลที่ต้องกรอกอยู่ตรงหน้าอยู่แล้วทั้งหมด จึงเติมให้จากคำขอเลย
 * ถ้าให้จำแล้วไปพิมพ์ใหม่ที่หน้าอื่น นั่นคือทางที่ทำให้พิมพ์ผิดจนเกิดโซนซ้ำ
 *
 * ไม่เปิดให้เลือกประเภทใบ ตอนสร้างจากคำขอประเภทถูกกำหนดโดยคำขอนั้น
 * ส่วนตอนแก้ไข การเปลี่ยนประเภทจะทำให้สวนทุกแห่งที่ผูกอยู่เปลี่ยนชนิดตรา
 * ไปพร้อมกันเงียบ ๆ ฝั่งเซิร์ฟเวอร์จึงไม่รับค่านั้นอยู่แล้ว
 */

export interface RegionalZoneFormValues {
  regionName: string;
  province: string;
  certNumber: string;
  issuingAuthority: string;
  validUntil: string;
}

interface RegionalZoneFormProps {
  mode: 'create' | 'edit';
  /** จำเป็นเมื่อ mode เป็น edit */
  zoneId?: number;
  typeCode: string;
  typeNameTh: string;
  initial: RegionalZoneFormValues;
  /** โซนที่มีอยู่แล้วทั้งหมด ใช้เตือนตั้งแต่ก่อนพิมพ์ว่าจังหวัดนี้มีอะไรอยู่ */
  existingZones: RegionalZone[];
  onSaved: (zone: RegionalZone) => void;
  onCancel: () => void;
}

const FIELD_CLASS =
  'w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs text-white placeholder:text-fg-2 focus:outline-none focus:border-leaf';

export const RegionalZoneForm: React.FC<RegionalZoneFormProps> = ({
  mode,
  zoneId,
  typeCode,
  typeNameTh,
  initial,
  existingZones,
  onSaved,
  onCancel,
}) => {
  const [values, setValues] = useState<RegionalZoneFormValues>(initial);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [similarZones, setSimilarZones] = useState<SimilarZone[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const set = (key: keyof RegionalZoneFormValues) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // เปลี่ยนค่าแล้วคำเตือนรอบก่อนอาจไม่จริงอีกต่อไป ต้องให้เซิร์ฟเวอร์ตัดสินใหม่
    setError('');
    setSimilarZones(null);
    setConfirmed(false);
  };

  /**
   * โซนของประเภทเดียวกันที่อยู่ในจังหวัดที่เลือกไว้
   *
   * แสดงตั้งแต่ตอนเลือกจังหวัด ไม่ต้องรอกดบันทึกแล้วให้เซิร์ฟเวอร์บอก
   * ซ้ำส่วนใหญ่จะไม่ถูกพิมพ์ตั้งแต่แรก
   *
   * ตัดโซนที่กำลังแก้ไขอยู่ออก ไม่งั้นทุกครั้งที่เปิดฟอร์มแก้ไขจะขึ้นคำเตือน
   * ว่าจังหวัดนี้มีโซนอยู่แล้ว ซึ่งก็คือตัวมันเอง
   */
  const zonesInProvince = useMemo(
    () =>
      existingZones.filter(
        (z) => z.typeCode === typeCode && z.province === values.province && z.id !== zoneId
      ),
    [existingZones, typeCode, values.province, zoneId]
  );

  const trimmedName = cleanZoneName(values.regionName);

  // ต้องมีชื่อเสมอ และถ้าเซิร์ฟเวอร์เตือนว่าอาจซ้ำ ต้องติ๊กยืนยันก่อน
  // ไม่ใช่กดซ้ำอีกครั้งแล้วผ่านไปเอง
  const canSave = trimmedName.length > 0 && !isBusy && (similarZones === null || confirmed);

  const handleSave = async () => {
    setIsBusy(true);
    setError('');
    try {
      const payload = {
        regionName: values.regionName,
        province: values.province,
        certNumber: values.certNumber,
        issuingAuthority: values.issuingAuthority,
        validUntil: values.validUntil,
        ...(confirmed ? { confirmDuplicate: true } : {}),
      };

      const result: RegionalZoneWriteResult =
        mode === 'edit' && zoneId
          ? await updateRegionalZone(zoneId, payload)
          : await createRegionalZone({ ...payload, certificationTypeCode: typeCode });

      // เทียบกับ false ตรง ๆ ไม่ใช้ค่าความจริงเฉย ๆ เพราะโปรเจกต์นี้ไม่ได้เปิด
      // strict ของ TypeScript ซึ่งทำให้การแคบชนิดด้วยค่าความจริงของ boolean
      // ไม่ทำงาน แล้วจะอ่านฟิลด์ของฝั่งที่ล้มเหลวไม่ได้เลย
      if (result.ok === false) {
        setError(result.error);
        // เฉพาะคำเตือนเรื่องจังหวัดที่ข้ามได้ด้วยการยืนยัน
        // ชื่อกับเลขที่ซ้ำเป็นด่านแข็งที่ไม่มีทางข้าม
        setSimilarZones(result.code === 'SIMILAR_ZONE_EXISTS' ? (result.zones ?? []) : null);
        return;
      }

      onSaved(result.zone);
    } finally {
      setIsBusy(false);
    }
  };

  const id = (field: string) => `zone-${mode}-${zoneId ?? 'new'}-${field}`;

  return (
    <div className="p-3.5 bg-well border border-gold/40 rounded-2xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-gold text-xs">
          {mode === 'edit' ? 'แก้ไขโซน' : 'สร้างโซนใหม่'} · {typeNameTh}
        </p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="ปิดฟอร์มโซน"
          className="p-1 text-fg-2 hover:text-white cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="sm:col-span-2">
          <label htmlFor={id('name')} className="block text-[11px] text-fg-2 mb-1">
            ชื่อโซน (ตามทะเบียนใบรับรอง)
          </label>
          <input
            id={id('name')}
            type="text"
            value={values.regionName}
            onChange={(e) => set('regionName')(e.target.value)}
            placeholder="เช่น ทุเรียนภูเขาไฟศรีสะเกษ"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor={id('province')} className="block text-[11px] text-fg-2 mb-1">
            จังหวัดที่โซนครอบคลุม
          </label>
          <select
            id={id('province')}
            value={values.province}
            onChange={(e) => set('province')(e.target.value)}
            className={`${FIELD_CLASS} cursor-pointer`}
          >
            <option value="">เลือกจังหวัด...</option>
            {THAILAND_PROVINCES_ALL.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={id('cert')} className="block text-[11px] text-fg-2 mb-1">
            เลขที่ใบรับรอง
          </label>
          <input
            id={id('cert')}
            type="text"
            value={values.certNumber}
            onChange={(e) => set('certNumber')(e.target.value)}
            className={`${FIELD_CLASS} font-mono`}
          />
        </div>

        <div>
          <label htmlFor={id('authority')} className="block text-[11px] text-fg-2 mb-1">
            หน่วยงานผู้ออกใบรับรอง
          </label>
          <input
            id={id('authority')}
            type="text"
            value={values.issuingAuthority}
            onChange={(e) => set('issuingAuthority')(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor={id('valid')} className="block text-[11px] text-fg-2 mb-1">
            ใช้ได้ถึง (ปี พ.ศ. หรือวันที่)
          </label>
          <input
            id={id('valid')}
            type="text"
            value={values.validUntil}
            onChange={(e) => set('validUntil')(e.target.value)}
            placeholder="เช่น 2573"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {/* เตือนตั้งแต่ก่อนพิมพ์ว่าจังหวัดนี้มีโซนอะไรอยู่แล้ว */}
      {similarZones === null && zonesInProvince.length > 0 && (
        <div
          data-testid="existing-zone-hint"
          className="p-2.5 bg-panel border border-line rounded-xl space-y-1"
        >
          <p className="text-[11px] text-fg-2">
            จังหวัด{values.province}มีโซนของมาตรฐานนี้อยู่แล้ว ตรวจก่อนว่าไม่ใช่โซนเดียวกัน
          </p>
          <ul className="space-y-0.5">
            {zonesInProvince.map((z) => (
              <li key={z.id} className="text-[11px] text-white">
                {z.regionName}
                {z.certNumber ? (
                  <>
                    {' · '}
                    <span className="font-mono text-fg-2">{z.certNumber}</span>
                  </>
                ) : null}
                <span className="text-fg-2"> · ผูกอยู่ {z.linkedFarmCount} สวน</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-xl space-y-2">
          <p className="flex items-start gap-1.5 text-[11px] font-bold text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{error}</span>
          </p>

          {similarZones !== null && (
            <>
              <ul className="space-y-0.5 pl-5">
                {similarZones.map((z) => (
                  <li key={z.id} className="text-[11px] text-white">
                    {z.regionName}
                    {z.certNumber ? (
                      <>
                        {' · '}
                        <span className="font-mono text-fg-2">{z.certNumber}</span>
                      </>
                    ) : null}
                    <span className="text-fg-2"> · ผูกอยู่ {z.linkedFarmCount} สวน</span>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-[11px] text-white cursor-pointer pl-5">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="cursor-pointer"
                />
                <span>ยืนยันว่าเป็นคนละโซนกับที่มีอยู่</span>
              </label>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-bold bg-surface hover:bg-surface-2 border border-line text-fg-2 hover:text-white rounded-lg cursor-pointer transition-colors"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="px-4 py-1.5 text-xs font-black bg-gradient-to-r from-gold to-[#c28723] hover:from-[#f0b548] hover:to-gold-hi text-gold-ink rounded-lg shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>บันทึกโซน</span>
        </button>
      </div>
    </div>
  );
};
