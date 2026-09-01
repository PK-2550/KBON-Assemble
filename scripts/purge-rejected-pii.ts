import 'dotenv/config';
import { pool } from '../server/db.js';
import {
  purgeRejectedRequestPii,
  PURGED_FIELDS,
  RETENTION_DAYS,
} from '../server/jobs/purgeRejectedPii.js';

/**
 * ล้างข้อมูลส่วนตัวของคำขอที่ถูกปฏิเสธเกินกำหนดเวลาเก็บ
 *
 * ใช้ตรรกะชุดเดียวกับที่เซิร์ฟเวอร์เรียกเองทุก 24 ชั่วโมง สคริปต์นี้มีไว้
 * ให้รันมือได้ ตรวจดูก่อนว่าจะโดนแถวไหนบ้าง และใช้กับตัวตั้งเวลาของระบบ
 * ถ้าวันหนึ่งไม่อยากให้เซิร์ฟเวอร์เป็นคนรัน
 *
 *   npm run purge:rejected            ดูอย่างเดียว ไม่แก้อะไร
 *   npm run purge:rejected -- --apply ล้างจริง
 *
 * โหมดตั้งต้นคือดูอย่างเดียวโดยตั้งใจ งานนี้ลบข้อมูลถาวร
 * จึงไม่ควรลบได้ด้วยการพิมพ์คำสั่งพลาดครั้งเดียว
 */

const APPLY = process.argv.includes('--apply');

function thaiDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
}

function daysSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

async function main() {
  const result = await purgeRejectedRequestPii({ apply: APPLY, trigger: 'manual' });

  if (result.skippedLocked) {
    console.log('มีอีกที่หนึ่งกำลังรันงานนี้อยู่ จึงไม่ทำอะไร ลองใหม่ภายหลัง');
    return;
  }

  if (result.candidates.length === 0) {
    console.log(`ไม่มีคำขอที่ถูกปฏิเสธเกิน ${RETENTION_DAYS} วันและยังมีข้อมูลส่วนตัวเหลืออยู่`);
    return;
  }

  console.log(
    `พบ ${result.candidates.length} คำขอที่ถูกปฏิเสธเกิน ${RETENTION_DAYS} วัน และยังมีข้อมูลส่วนตัวอยู่\n`
  );
  for (const c of result.candidates) {
    console.log(`  ${c.id}`);
    console.log(`    ${c.farmName}`);
    console.log(`    ปฏิเสธเมื่อ ${thaiDate(c.rejectedAt)} (${daysSince(c.rejectedAt)} วันที่แล้ว)`);
  }

  console.log(`\nฟิลด์ที่จะถูกล้าง ${PURGED_FIELDS.length} ฟิลด์`);
  console.log(`  ${PURGED_FIELDS.join(', ')}`);
  console.log('\nร่องรอยการตัดสินไม่ถูกแตะ  สถานะ ผู้ตรวจ หมายเหตุ และวันที่ปฏิเสธ ยังอยู่ครบ');

  if (!APPLY) {
    console.log('\nโหมดดูอย่างเดียว ยังไม่ล้าง ใส่ --apply เพื่อล้างจริง');
    return;
  }

  console.log(`\nล้างแล้ว ${result.purgedCount} แถว และบันทึกลง data_retention_log เรียบร้อย`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
