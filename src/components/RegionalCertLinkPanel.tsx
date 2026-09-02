import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Loader2, MapPin, Link2, XCircle, CheckCircle2, Info, Plus, Pencil, Settings2 } from 'lucide-react';
import {
  fetchRegionalZones,
  fetchPendingRegionalCertRequests,
  linkRegionalCertRequest,
  rejectRegionalCertRequest,
  type RegionalZone,
  type RegionalCertRequest,
} from '../services/regionalCertificationService';
import { RegionalZoneForm } from './RegionalZoneForm';

/**
 * จับคู่คำขอใบรับรองระดับโซนเข้ากับโซนจริง
 *
 * ใบอย่าง GI เป็นของโซนภูมิศาสตร์ ไม่ใช่ของสวนรายตัว สวนหลายแห่งในโซนเดียวกัน
 * ใช้ใบเดียวกัน ตอนอนุมัติคำขอสมัคร ระบบจึงไม่มีทางรู้เองว่าสวนนี้ควรอยู่โซนไหน
 * และเขียนลงตารางใบของสวนก็ไม่ได้
 *
 * คำขอพวกนี้ถูกเก็บค้างไว้ตั้งแต่ 014 แต่ไม่มีหน้าจอไหนเปิดดูได้ ต้องเปิด psql
 * มาสั่ง SQL เอง ผลจากมุมเจ้าของสวนคือกรอกใบ GI ไปแล้วตราไม่เคยขึ้น
 * ซึ่งไม่ต่างอะไรกับตอนที่ใบถูกข้ามทิ้งเงียบ ๆ
 */

/** วันที่แบบไทย ใช้แสดงว่าคำขอค้างมานานแค่ไหน */
function thaiDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface RegionalCertLinkPanelProps {
  /** แจ้งกลับเมื่อคำขอหนึ่งถูกจัดการเสร็จ ให้ตัวนับบนแท็บอัปเดตตาม */
  onResolved?: () => void;
}

export const RegionalCertLinkPanel: React.FC<RegionalCertLinkPanelProps> = ({ onResolved }) => {
  const [zones, setZones] = useState<RegionalZone[]>([]);
  const [requests, setRequests] = useState<RegionalCertRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // สถานะรายคำขอ เก็บเป็น map เพราะแอดมินเปิดหลายคำขอค้างไว้พร้อมกันได้
  const [zoneChoice, setZoneChoice] = useState<Record<number, string>>({});
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorById, setErrorById] = useState<Record<number, string>>({});
  const [successToast, setSuccessToast] = useState('');

  /**
   * คำขอที่กำลังเปิดฟอร์มสร้างโซนใหม่อยู่
   *
   * ฟอร์มอยู่ในการ์ดคำขอ ไม่ใช่หน้าแยก เพราะนี่คือนาทีที่แอดมินเพิ่งรู้ตัว
   * ว่าไม่มีโซนไหนตรง และข้อมูลที่ต้องกรอกทั้งหมดอยู่ในคำขอตรงหน้าอยู่แล้ว
   */
  const [creatingForRequestId, setCreatingForRequestId] = useState<number | null>(null);

  // รายชื่อโซนทั้งหมดสำหรับตอนตั้งใจมาแก้ชื่อ ไม่ได้มาจากคำขอ
  const [isZoneListOpen, setIsZoneListOpen] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [z, r] = await Promise.all([
        fetchRegionalZones(),
        fetchPendingRegionalCertRequests(),
      ]);
      setZones(z);
      setRequests(r);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'โหลดรายการคำขอไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // ตัวตรวจมองไม่ทะลุ async จึงนับว่าเป็นการ setState แบบทันทีใน effect
    // การดึงข้อมูลตอน mount คือกรณีที่กฎข้อนี้อนุญาตไว้เอง
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /**
   * โซนที่เลือกได้ แยกตามประเภทใบ
   *
   * เซิร์ฟเวอร์กันการจับคู่ข้ามประเภทไว้อยู่แล้ว แต่ถ้าหน้าจอยังให้เลือกได้
   * แอดมินจะกดแล้วเจอ error โดยไม่รู้ว่าตัวเองทำอะไรผิด
   */
  const zonesByType = useMemo(() => {
    const map = new Map<string, RegionalZone[]>();
    for (const z of zones) {
      const list = map.get(z.typeCode) ?? [];
      list.push(z);
      map.set(z.typeCode, list);
    }
    return map;
  }, [zones]);

  const setError = (id: number, message: string) =>
    setErrorById((prev) => ({ ...prev, [id]: message }));

  const clearError = (id: number) =>
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  /** เอาคำขอที่จัดการเสร็จแล้วออกจากรายการที่รอ ไม่ต้องโหลดใหม่ทั้งกอง */
  const removeRequest = (id: number) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    onResolved?.();
  };

  /**
   * โซนที่เพิ่งสร้างเสร็จ
   *
   * เติมเข้ารายการเองแทนการโหลดใหม่ทั้งกอง แล้วเลือกไว้ให้กับคำขอที่เป็นต้นเรื่อง
   * เลย เพราะแอดมินเพิ่งสร้างโซนนี้เพื่อคำขอนี้โดยเฉพาะ ไม่มีเหตุผลให้ต้องไป
   * ไล่หาในรายการเพื่อเลือกซ้ำอีกครั้ง
   */
  const handleZoneCreated = (zone: RegionalZone, requestId: number) => {
    setZones((prev) => [...prev, zone]);
    setZoneChoice((prev) => ({ ...prev, [requestId]: String(zone.id) }));
    setCreatingForRequestId(null);
    setSuccessToast(`สร้างโซน ${zone.regionName} แล้ว เลือกไว้ให้เรียบร้อย`);
  };

  const handleZoneUpdated = (zone: RegionalZone) => {
    setZones((prev) => prev.map((z) => (z.id === zone.id ? zone : z)));
    setEditingZoneId(null);
    setSuccessToast(`บันทึกโซน ${zone.regionName} แล้ว`);
  };

  const handleLink = async (req: RegionalCertRequest) => {
    const zoneId = Number(zoneChoice[req.id]);
    if (!zoneId) return;

    setBusyId(req.id);
    clearError(req.id);
    try {
      await linkRegionalCertRequest(req.id, zoneId);
      const zone = zones.find((z) => z.id === zoneId);
      removeRequest(req.id);
      setSuccessToast(`จับคู่ ${req.farmName} เข้ากับโซน ${zone?.regionName ?? ''} เรียบร้อย`);
    } catch (err) {
      // ไม่เอาคำขอออกจากรายการเมื่อล้มเหลว ถ้าหายไปทั้งที่เซิร์ฟเวอร์ปฏิเสธ
      // แอดมินจะเข้าใจว่าจัดการเสร็จแล้วทั้งที่ใบยังค้างอยู่
      setError(req.id, err instanceof Error ? err.message : 'จับคู่ไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: RegionalCertRequest) => {
    const notes = rejectNotes.trim();
    if (!notes) return;

    setBusyId(req.id);
    clearError(req.id);
    try {
      await rejectRegionalCertRequest(req.id, notes);
      removeRequest(req.id);
      setRejectingId(null);
      setRejectNotes('');
      setSuccessToast(`ปฏิเสธคำขอใบระดับโซนของ ${req.farmName} แล้ว`);
    } catch (err) {
      setError(req.id, err instanceof Error ? err.message : 'ปฏิเสธไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-xs text-fg-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>กำลังโหลดคำขอที่รอจับคู่โซน...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#05140c] p-3 sm:p-4 space-y-3">
      {successToast && (
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-leaf/50 rounded-xl text-xs font-bold text-leaf">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs font-bold text-rose-300">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-well border border-line rounded-2xl text-[11px] text-fg-2 leading-relaxed">
        <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
        <p>
          ใบรับรองระดับโซนอย่าง GI เป็นของพื้นที่ ไม่ใช่ของสวนรายแปลง
          ระบบจึงบันทึกไว้เป็นคำขอรอให้ผู้ดูแลจับคู่สวนเข้ากับโซนที่ถูกต้อง
          ตราจะขึ้นบนหน้าสวนทันทีที่จับคู่เสร็จ
        </p>
      </div>

      {/*
        รายชื่อโซนทั้งหมด สำหรับตอนที่ตั้งใจมาแก้ชื่อ ไม่ได้มาจากคำขอ

        ชื่อโซนที่ 009 เติมให้เป็นชื่อจังหวัดล้วน ซึ่งไม่ใช่ชื่อจริงของทะเบียน GI
        ก่อนหน้านี้แก้ได้ทาง SQL ทางเดียว
      */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setIsZoneListOpen((open) => !open);
            setEditingZoneId(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-2 border border-line text-fg-2 hover:text-white rounded-xl text-[11px] font-bold cursor-pointer transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>จัดการโซน ({zones.length})</span>
        </button>
      </div>

      {isZoneListOpen && (
        <div className="p-3 bg-well border border-line rounded-2xl space-y-2">
          {zones.length === 0 ? (
            <p className="text-[11px] text-fg-2 text-center py-3">ยังไม่มีโซนในระบบ</p>
          ) : (
            zones.map((zone) =>
              editingZoneId === zone.id ? (
                <RegionalZoneForm
                  key={zone.id}
                  mode="edit"
                  zoneId={zone.id}
                  typeCode={zone.typeCode}
                  typeNameTh={zone.typeNameTh}
                  initial={{
                    regionName: zone.regionName,
                    province: zone.province,
                    certNumber: zone.certNumber,
                    issuingAuthority: zone.issuingAuthority,
                    validUntil: zone.validUntil,
                  }}
                  existingZones={zones}
                  onSaved={handleZoneUpdated}
                  onCancel={() => setEditingZoneId(null)}
                />
              ) : (
                <div
                  key={zone.id}
                  data-testid="zone-row"
                  className="flex items-center justify-between gap-2 p-2.5 bg-panel border border-line rounded-xl"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{zone.regionName}</p>
                    <p className="text-[11px] text-fg-2">
                      <span className="px-1.5 py-0.5 rounded bg-surface-2 text-leaf font-black text-[10px]">
                        {zone.typeCode}
                      </span>
                      {' · '}จังหวัด{zone.province}
                      {zone.certNumber ? (
                        <>
                          {' · '}
                          <span className="font-mono">{zone.certNumber}</span>
                        </>
                      ) : null}
                      {' · ผูกอยู่ '}
                      <span>{zone.linkedFarmCount}</span>
                      {' สวน'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingZoneId(zone.id)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-surface-2 hover:bg-[#1f4c33] text-leaf border border-[#235b3a] rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>แก้ไข</span>
                  </button>
                </div>
              )
            )
          )}
        </div>
      )}

      {requests.length === 0 && !loadError ? (
        <div className="py-12 text-center text-xs text-fg-2 space-y-2 px-4">
          <Award className="w-10 h-10 mx-auto text-line" />
          <p className="font-semibold text-white">ไม่มีคำขอที่รอจับคู่โซน</p>
          <p className="text-[11px]">
            เมื่อมีสวนยื่นใบรับรองระดับโซนเข้ามา รายการจะปรากฏที่นี่
          </p>
        </div>
      ) : (
        requests.map((req) => {
          const options = zonesByType.get(req.typeCode) ?? [];
          const isBusy = busyId === req.id;
          const isRejecting = rejectingId === req.id;

          return (
            <div
              key={req.id}
              data-testid="regional-request-card"
              className="p-3.5 bg-panel border border-line rounded-2xl space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{req.farmName}</p>
                  <p className="flex items-center gap-1 text-[11px] text-fg-2 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>จังหวัด{req.province}</span>
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-surface-2 text-leaf font-black text-[10px] shrink-0">
                  {req.typeCode}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-well p-2.5 rounded-xl border border-line">
                <div>
                  <span className="text-fg-2 text-[11px]">เลขที่ใบรับรอง:</span>
                  <p className="font-mono font-bold text-leaf mt-0.5">{req.certNumber || '-'}</p>
                </div>
                <div>
                  <span className="text-fg-2 text-[11px]">หน่วยงานผู้ออก:</span>
                  <p className="font-bold text-white mt-0.5">{req.issuingAuthority || '-'}</p>
                </div>
                <div>
                  <span className="text-fg-2 text-[11px]">ยื่นเมื่อ:</span>
                  <p className="font-bold text-white mt-0.5">{thaiDate(req.createdAt)}</p>
                </div>
              </div>

              {errorById[req.id] && (
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-rose-300">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorById[req.id]}</span>
                </p>
              )}

              {isRejecting ? (
                <div className="space-y-2">
                  <label
                    className="block text-[11px] font-bold text-rose-300"
                    htmlFor={`reject-notes-${req.id}`}
                  >
                    เหตุผลที่ปฏิเสธ (เจ้าของสวนจะเห็นเหตุผลนี้)
                  </label>
                  <textarea
                    id={`reject-notes-${req.id}`}
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-xs text-white placeholder:text-fg-2 focus:outline-none focus:border-rose-700"
                    placeholder="เช่น เลขที่ใบไม่ตรงกับทะเบียน GI ของกรมทรัพย์สินทางปัญญา"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectNotes('');
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-surface hover:bg-surface-2 border border-line text-fg-2 hover:text-white rounded-lg cursor-pointer transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      disabled={!rejectNotes.trim() || isBusy}
                      onClick={() => handleReject(req)}
                      className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ยืนยันการปฏิเสธ
                    </button>
                  </div>
                </div>
              ) : creatingForRequestId === req.id ? (
                /*
                  ฟอร์มเปิดพร้อมข้อมูลจากคำขอนี้ทั้งหมด ทั้งจังหวัดของสวน
                  เลขที่ใบ และหน่วยงานผู้ออก ถ้าให้จำแล้วไปพิมพ์ใหม่ที่อื่น
                  นั่นคือทางที่ทำให้พิมพ์ผิดจนเกิดโซนซ้ำ
                */
                <RegionalZoneForm
                  mode="create"
                  typeCode={req.typeCode}
                  typeNameTh={req.typeNameTh}
                  initial={{
                    regionName: '',
                    province: req.province,
                    certNumber: req.certNumber,
                    issuingAuthority: req.issuingAuthority,
                    validUntil: '',
                  }}
                  existingZones={zones}
                  onSaved={(zone) => handleZoneCreated(zone, req.id)}
                  onCancel={() => setCreatingForRequestId(null)}
                />
              ) : (
                <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <select
                    aria-label={`เลือกโซนสำหรับ ${req.farmName}`}
                    value={zoneChoice[req.id] ?? ''}
                    disabled={isBusy || options.length === 0}
                    onChange={(e) =>
                      setZoneChoice((prev) => ({ ...prev, [req.id]: e.target.value }))
                    }
                    className="flex-1 px-3 py-2 bg-surface border border-line rounded-xl text-xs text-white cursor-pointer focus:outline-none focus:border-leaf disabled:opacity-50"
                  >
                    <option value="">
                      {options.length === 0
                        ? 'ยังไม่มีโซนของมาตรฐานนี้ในระบบ'
                        : 'เลือกโซนที่ตรงกับสวนนี้...'}
                    </option>
                    {options.map((z) => (
                      <option key={z.id} value={String(z.id)}>
                        {z.regionName} · จังหวัด{z.province} · ผูกอยู่ {z.linkedFarmCount} สวน
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(req.id);
                        setRejectNotes('');
                        clearError(req.id);
                      }}
                      className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                    >
                      ปฏิเสธ
                    </button>
                    <button
                      type="button"
                      disabled={!zoneChoice[req.id] || isBusy}
                      onClick={() => handleLink(req)}
                      className="px-4 py-2 bg-gradient-to-r from-gold to-[#c28723] hover:from-[#f0b548] hover:to-gold-hi text-gold-ink font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5" />
                      )}
                      <span>จับคู่โซน</span>
                    </button>
                  </div>
                </div>

                {/* ทางออกเมื่อไม่มีโซนไหนตรง ซึ่งก่อนหน้านี้ทำได้แค่ปฏิเสธ */}
                <button
                  type="button"
                  onClick={() => {
                    setCreatingForRequestId(req.id);
                    clearError(req.id);
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-leaf hover:text-white cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>ไม่มีโซนที่ตรง? สร้างโซนใหม่จากข้อมูลคำขอนี้</span>
                </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
