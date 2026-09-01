import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';

/**
 * ประเภทใบรับรองที่ฟอร์มยื่นคำขอเอาไปสร้างตัวเลือก
 *
 * เดิมฟอร์มฝังรายการไว้ในโค้ดฝั่งหน้าเว็บ ซึ่งไม่เคยถูกทำให้ตรงกับตารางในฐาน
 * บางตัวเลือกจึงไม่มีจริงและถูกบันทึกเป็น อื่น ๆ ส่วนบางประเภทที่มีในฐาน
 * กลับเลือกไม่ได้เลย
 *
 * 005 ออกแบบให้ certification_types เป็นตารางค้นหา เพิ่มประเภทใหม่คือ INSERT
 * ไม่ต้องแก้ schema และไม่ต้องแก้โค้ด การให้ฟอร์มมาดึงจากที่นี่ทำให้เจตนานั้น
 * เกิดผลจริง
 */
export const certificationTypesRouter = Router();

/**
 * ไม่ต้องเข้าสู่ระบบ
 *
 * ฟอร์มยื่นคำขอเปิดได้ตั้งแต่ยังไม่ล็อกอิน และข้อมูลชุดนี้เป็นรายการมาตรฐาน
 * สาธารณะ ไม่มีอะไรเป็นความลับ
 */
certificationTypesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT code, tier, name, name_th, requires_expiry, sort_order
         FROM certification_types
        WHERE active
          -- ใบระดับการขนส่งรายเที่ยวยังเลือกไม่ได้ เพราะ trigger บังคับให้มี
          -- shipment_ref และระบบยังไม่มีตารางเที่ยวขนส่ง ถ้าปล่อยให้เลือก
          -- ผู้ใช้จะกรอกครบแล้วแอดมินอนุมัติไม่ผ่าน
          AND tier <> 'shipment'
          -- ถังรองรับตอนย้ายข้อมูลเก่า ไม่ใช่ตัวเลือกที่ผู้ใช้ควรเลือกเอง
          AND code <> 'LEGACY_OTHER'
        ORDER BY sort_order`
    );

    res.json({
      types: rows.map((r) => ({
        code: r.code,
        tier: r.tier,
        name: r.name,
        nameTh: r.name_th ?? r.name,
        requiresExpiry: r.requires_expiry,
        sortOrder: r.sort_order,
      })),
    });
  })
);
