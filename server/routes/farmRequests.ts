import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { pool } from '../db.js';
import { loadFarms, upsertFarm } from '../farmsRepo.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { idCardRevealLimiter } from '../middleware/rateLimit.js';
import { decryptIdCardValue, IdCardDecryptionError } from '../security/idCardCipher.js';
import { logIdCardAccess, logIdCardAccessBestEffort } from '../security/idCardAccessLog.js';
import { maskedThaiNationalIdFromCheckDigit } from '../../src/shared/thaiNationalId.js';

export const farmRequestsRouter = Router();

/**
 * แปลงแถวในตาราง กลับเป็นรูปร่าง FarmRegistrationRequest ที่ frontend ใช้
 *
 * เลขบัตรประชาชนและรูปถ่ายบัตรไม่เคยถูกส่งออกไปจากที่นี่ ไม่ว่าผู้เรียกจะเป็นใคร
 *
 * จงใจปิดบังที่นี่จุดเดียว ไม่ใช่ไปแยกทำตามแต่ละ route เพราะทุกเส้นทางที่ตอบ
 * ข้อมูลคำขอกลับไปล้วนผ่านฟังก์ชันนี้ทั้งหมด ทั้งของผู้ใช้ทั่วไปและของแอดมิน
 * ถ้าไปปิดบังทีละ route วันหนึ่งจะมีคนเพิ่ม route ใหม่แล้วลืม
 *
 * และการปิดบังต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น การซ่อนที่หน้าจอไม่นับเป็นการแก้
 * เพราะใครเปิด devtools หรือยิง curl ตรง ๆ ก็ข้ามการซ่อนฝั่งหน้าจอได้หมด
 */
export function toRequest(r: Record<string, any>) {
  // หลังรัน 007 คอลัมน์ข้อความธรรมดาจะหายไป เหลือแต่หลักตรวจสอบที่เก็บแยกไว้
  // ระหว่างนี้ยังมีทั้งสองอย่าง จึงใช้หลักตรวจสอบก่อน แล้วค่อยถอยไปใช้ค่าเดิม
  const checkDigit: string | undefined =
    r.farmer_id_card_check_digit ??
    (typeof r.farmer_id_card_number === 'string' && r.farmer_id_card_number.length > 0
      ? r.farmer_id_card_number.slice(-1)
      : undefined);

  const hasIdCardNumber = Boolean(
    r.farmer_id_card_ciphertext || r.farmer_id_card_number || r.farmer_id_card_check_digit
  );

  const hasIdCardPhoto = Boolean(r.farmer_id_card_photo_ciphertext || r.farmer_id_card_photo);

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
    // ไม่มี farmerIdCardNumber และ farmerIdCardPhoto ในคำตอบโดยตั้งใจ
    // เลขเต็มและรูปเต็มดูได้ทางเดียวคือ endpoint สำหรับแอดมินที่มี audit log กำกับ
    farmerIdCardMasked: hasIdCardNumber
      ? maskedThaiNationalIdFromCheckDigit(checkDigit)
      : undefined,
    hasIdCardPhoto,
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

  // ต้องดึงโดยไม่กรอง user_id ก่อน เพื่อจะรู้ว่า id นี้มีอยู่แล้วแต่เป็นของคนอื่น
  //
  // ก่อนหน้านี้กรอง user_id ตั้งแต่ใน SELECT ทำให้คำขอของคนอื่นหลุดออกไป
  // เป็น isResubmit = false แล้วไหลต่อไปเข้า ON CONFLICT ซึ่งตัดสินจาก id อย่างเดียว
  // คนที่รู้ id ของคนอื่นจึงเขียนทับคำขอนั้นได้ และ RETURNING * จะส่ง
  // เลขบัตรประชาชนกับภาพถ่ายบัตรของเจ้าของตัวจริงกลับไปให้ด้วย
  const existing = await pool.query<{
    user_id: string;
    status: string;
    admin_notes: string | null;
    agreed_to_criteria: boolean | null;
    has_smart_farm: boolean | null;
  }>(
    `SELECT user_id, status, admin_notes, agreed_to_criteria, has_smart_farm
     FROM farm_requests WHERE id = $1`,
    [id]
  );

  if (existing.rows.length > 0 && existing.rows[0].user_id !== req.user!.uid) {
    // ตอบ 404 ไม่ใช่ 403 เพื่อไม่ยืนยันว่า id นี้มีอยู่จริง
    return res.status(404).json({ error: 'ไม่พบคำขอนี้' });
  }

  const isResubmit = existing.rows.length > 0;
  const prev = existing.rows[0];

  // ใส่เฉพาะคีย์ที่ client ส่งมาจริง เพื่อให้ตอน merge ฝั่ง SQL
  // ข้อมูลเดิมที่ไม่ได้ส่งมารอบนี้ไม่ถูกล้างทิ้ง
  //
  // ของเดิมฝั่ง Firestore ใช้ setDoc(..., { merge: true }) ซึ่งคงฟิลด์ที่ไม่ได้
  // ส่งมาไว้ ถ้าเขียนทับทุกคีย์ ผู้ใช้ที่ถูกตีกลับแล้วส่งแก้ไขใหม่จะเสียไฟล์
  // ใบรับรองและข้อมูล SmartFarm ที่แนบไว้ตั้งแต่รอบแรก
  const payload: Record<string, unknown> = {};
  if (b.contact !== undefined) payload.contact = b.contact;
  if (Array.isArray(b.certificationList) && b.certificationList.length > 0)
    payload.certificationList = b.certificationList;
  if (Array.isArray(b.atmospherePhotos) && b.atmospherePhotos.length > 0)
    payload.atmospherePhotos = b.atmospherePhotos;
  if (Array.isArray(b.smartTechnologies) && b.smartTechnologies.length > 0)
    payload.smartTechnologies = b.smartTechnologies;
  if (b.coordinates) payload.coordinates = b.coordinates;

  /** ส่ง null เมื่อ client ไม่ได้ส่งคีย์นั้นมา เพื่อให้ COALESCE คงค่าเดิมไว้ */
  const opt = (v: unknown) => (v === undefined || v === '' ? null : v);

  /**
   * คอลัมน์ boolean เป็น NOT NULL จึงส่ง null ไปให้ COALESCE ฝั่ง SQL ไม่ได้
   *
   * Postgres ตรวจ NOT NULL ตอนสร้าง tuple ที่จะ insert ซึ่งเกิดก่อนการเช็ค
   * conflict เสมอ ต่อให้สุดท้ายจะเข้าทาง DO UPDATE ก็ตาม
   * จึงต้องเติมค่าเดิมให้ตั้งแต่ฝั่ง JS แทน
   */
  const optBool = (v: unknown, previous: boolean | undefined) =>
    v === undefined ? (previous ?? false) : v === true;

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
       $23,$24,$25,$26,$27,$28,$29,$30,
       'pending',$31,$32
     )
     ON CONFLICT (id) DO UPDATE SET
       -- ทุกคอลัมน์ใช้ COALESCE เพื่อเลียนแบบ merge:true ของ Firestore
       -- ถ้ารอบนี้ไม่ได้ส่งค่ามา (เป็น null) ให้คงค่าเดิมไว้ ไม่ล้างทิ้ง
       request_category=COALESCE(EXCLUDED.request_category, farm_requests.request_category),
       request_type=COALESCE(EXCLUDED.request_type, farm_requests.request_type),
       target_farm_id=COALESCE(EXCLUDED.target_farm_id, farm_requests.target_farm_id),
       update_notes=COALESCE(EXCLUDED.update_notes, farm_requests.update_notes),
       user_display_name=COALESCE(EXCLUDED.user_display_name, farm_requests.user_display_name),
       user_email_or_username=COALESCE(EXCLUDED.user_email_or_username, farm_requests.user_email_or_username),
       farm_name=EXCLUDED.farm_name,
       farm_name_en=COALESCE(EXCLUDED.farm_name_en, farm_requests.farm_name_en),
       province=EXCLUDED.province,
       district=COALESCE(EXCLUDED.district, farm_requests.district),
       location_address=COALESCE(EXCLUDED.location_address, farm_requests.location_address),
       area_rai=COALESCE(NULLIF(EXCLUDED.area_rai, 0), farm_requests.area_rai),
       total_trees_estimate=COALESCE(NULLIF(EXCLUDED.total_trees_estimate, 0), farm_requests.total_trees_estimate),
       top_varieties=CASE WHEN cardinality(EXCLUDED.top_varieties) > 0
                          THEN EXCLUDED.top_varieties ELSE farm_requests.top_varieties END,
       about_story=COALESCE(EXCLUDED.about_story, farm_requests.about_story),
       gap_cert_number=COALESCE(EXCLUDED.gap_cert_number, farm_requests.gap_cert_number),
       cert_issued_by=COALESCE(EXCLUDED.cert_issued_by, farm_requests.cert_issued_by),
       cert_valid_until=COALESCE(EXCLUDED.cert_valid_until, farm_requests.cert_valid_until),
       cert_document_photo=COALESCE(EXCLUDED.cert_document_photo, farm_requests.cert_document_photo),
       other_certs=CASE WHEN cardinality(EXCLUDED.other_certs) > 0
                        THEN EXCLUDED.other_certs ELSE farm_requests.other_certs END,
       farmer_full_name=COALESCE(EXCLUDED.farmer_full_name, farm_requests.farmer_full_name),
       farmer_id_card_number=COALESCE(EXCLUDED.farmer_id_card_number, farm_requests.farmer_id_card_number),
       farmer_id_card_photo=COALESCE(EXCLUDED.farmer_id_card_photo, farm_requests.farmer_id_card_photo),
       farmer_id_card_file_type=COALESCE(EXCLUDED.farmer_id_card_file_type, farm_requests.farmer_id_card_file_type),
       agreed_to_criteria=COALESCE(EXCLUDED.agreed_to_criteria, farm_requests.agreed_to_criteria),
       google_maps_url=COALESCE(EXCLUDED.google_maps_url, farm_requests.google_maps_url),
       has_smart_farm=COALESCE(EXCLUDED.has_smart_farm, farm_requests.has_smart_farm),
       -- || รวม jsonb สองก้อน คีย์ที่ส่งมาใหม่ทับของเดิม คีย์ที่ไม่ได้ส่งคงไว้
       payload=farm_requests.payload || EXCLUDED.payload,
       status='pending', admin_notes=NULL,
       previous_admin_notes=EXCLUDED.previous_admin_notes,
       resubmitted_at=EXCLUDED.resubmitted_at
     WHERE farm_requests.user_id = EXCLUDED.user_id
     RETURNING *`,
    [
      id,
      category,
      opt(b.requestType),
      opt(b.targetFarmId),
      opt(b.updateNotes),
      req.user!.uid,
      b.userDisplayName ?? req.user!.username,
      b.userEmailOrUsername ?? req.user!.username,
      b.farmName.trim(),
      opt(b.farmNameEn),
      b.province.trim(),
      opt(b.district),
      opt(b.locationAddress),
      Number(b.areaRai) || 0,
      Number(b.totalTreesEstimate) || 0,
      Array.isArray(b.topVarieties) ? b.topVarieties.map(String) : [],
      opt(b.aboutStory),
      opt(b.gapCertNumber),
      opt(b.certIssuedBy),
      opt(b.certValidUntil),
      opt(b.certDocumentPhoto),
      Array.isArray(b.otherCerts) ? b.otherCerts.map(String) : [],
      opt(b.farmerFullName),
      opt(b.farmerIdCardNumber),
      opt(b.farmerIdCardPhoto),
      opt(b.farmerIdCardFileType),
      optBool(b.agreedToCriteria, prev?.agreed_to_criteria),
      opt(b.googleMapsUrl),
      optBool(b.hasSmartFarm, prev?.has_smart_farm),
      JSON.stringify(payload),
      isResubmit ? existing.rows[0].admin_notes : null,
      isResubmit ? new Date() : null,
    ]
  );

  if (rows.length === 0) {
    // WHERE บน DO UPDATE กันไว้อีกชั้น เผื่อกรณีมีคนแทรกสร้างแถวนี้คั่นหลังเช็คสิทธิ์
    return res.status(404).json({ error: 'ไม่พบคำขอนี้' });
  }

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

/**
 * เปิดดูเลขบัตรประชาชนและสำเนาบัตรฉบับเต็ม -- ทางเดียวที่ข้อมูลนี้ออกจากระบบได้
 *
 * ทุกเส้นทางอื่นปิดบังหมดแล้วที่ toRequest() ที่นี่จึงเป็นประตูบานเดียว
 * และเป็นเหตุผลที่ต้องมีทั้งการตรวจสิทธิ์ การจำกัดอัตรา และการบันทึกไว้ครบ
 *
 * ลำดับ middleware สำคัญ requireAdmin ต้องมาก่อน idCardRevealLimiter เสมอ
 * เพราะตัวจำกัดอัตรานับตาม uid ของแอดมินซึ่งจะมีค่าก็ต่อเมื่อผ่านการตรวจสิทธิ์แล้ว
 * ถ้าสลับลำดับ คนที่ยังไม่ได้ล็อกอินจะถูกนับรวมกันเป็นก้อนเดียวตาม IP
 * แล้วกลายเป็นช่องให้ยิงจนแอดมินตัวจริงใช้งานไม่ได้
 *
 * บันทึกการเข้าถึงครบทุกทางที่คำขอเดินไปได้ ทั้งสำเร็จและถูกปฏิเสธ
 *
 *   success not_found decrypt_failed   บันทึกในตัว handler ก่อนตอบกลับเสมอ
 *   forbidden                          บันทึกที่ middleware ตัวแรก เพราะ requireAdmin
 *                                      ปฏิเสธก่อนจะถึง handler
 *   rate_limited                       บันทึกใน handler ของ idCardRevealLimiter
 *
 * สองอันหลังสำคัญเป็นพิเศษ เพราะการที่บัญชีหนึ่งโดนปฏิเสธซ้ำ ๆ คือสัญญาณ
 * ของการกวาดข้อมูลหรือการใช้บัญชีผิดคน ถ้าปฏิเสธเงียบ ๆ สัญญาณนั้นจะหายไปทั้งหมด
 *
 * ที่สามอันแรกต้อง await ก่อนตอบ เพราะถ้าเขียนบันทึกไม่สำเร็จ ผู้เรียกต้องไม่ได้
 * ข้อมูลไปด้วย ส่วนสองอันหลังไม่ต้อง เพราะตรงนั้นไม่มีข้อมูลอะไรจะรั่วอยู่แล้ว
 */
farmRequestsRouter.get(
  '/:id/id-card',
  // บันทึกความพยายามของคนที่ไม่ใช่แอดมินก่อน แล้วปล่อยให้ requireAdmin เป็นคนปฏิเสธ
  // readUser ที่ระดับแอปเติม req.user ให้แล้วถ้ามี token ที่ใช้ได้
  (req, _res, next) => {
    const user = (req as typeof req & { user?: { uid?: string; role?: string } }).user;
    if (user?.uid && user.role !== 'admin') {
      logIdCardAccessBestEffort({
        adminUserId: user.uid,
        farmRequestId: req.params.id,
        outcome: 'forbidden',
        ip: req.ip ?? null,
      });
    }
    next();
  },
  requireAdmin,
  idCardRevealLimiter,
  asyncHandler(async (req, res) => {
    const requestId = req.params.id;
    const adminUid = req.user!.uid;
    const ip = req.ip ?? null;

    const writeLog = (outcome: 'success' | 'not_found' | 'decrypt_failed') =>
      logIdCardAccess({ adminUserId: adminUid, farmRequestId: requestId, outcome, ip });

    // ห้าม cache ข้อมูลชั้นนี้ไว้ที่ไหนทั้งสิ้น ถ้าวันหนึ่งมี proxy หรือ CDN
    // มาคั่นหน้า API ขึ้นมา คำตอบนี้ต้องไม่ถูกเก็บไว้ให้ใครหยิบต่อได้
    res.set('Cache-Control', 'no-store');

    const { rows } = await pool.query(
      `SELECT id, farmer_id_card_ciphertext, farmer_id_card_photo_ciphertext,
              farmer_id_card_number, farmer_id_card_photo, farmer_id_card_file_type
         FROM farm_requests WHERE id = $1`,
      [requestId]
    );

    if (rows.length === 0) {
      await writeLog('not_found');
      return res.status(404).json({ error: 'ไม่พบคำขอนี้' });
    }

    const row = rows[0];

    try {
      // ระหว่างที่ยังไม่ได้รัน 007 แถวเก่าอาจมีแต่ข้อความธรรมดา
      // จึงถอยไปอ่านคอลัมน์เดิมได้ เมื่อรัน 007 แล้วทางนี้จะเหลือแต่ ciphertext
      const idCardNumber = row.farmer_id_card_ciphertext
        ? decryptIdCardValue(row.farmer_id_card_ciphertext, row.id)
        : (row.farmer_id_card_number ?? null);

      const idCardPhoto = row.farmer_id_card_photo_ciphertext
        ? decryptIdCardValue(row.farmer_id_card_photo_ciphertext, row.id)
        : (row.farmer_id_card_photo ?? null);

      await writeLog('success');

      return res.json({
        farmerIdCardNumber: idCardNumber,
        farmerIdCardPhoto: idCardPhoto,
        farmerIdCardFileType: row.farmer_id_card_file_type ?? 'image',
      });
    } catch (err) {
      await writeLog('decrypt_failed');

      if (err instanceof IdCardDecryptionError) {
        // ตัวโมดูลเข้ารหัสบันทึกรายละเอียดไว้ฝั่งเซิร์ฟเวอร์แล้ว
        // ตรงนี้ตอบข้อความกลาง ๆ ไม่บอกว่าล้มเพราะอะไร
        return res.status(500).json({ error: 'อ่านข้อมูลบัตรประชาชนไม่สำเร็จ' });
      }
      throw err;
    }
  })
);

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
