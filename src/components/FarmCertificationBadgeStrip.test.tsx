import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FarmCertificationBadgeStrip } from './FarmCertificationBadgeStrip';
import type { CertificationDetail } from '../types';

/**
 * แถบตราใบรับรองต้องแสดงเฉพาะใบที่แอดมินอนุมัติแล้วเท่านั้น
 *
 * ตราคือคำรับรองที่ผู้ซื้อเห็นก่อนตัดสินใจ ถ้าใบที่ยังรอตรวจหรือถูกปฏิเสธ
 * โผล่ขึ้นมาด้วย ตราก็ไม่ได้แปลว่าอะไรอีกต่อไป และสวนที่ยังไม่ผ่านการตรวจ
 * จะดูเหมือนผ่านแล้ว
 *
 * เดิมแถบนี้เป็นกรอบเส้นประเปล่า ๆ ที่กันพื้นที่ไว้ตอนออกแบบหน้าใหม่
 */

const cert = (over: Partial<CertificationDetail>): CertificationDetail => ({
  name: 'GAP (Good Agricultural Practice)',
  nameTh: 'GAP (Good Agricultural Practice)',
  shortCode: 'GAP',
  certNumber: 'GAP-TH-68-10021',
  issuedBy: 'กรมวิชาการเกษตร',
  validUntil: '2029',
  approvalStatus: 'approved',
  verified: true,
  ...over,
});

describe('แถบตราใบรับรอง', () => {
  it('แสดงใบที่อนุมัติแล้วด้วยชื่อเต็ม', () => {
    render(<FarmCertificationBadgeStrip certifications={[cert({})]} />);

    expect(screen.getByText('GAP (Good Agricultural Practice)')).toBeInTheDocument();
    expect(screen.getByText('GAP')).toBeInTheDocument();
  });

  it('ไม่แสดงใบที่ยังรอตรวจ', () => {
    render(
      <FarmCertificationBadgeStrip
        certifications={[
          cert({}),
          cert({
            shortCode: 'GMP',
            nameTh: 'มาตรฐาน GMP โรงคัดบรรจุ',
            approvalStatus: 'pending',
            verified: false,
          }),
        ]}
      />
    );

    expect(screen.getByText('GAP (Good Agricultural Practice)')).toBeInTheDocument();
    expect(screen.queryByText('มาตรฐาน GMP โรงคัดบรรจุ')).not.toBeInTheDocument();
  });

  it('ไม่แสดงใบที่ถูกปฏิเสธหรือถูกตีกลับให้แก้ไข', () => {
    render(
      <FarmCertificationBadgeStrip
        certifications={[
          cert({ shortCode: 'GMP', nameTh: 'ถูกปฏิเสธ', approvalStatus: 'rejected', verified: false }),
          cert({ shortCode: 'GACC', nameTh: 'ให้แก้ไข', approvalStatus: 'needs_revision', verified: false }),
        ]}
      />
    );

    expect(screen.queryByText('ถูกปฏิเสธ')).not.toBeInTheDocument();
    expect(screen.queryByText('ให้แก้ไข')).not.toBeInTheDocument();
    expect(screen.getByText(/ยังไม่มีใบรับรองที่ผ่านการตรวจสอบ/)).toBeInTheDocument();
  });

  it('ใบเก่าที่ยังไม่มี approvalStatus ใช้ verified ตัดสินแทน', () => {
    // ข้อมูลที่ยังไม่ถูกย้ายหรือของที่ประกอบขึ้นในฝั่งเว็บอาจไม่มีฟิลด์ใหม่
    // ถ้าตัดทิ้งเพราะไม่มีฟิลด์ ฟาร์มจะเสียตราไปโดยที่ข้อมูลยังอยู่ครบ
    render(
      <FarmCertificationBadgeStrip
        certifications={[cert({ approvalStatus: undefined, verified: true })]}
      />
    );

    expect(screen.getByText('GAP (Good Agricultural Practice)')).toBeInTheDocument();
  });

  it('ไม่มีใบรับรองเลย ยังต้องมีแถบและบอกว่ายังไม่มี', () => {
    // ยุบแถบทิ้งไม่ได้ ไม่งั้นระยะห่างระหว่างส่วนหัวกับแถบแท็บจะกระโดด
    // ระหว่างฟาร์มที่มีตรากับไม่มี
    render(<FarmCertificationBadgeStrip certifications={[]} />);

    expect(screen.getByText(/ยังไม่มีใบรับรองที่ผ่านการตรวจสอบ/)).toBeInTheDocument();
  });

  it('แสดงใบระดับโซนภูมิศาสตร์อย่าง GI ด้วย', () => {
    render(
      <FarmCertificationBadgeStrip
        certifications={[
          cert({
            shortCode: 'GI',
            nameTh: 'GI สิ่งบ่งชี้ทางภูมิศาสตร์',
            tier: 'regional',
            certNumber: 'GI-TH-10088',
          }),
        ]}
      />
    );

    expect(screen.getByText('GI สิ่งบ่งชี้ทางภูมิศาสตร์')).toBeInTheDocument();
    expect(screen.getByText('GI')).toBeInTheDocument();
  });
});
