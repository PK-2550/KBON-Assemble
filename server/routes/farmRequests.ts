import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { pool } from '../db.js';
import { loadFarms, upsertFarm } from '../farmsRepo.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const farmRequestsRouter = Router();

/** แปลงแถวในตาราง กลับเป็นรูปร่าง FarmRegistrationRequest ที่ frontend ใช้ */
function toRequest(r: Record<string, any>) {
  const payload = r.payload ?? {};
  return {
    id: r.id,
    requestCategory: r.request_category ?? undefined,
    requestType: r.request_type ?? undefined,
    targetFarmId: r.target_farm_id ?? undefined,
    updateNotes: r.update_notes ?? undefined,
    userId: r.user_id,
    userDisplayName: r.user_display_name ?? '',
    userEmailOrUsername: r.user_email_or_username ?? '',
    farmName: r.farm_name,
    farmNameEn: r.farm_name_en ?? undefined,
    province: r.province,
    district: r.district ?? '',
    locationAddress: r.location_address ?? undefined,
    areaRai: r.area_rai ?? 0,
    totalTreesEstimate: r.total_trees_estimate ?? 0,
    topVarieties: r.top_varieties ?? [],
    aboutStory: r.about_story ?? '',
    contact: payload.contact ?? {},
    gapCertNumber: r.gap_cert_number ?? '',
    certIssuedBy: r.cert_issued_by ?? '',
    certValidUntil: r.cert_valid_until ?? '',
    certDocumentPhoto: r.cert_document_photo ?? undefined,
    certificationList: payload.certificationList ?? [],
    otherCerts: r.other_certs ?? [],
    atmospherePhotos: payload.atmospherePhotos ?? [],
    hasSmartFarm: r.has_smart_farm,
    smartTechnologies: payload.smartTechnologies ?? [],
    farmerFullName: r.farmer_full_name ?? undefined,
    farmerIdCardNumber: r.farmer_id_card_number ?? undefined,
    farmerIdCardPhoto: r.farmer_id_card_photo ?? undefined,
    farmerIdCardFileType: r.farmer_id_card_file_type ?? undefined,
    agreedToCriteria: r.agreed_to_criteria,
    coordinates: payload.coordinates ?? undefined,
    googleMapsUrl: r.google_maps_url ?? undefined,
    status: r.status,
    adminNotes: r.admin_notes ?? undefined,
    previousAdminNotes: r.previous_admin_notes ?? undefined,
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedAt: r.reviewed_at?.toISOString?.() ?? undefined,
    resubmittedAt: r.resubmitted_at?.toISOString?.() ?? undefined,
    createdFarmId: r.created_farm_id ?? undefined,
    createdAt: r.created_at?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: r.updated_at?.toISOString?.() ?? new Date().toISOString(),
  };
}

/**
 * รายการคำขอ
 *
 * แอดมินเห็นทั้งหมด ผู้ใช้ทั่วไปเห็นเฉพาะของตัวเอง
 * ของเดิมฝั่ง Firestore ให้ client อ่านทุกคำขอได้ ซึ่งแปลว่าใครก็อ่าน
 * เลขบัตรประชาชนและรูปบัตรของคนอื่นได้ ถ้ารู้ว่าจะดูที่ไหน
 */
farmRequestsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const isAdmin = req.user!.role === 'admin';
  const { rows } = isAdmin
    ? await pool.query('SELECT * FROM farm_requests ORDER BY created_at DESC')
    : await pool.query(
        'SELECT * FROM farm_requests WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user!.uid]
      );
  res.json({ requests: rows.map(toRequest) });
}));

/** คำขอของตัวเองเท่านั้น -- ใช้ในหน้าติดตามสถานะของผู้ใช้ */
farmRequestsRouter.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM farm_requests WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user!.uid]
  );
  res.json({ requests: rows.map(toRequest) });
}));

/**
 * ยื่นคำขอใหม่ หรือส่งแก้ไขคำขอเดิมที่ถูกตีกลับ
 *
 * user_id มาจาก token เสมอ ไม่รับจาก body เพื่อไม่ให้ยื่นคำขอในนามคนอื่นได้
 */
farmRequestsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const b = req.body ?? {};

  if (typeof b.farmName !== 'string' || !b.farmName.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อสวน' });
  }
  if (typeof b.province !== 'string' || !b.province.trim()) {
    return res.status(400).json({ error: 'กรุณาเลือกจังหวัด' });
  }

  const id =
    (typeof b.id === 'string' && b.id.trim()) ||
    (typeof b.existingRequestId === 'string' && b.existingRequestId.trim()) ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const category =
    b.requestCategory ??
    (b.targetFarmId || b.requestType === 'update_farm'
      ? 'farm_verification'
      : b.farmerIdCardNumber
        ? 'manager_application'
        : 'farm_verification');

  // ถ้าเป็นการส่งใหม่หลังถูกตีกลับ ให้เก็บหมายเหตุเดิมของแอดมินไว้ดูย้อนหลัง
  const existing = await pool.query(
    'SELECT status, admin_notes FROM farm_requests WHERE id = $1 AND user_id = $2',
    [id, req.user!.uid]
  );
  const isResubmit = existing.rows.length > 0;

  const payload = {
    contact: b.contact ?? {},
    certificationList: Array.isArray(b.certificationList) ? b.certificationList : [],
    atmospherePhotos: Array.isArray(b.atmospherePhotos) ? b.atmospherePhotos : [],
    smartTechnologies: Array.isArray(b.smartTechnologies) ? b.smartTechnologies : [],
    coordinates: b.coordinates ?? null,
  };

  const { rows } = await pool.query(
    `INSERT INTO farm_requests (
       id, request_category, request_type, target_farm_id, update_notes,
       user_id, user_display_name, user_email_or_username,
       farm_name, farm_name_en, province, district, location_address,
       area_rai, total_trees_estimate, top_varieties, about_story,
       gap_cert_number, cert_issued_by, cert_valid_until, cert_document_photo, other_certs,
       farmer_full_name, farmer_id_card_number, farmer_id_card_photo, farmer_id_card_file_type,
       agreed_to_criteria, google_maps_url, has_smart_farm, payload,
       status, previous_admin_notes, resubmitted_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
       $23,$24,$25,$26,$27,$28,$29,$30,'pending',$31,$32
     )
     ON CONFLICT (id) DO UPDATE SET
       request_category=EXCLUDED.request_category, request_type=EXCLUDED.request_type,
       target_farm_id=EXCLUDED.target_farm_id, update_notes=EXCLUDED.update_notes,
       user_display_name=EXCLUDED.user_display_name,
       user_email_or_username=EXCLUDED.user_email_or_username,
       farm_name=EXCLUDED.farm_name, farm_name_en=EXCLUDED.farm_name_en,
       province=EXCLUDED.province, district=EXCLUDED.district,
       location_address=EXCLUDED.location_address, area_rai=EXCLUDED.area_rai,
       total_trees_estimate=EXCLUDED.total_trees_estimate, top_varieties=EXCLUDED.top_varieties,
       about_story=EXCLUDED.about_story, gap_cert_number=EXCLUDED.gap_cert_number,
       cert_issued_by=EXCLUDED.cert_issued_by, cert_valid_until=EXCLUDED.cert_valid_until,
       cert_document_photo=EXCLUDED.cert_document_photo, other_certs=EXCLUDED.other_certs,
       farmer_full_name=EXCLUDED.farmer_full_name,
       farmer_id_card_number=EXCLUDED.farmer_id_card_number,
       farmer_id_card_photo=EXCLUDED.farmer_id_card_photo,
       farmer_id_card_file_type=EXCLUDED.farmer_id_card_file_type,
       agreed_to_criteria=EXCLUDED.agreed_to_criteria,
       google_maps_url=EXCLUDED.google_maps_url, has_smart_farm=EXCLUDED.has_smart_farm,
       payload=EXCLUDED.payload,
       status='pending', admin_notes=NULL,
       previous_admin_notes=EXCLUDED.previous_admin_notes,
       resubmitted_at=EXCLUDED.resubmitted_at
     RETURNING *`,
    [
      id,
      category,
      b.requestType ?? null,
      b.targetFarmId ?? null,
      b.updateNotes ?? null,
      req.user!.uid,
      b.userDisplayName ?? req.user!.username,
      b.userEmailOrUsername ?? req.user!.username,
      b.farmName.trim(),
      b.farmNameEn ?? null,
      b.province.trim(),
      b.district ?? null,
      b.locationAddress ?? null,
      Number(b.areaRai) || 0,
      Number(b.totalTreesEstimate) || 0,
      Array.isArray(b.topVarieties) ? b.topVarieties.map(String) : [],
      b.aboutStory ?? null,
      b.gapCertNumber ?? null,
      b.certIssuedBy ?? null,
      b.certValidUntil ?? null,
      b.certDocumentPhoto ?? null,
      Array.isArray(b.otherCerts) ? b.otherCerts.map(String) : [],
      b.farmerFullName ?? null,
      b.farmerIdCardNumber ?? null,
      b.farmerIdCardPhoto ?? null,
      b.farmerIdCardFileType ?? null,
      b.agreedToCriteria === true,
      b.googleMapsUrl ?? null,
      b.hasSmartFarm === true,
      JSON.stringify(payload),
      isResubmit ? existing.rows[0].admin_notes : null,
      isResubmit ? new Date() : null,
    ]
  );

  res.status(201).json({ request: toRequest(rows[0]) });
}));

/**
 * อนุมัติคำขอ
 *
 * ทำ 4 อย่างใน transaction เดียว
 *   1. สร้างฟาร์มใหม่ หรือเขียนทับฟาร์มเดิม (กรณีขอแก้ไขข้อมูล)
 *   2. เลื่อน role ผู้ยื่นเป็น manager
 *   3. ผูกฟาร์มกับผู้ใช้ทั้งสองทาง
 *   4. อัปเดตสถานะคำขอ
 *
 * ของเดิมฝั่ง Firestore เขียนทีละอย่างแล้วครอบ try/catch ที่กลืน error ทิ้ง
 * ถ้าพังกลางทางจะได้สถานะครึ่ง ๆ กลาง ๆ เช่นฟาร์มถูกสร้างแล้วแต่ผู้ใช้ยังเป็น user อยู่
 */
farmRequestsRouter.post('/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM farm_requests WHERE id = $1 FOR UPDATE', [
      req.params.id,
    ]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'ไม่พบคำขอที่ระบุ' });
    }
    const reqRow = rows[0];
    const request = toRequest(reqRow);

    if (request.status === 'approved') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'คำขอนี้ถูกอนุมัติไปแล้ว' });
    }

    const isUpdate = request.requestType === 'update_farm' && Boolean(request.targetFarmId);
    const farmId =
      request.targetFarmId ||
      `farm-${request.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}-${Date.now().toString(36)}`;

    // เขียนทับเฉพาะฟิลด์ที่คำขอส่งมา ที่เหลือคงค่าเดิมของฟาร์มไว้
    let existing: Record<string, any> | null = null;
    if (isUpdate) {
      const found = await loadFarms({ farmId: request.targetFarmId, includeCertificatePhotos: true });
      existing = found[0] ?? null;
    }

    const certificationDetails =
      request.certificationList.length > 0
        ? request.certificationList.map((c: Record<string, any>) => ({
            ...c,
            certNumber: c.certNumber || request.gapCertNumber,
            issuedBy: c.issuedBy || request.certIssuedBy,
            validUntil: c.validUntil || request.certValidUntil,
            verified: true,
          }))
        : [
            {
              name: 'GAP (Good Agricultural Practice)',
              shortCode: 'GAP',
              certNumber: request.gapCertNumber,
              issuedBy: request.certIssuedBy,
              validUntil: request.certValidUntil,
              verified: true,
              documentPhoto: request.certDocumentPhoto,
            },
          ];

    await upsertFarm(client, {
      id: farmId,
      rank: existing?.rank ?? 99,
      name: request.farmName,
      nameEn: request.farmNameEn ?? existing?.nameEn,
      province: request.province,
      district: request.district || existing?.district,
      topVarieties: request.topVarieties.length > 0 ? request.topVarieties : existing?.topVarieties,
      totalTrees: request.totalTreesEstimate || existing?.totalTrees || 0,
      harvestedFruits: existing?.harvestedFruits ?? 0,
      rating: existing?.rating ?? 0,
      reviewCount: existing?.reviewCount ?? 0,
      aboutStory: request.aboutStory || existing?.aboutStory,
      highlight: existing?.highlight,
      photos: request.atmospherePhotos.length > 0 ? request.atmospherePhotos : existing?.photos,
      certifications: existing?.certifications ?? ['GAP'],
      certificationDetails,
      smartTechnologies: request.hasSmartFarm ? request.smartTechnologies : existing?.smartTechnologies,
      contact: { ...(existing?.contact ?? {}), ...request.contact, locationAddress: request.locationAddress },
      managerId: request.userId,
      logoBgColor: existing?.logoBgColor,
      logoTextColor: existing?.logoTextColor,
      establishedYear: existing?.establishedYear,
    });

    // เลื่อนสิทธิ์ผู้ยื่นเป็นผู้จัดการสวน และผูกกับฟาร์ม
    // ถ้าไม่พบผู้ใช้ (เช่นข้อมูลเก่าที่ย้ายมาไม่ครบ) ก็ข้ามไป ไม่ทำให้การอนุมัติล้ม
    await client.query(
      `UPDATE users SET role = 'manager', managed_farm_id = $2
       WHERE id = $1 AND role <> 'admin'`,
      [request.userId, farmId]
    );

    const updated = await client.query(
      `UPDATE farm_requests
       SET status = 'approved', reviewed_by = $2, reviewed_at = now(),
           admin_notes = $3, created_farm_id = $4
       WHERE id = $1
       RETURNING *`,
      [req.params.id, req.user!.username, req.body?.adminNotes ?? null, farmId]
    );

    await client.query('COMMIT');

    const farms = await loadFarms({ farmId });
    res.json({ request: toRequest(updated.rows[0]), farm: farms[0] ?? null });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

/** ตีกลับคำขอ -- ระบุ needsRevision ถ้าต้องการให้ผู้ใช้แก้แล้วส่งใหม่ */
farmRequestsRouter.post('/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
  const status = req.body?.needsRevision === true ? 'needs_revision' : 'rejected';
  const { rows } = await pool.query(
    `UPDATE farm_requests
     SET status = $2, admin_notes = $3, reviewed_by = $4, reviewed_at = now()
     WHERE id = $1
     RETURNING *`,
    [req.params.id, status, req.body?.adminNotes ?? null, req.user!.username]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบคำขอที่ระบุ' });
  res.json({ request: toRequest(rows[0]) });
}));

/** ย้อนคำขอกลับไปเป็นรอตรวจสอบ */
farmRequestsRouter.post('/:id/reset', requireAdmin, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE farm_requests
     SET status = 'pending', admin_notes = NULL, reviewed_by = NULL, reviewed_at = NULL
     WHERE id = $1
     RETURNING *`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบคำขอที่ระบุ' });
  res.json({ request: toRequest(rows[0]) });
}));
