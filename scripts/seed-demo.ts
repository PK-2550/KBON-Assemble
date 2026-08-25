/**
 * สร้างข้อมูลตัวอย่างสำหรับทดสอบ UI
 *
 *   npm run seed:demo            สร้าง (ลบของเดิมที่สคริปต์นี้เคยสร้างก่อน)
 *   npm run seed:demo -- --clear ลบอย่างเดียว ไม่สร้างใหม่
 *
 * ทุกอย่างที่สร้างมี id ขึ้นต้นด้วย demo- จึงลบออกได้หมดโดยไม่แตะข้อมูลจริง
 * ต้นไม้และรีวิวถูกลบตามด้วย cascade เมื่อลบฟาร์ม
 */

import 'dotenv/config';
import { Client } from 'pg';

const PREFIX = 'demo-';

interface FarmSeed {
  id: string;
  name: string;
  nameEn: string;
  province: string;
  district: string;
  rank: number;
  totalTrees: number;
  harvestedFruits: number;
  rating: number;
  reviewCount: number;
  established: number;
  highlight: string;
  story: string;
  varieties: string[];
  logoBg: string;
  logoText: string;
  lineId: string;
  treeCount: number;
  treePrefix: string;
}

const FARMS: FarmSeed[] = [
  {
    id: `${PREFIX}volcano-lungdum`,
    name: 'สวนทุเรียนภูเขาไฟ ลุงดำ',
    nameEn: 'Lung Dum Volcano Durian Farm',
    province: 'ศรีสะเกษ',
    district: 'อ.กันทรลักษ์',
    rank: 1,
    totalTrees: 17696,
    harvestedFruits: 11436,
    rating: 9.8,
    reviewCount: 1420,
    established: 1989,
    highlight: 'ทุเรียนภูเขาไฟดินภูเขาไฟแท้ หวานมัน กรอบนอกนุ่มใน กลิ่นละมุน ไร้กลิ่นฉุน',
    story:
      'สืบทอดการปลูกทุเรียนบนผืนดินภูเขาไฟโบราณแถบเทือกเขาพนมดงรัก มากว่า 35 ปี ผืนดินอุดมด้วยแร่ธาตุโปแตสเซียมและฟอสฟอรัสสูง ทำให้เนื้อทุเรียนเนียนละเอียด สีเหลืองทองอร่าม เมล็ดลีบ หวานมันกลมกล่อม',
    varieties: ['ภูเขาไฟหมอนทอง', 'ก้านยาวภูเขาไฟ', 'ชะนีไข่ภูเขาไฟ', 'พวงมณี'],
    logoBg: '#0f172a',
    logoText: '#38bdf8',
    lineId: '@lungdumdurian',
    treeCount: 8,
    treePrefix: 'VK',
  },
  {
    id: `${PREFIX}kp-garden`,
    name: 'สวนเคพี การ์เด้นท์ จันทบุรี',
    nameEn: 'KP Garden Chanthaburi',
    province: 'จันทบุรี',
    district: 'อ.ท่าใหม่',
    rank: 2,
    totalTrees: 9840,
    harvestedFruits: 6703,
    rating: 9.6,
    reviewCount: 884,
    established: 1998,
    highlight: 'แปลงส่งออกมาตรฐาน GAP ควบคุมความหวานทุกลูกก่อนตัด',
    story:
      'สวนขนาดกลางที่เน้นคุณภาพมากกว่าปริมาณ ใช้ระบบวัดค่าความหวานก่อนตัดทุกลูก ทุเรียนทุกผลมีแท็ก NFC ระบุต้นแม่พันธุ์และวันตัดชัดเจน',
    varieties: ['หมอนทอง', 'ก้านยาว', 'พวงมณี', 'ชะนี'],
    logoBg: '#1e3a2f',
    logoText: '#4ade80',
    lineId: '@kpgarden',
    treeCount: 6,
    treePrefix: 'KP',
  },
  {
    id: `${PREFIX}suphattra-land`,
    name: 'สวนสุภัทราแลนด์ ระยอง',
    nameEn: 'Suphattra Land Rayong',
    province: 'ระยอง',
    district: 'อ.แกลง',
    rank: 3,
    totalTrees: 7220,
    harvestedFruits: 4464,
    rating: 9.5,
    reviewCount: 612,
    established: 1985,
    highlight: 'สวนผลไม้ครบวงจร เปิดให้เข้าชมแปลงจริงตลอดฤดูกาล',
    story:
      'สวนผลไม้เก่าแก่ของระยอง ปลูกทุเรียนควบคู่กับมังคุดและเงาะ เปิดให้นักท่องเที่ยวเข้าชมแปลงและชิมผลไม้สดจากต้น',
    varieties: ['หมอนทอง', 'ชะนี', 'กระดุมทอง'],
    logoBg: '#2d1f3d',
    logoText: '#a78bfa',
    lineId: '@suphattraland',
    treeCount: 6,
    treePrefix: 'SP',
  },
  {
    id: `${PREFIX}longlablae`,
    name: 'สวนทุเรียนหลงลับแล ป้าสงวน',
    nameEn: 'Pa Sanguan Long Laplae Durian',
    province: 'อุตรดิตถ์',
    district: 'อ.ลับแล',
    rank: 4,
    totalTrees: 3180,
    harvestedFruits: 3434,
    rating: 9.7,
    reviewCount: 507,
    established: 1992,
    highlight: 'หลงลับแลแท้ GI อุตรดิตถ์ เนื้อละเอียด เมล็ดลีบ ผลผลิตจำกัดต่อปี',
    story:
      'ทุเรียนหลงลับแลพันธุ์แท้จากแหล่งกำเนิด ปลูกบนพื้นที่ลาดเชิงเขาที่มีอากาศเย็นตลอดปี ผลผลิตมีจำกัดและจองล่วงหน้าข้ามปีทุกฤดู',
    varieties: ['หลงลับแล', 'หลินลับแล', 'หมอนทอง'],
    logoBg: '#3d2f1f',
    logoText: '#f5d280',
    lineId: '@longlablae',
    treeCount: 5,
    treePrefix: 'LL',
  },
  {
    id: `${PREFIX}nonthaburi-suwan`,
    name: 'สวนทุเรียนนนท์ คุณสุวรรณ',
    nameEn: 'Khun Suwan Nonthaburi Durian',
    province: 'นนทบุรี',
    district: 'อ.บางกรวย',
    rank: 5,
    totalTrees: 640,
    harvestedFruits: 2873,
    rating: 9.9,
    reviewCount: 1103,
    established: 1961,
    highlight: 'ทุเรียนนนท์ดั้งเดิม ปลูกในร่องสวนโบราณ ราคาประมูลสูงสุดของประเทศ',
    story:
      'สวนทุเรียนนนท์ในร่องสวนโบราณริมคลองบางกอกน้อย สืบทอดมาสี่ชั่วอายุคน ต้นแม่พันธุ์บางต้นอายุเกิน 60 ปี ผลผลิตต่อปีน้อยมากจึงต้องประมูล',
    varieties: ['ก้านยาวนนท์', 'หมอนทองนนท์', 'กบชายน้ำ', 'ทองย้อยฉัตร'],
    logoBg: '#1f2f3d',
    logoText: '#6ee7b7',
    lineId: '@duriannon',
    treeCount: 5,
    treePrefix: 'NT',
  },
  {
    id: `${PREFIX}betong-musang`,
    name: 'ฟาร์มทุเรียนเบตง มูซานคิง วัลเล่ย์',
    nameEn: 'Betong Musang King Valley',
    province: 'ยะลา',
    district: 'อ.เบตง',
    rank: 6,
    totalTrees: 4100,
    harvestedFruits: 2096,
    rating: 9.6,
    reviewCount: 438,
    established: 2011,
    highlight: 'มูซานคิงปลูกในไทย ตัดสุกคาต้นแบบมาเลเซีย รสเข้มขม',
    story:
      'ฟาร์มบนหุบเขาชายแดนใต้ที่อากาศและความชื้นใกล้เคียงมาเลเซีย ปลูกมูซานคิงและหนามดำโดยใช้วิธีปล่อยให้ผลสุกร่วงคาต้น ไม่ตัดก่อนสุก',
    varieties: ['มูซานคิง', 'หนามดำ (โอวฉี่)', 'หมอนทอง'],
    logoBg: '#3d1f2f',
    logoText: '#f472b6',
    lineId: '@betongmusang',
    treeCount: 5,
    treePrefix: 'BT',
  },
];

const VARIETY_POOL = ['หมอนทอง', 'ก้านยาว', 'พวงมณี', 'ชะนี', 'มูซานคิง', 'หลงลับแล'];
const ZONE_POOL = ['โซน A (ลาดเขา)', 'โซน B (ที่ราบ)', 'แปลงดินภูเขาไฟ C', 'แปลงริมคลอง D'];
const REVIEWERS = [
  'คุณปิยะวัฒน์ เจริญพาณิชย์',
  'พญ. นภาพร สุริยันต์',
  'คุณธนากร ภักดีชน',
  'K. Michael Chang',
  'คุณมนัสนันท์ สิริกานต์',
  'Mr. L. Tanaka',
];
const COMMENTS = [
  'สแกน NFC ที่ขั้วลูกแล้วขึ้นต้นนี้เลย เนื้อสีเหลืองทองแห้งเนียน ไร้เส้นใย หวานมันกรอบนอกนุ่มใน เม็ดลีบมาก',
  'ประทับใจระบบตรวจสอบย้อนกลับมาก สแกนแท็กปุ๊บรู้เลยว่ามาจากต้นไหน อายุเท่าไหร่ รสชาติหวานมันเข้มข้น ไม่แฉะน้ำ',
  'ส่งถึงบ้านในสภาพสมบูรณ์ ครอบครัวชอบมาก รสชาติดีกว่าที่ซื้อตามตลาดทั่วไปเยอะ จะสั่งซ้ำแน่นอนฤดูหน้า',
  'Best durian I have tasted in Thailand. Scanned the NFC tag and traced it right back to this mother tree. Outstanding quality.',
  'อร่อยมาก แต่ลูกที่ได้สุกไปนิดนึง ทางสวนแนะนำให้รีบทานเลย ครั้งหน้าจะสั่งแบบพร้อมทานวันถัดไป',
  'ขั้วเหนียวแน่น เม็ดลีบ เนื้อเนียนละเอียด สมราคา คุ้มค่ามากสำหรับคนชอบทุเรียนเนื้อแห้ง',
];
const NOTES_POOL = [
  ['34 Brix', 'กรอบนอกนุ่มใน'],
  ['เนื้อครีมเนย', 'หวานละมุน', 'กลิ่นไม่ฉุน'],
  ['Premium Grade A+', 'หวานเข้มข้น'],
  ['เม็ดลีบ', 'เนื้อแน่นหนึบ'],
];

async function clearDemo(db: Client) {
  const r = await db.query('DELETE FROM farms WHERE id LIKE $1 RETURNING id', [`${PREFIX}%`]);
  return r.rowCount ?? 0;
}

async function main() {
  const clearOnly = process.argv.includes('--clear');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const removed = await clearDemo(db);
  if (removed > 0) console.log(`ลบข้อมูลตัวอย่างเดิม ${removed} ฟาร์ม (ต้นไม้และรีวิวถูกลบตาม)`);

  if (clearOnly) {
    const left = await db.query(
      'SELECT count(*)::int AS n FROM farms WHERE id LIKE $1',
      [`${PREFIX}%`]
    );
    console.log(`เหลือข้อมูลตัวอย่าง ${left.rows[0].n} รายการ`);
    await db.end();
    return;
  }

  let trees = 0;
  let reviews = 0;

  try {
    await db.query('BEGIN');

    for (const f of FARMS) {
      await db.query(
        `INSERT INTO farms (
           id, rank, name, name_en, province, district, varieties_count, top_varieties,
           total_trees, harvested_fruits, rating, review_count, logo_bg_color, logo_text_color,
           established_year, certifications, photos, highlight, about_story,
           contact_facebook, contact_instagram, contact_line_id, contact_phone, contact_address
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
        [
          f.id, f.rank, f.name, f.nameEn, f.province, f.district,
          f.varieties.length, f.varieties,
          f.totalTrees, f.harvestedFruits, f.rating, f.reviewCount,
          f.logoBg, f.logoText, f.established,
          ['GAP กรมวิชาการเกษตร', 'GI'],
          [
            'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=800&auto=format&fit=crop&q=80',
          ],
          f.highlight, f.story,
          `https://facebook.com/${f.id}`, `https://instagram.com/${f.id}`,
          f.lineId, '081-234-5678', `${f.district} ${f.province}`,
        ]
      );

      await db.query(
        `INSERT INTO farm_certifications (farm_id, name, short_code, cert_number, issued_by, valid_until, verified, sort_order)
         VALUES ($1,'GAP (Good Agricultural Practice)','GAP',$2,'กรมวิชาการเกษตร','2029',true,0),
                ($1,'GI สิ่งบ่งชี้ทางภูมิศาสตร์','GI',$3,'กรมทรัพย์สินทางปัญญา','2030',true,1)`,
        [f.id, `GAP-TH-68-${f.rank}0021`, `GI-TH-${f.rank}0088`]
      );

      await db.query(
        `INSERT INTO farm_smart_technologies (id, farm_id, name, subtext, icon_emoji, active, sort_order)
         VALUES ($2,$1,'ระบบน้ำหยดอัตโนมัติ','ควบคุมผ่านแอปฯ','💧',true,0),
                ($3,$1,'เซ็นเซอร์วัดความชื้นดิน','อ่านค่าทุก 15 นาที','🌡️',true,1),
                ($4,$1,'โดรนสำรวจแปลง','ลดการใช้สารเคมี 40%','🚁',true,2)`,
        [f.id, `${f.id}__st-1`, `${f.id}__st-2`, `${f.id}__st-3`]
      );

      for (let i = 0; i < f.treeCount; i++) {
        const variety = f.varieties[i % f.varieties.length] ?? VARIETY_POOL[i % VARIETY_POOL.length];
        const code = `${f.treePrefix}-${String(i + 1).padStart(3, '0')}`;
        const treeId = `${PREFIX}tree-${f.treePrefix}-${i + 1}`;
        const age = 6 + ((i * 3) % 26);
        const fruit = 60 + ((i * 17) % 60);

        await db.query(
          `INSERT INTO trees (
             id, farm_id, code, name, variety, category, category_label, badge,
             propagation_type, propagation_label, propagation_code, zone, planted_date, age_years,
             yield_fruit_count, yield_weight_kg, diaries_count, rating, review_count,
             health_status, sweetness_brix, last_fertilized, expected_harvest, notes
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
          [
            treeId, f.id, code,
            `${variety} ต้น${String.fromCharCode(65 + i)}${i + 1}`,
            variety,
            i === 0 ? 'durian_main' : i % 4 === 3 ? 'durian_rare' : 'durian_main',
            i % 4 === 3 ? 'ทุเรียนสายพันธุ์พิเศษ' : 'ทุเรียนสายพันธุ์หลัก',
            i === 0 ? 'แม่พันธุ์' : i % 3 === 0 ? 'GI แท้' : '',
            i % 5 === 0 ? 'seedling' : 'grafted',
            i % 5 === 0 ? 'ต้นดั้งเดิม' : 'เสียบยอด',
            i % 4 === 3 ? 'PHOTO' : 'AUTO',
            ZONE_POOL[i % ZONE_POOL.length],
            `${(i % 28) + 1} พ.ค. ${2568 - age}`,
            age,
            fruit,
            Math.round(fruit * 3.4),
            40 + ((i * 23) % 160),
            Number((9.9 - i * 0.12).toFixed(1)),
            8 + ((i * 7) % 40),
            i % 7 === 5 ? 'good' : 'excellent',
            30 + ((i * 2) % 6),
            `${(i % 28) + 1} ส.ค. 2569`,
            'มิถุนายน - กรกฎาคม',
            i === 0
              ? 'ต้นแม่พันธุ์หลักของสวน ใช้กิ่งพันธุ์จากต้นนี้ขยายไปทั้งแปลง'
              : null,
          ]
        );
        trees++;

        // ให้ต้นแรก ๆ ของแต่ละสวนมีรีวิว เพื่อให้เห็นหน้าจอรีวิวจริง
        const reviewCount = i < 3 ? 3 - i : 0;
        for (let j = 0; j < reviewCount; j++) {
          const pick = (i * 3 + j) % REVIEWERS.length;
          await db.query(
            `INSERT INTO reviews (
               tree_id, tree_code, farm_id, author_name, rating, comment,
               nfc_fruit_tag, nfc_fruit_weight_kg, verified_nfc, tasting_notes, review_date, source_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$11)`,
            [
              treeId, code, f.id,
              REVIEWERS[pick],
              j === 0 ? 5 : 4 + (j % 2),
              COMMENTS[pick % COMMENTS.length],
              `#${code}-F${String(40 + j).padStart(3, '0')}`,
              Number((3.2 + (j % 3) * 0.4).toFixed(1)),
              NOTES_POOL[(i + j) % NOTES_POOL.length],
              `${16 - j} ส.ค. 2569`,
              `${PREFIX}rev-${f.treePrefix}-${i}-${j}`,
            ]
          );
          reviews++;
        }
      }
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('สร้างข้อมูลตัวอย่างไม่สำเร็จ -- rollback แล้ว');
    console.error(err);
    await db.end();
    process.exit(1);
  }

  const total = await db.query(
    `SELECT (SELECT count(*)::int FROM farms) AS farms,
            (SELECT count(*)::int FROM trees) AS trees,
            (SELECT count(*)::int FROM reviews) AS reviews`
  );

  console.log(`\nสร้างข้อมูลตัวอย่างแล้ว`);
  console.log(`  ฟาร์ม   ${FARMS.length}`);
  console.log(`  ต้นไม้  ${trees}`);
  console.log(`  รีวิว   ${reviews}`);
  console.log(`\nยอดรวมในฐานข้อมูล (รวมข้อมูลจริงของคุณ)`);
  console.log(`  farms=${total.rows[0].farms} trees=${total.rows[0].trees} reviews=${total.rows[0].reviews}`);
  console.log(`\nลบทิ้งได้ด้วย: npm run seed:demo -- --clear`);

  await db.end();
}

main().catch((err) => {
  console.error('ล้มเหลว:', err);
  process.exit(1);
});
