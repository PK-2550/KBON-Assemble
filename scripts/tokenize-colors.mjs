/**
 * แทนที่ค่าสี hex ที่เขียนตรง ๆ ในคอมโพเนนต์ ด้วย utility ที่อ้าง token ใน index.css
 *
 *   node scripts/tokenize-colors.mjs          ดูว่าจะเปลี่ยนอะไรบ้าง ไม่เขียนไฟล์
 *   node scripts/tokenize-colors.mjs --write  เขียนจริง
 *
 * แทนที่แบบ 1 ต่อ 1 เท่านั้น สีที่ได้ออกมาเหมือนเดิมทุกพิกเซล
 * ไม่ยุบเฉดที่ใกล้เคียงกันเข้าด้วยกันในขั้นนี้ เพราะนั่นเปลี่ยนหน้าตาจริง
 * ควรทำตอนออกแบบแต่ละหน้าใหม่ จะได้เห็นผลทันทีว่าดีขึ้นหรือแย่ลง
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const WRITE = process.argv.includes('--write');

/** hex -> ชื่อ token (ตรงกับที่ประกาศไว้ใน src/index.css) */
const MAP = {
  '#07190f': 'canvas',
  '#0e2619': 'surface',
  '#143523': 'surface-2',
  '#04140b': 'well',
  '#092215': 'panel',
  '#092013': 'panel-2',
  '#1c442c': 'line',
  '#18422b': 'line-soft',
  '#225538': 'line-strong',
  '#f3f6f4': 'fg',
  '#83a893': 'fg-2',
  '#8da796': 'fg-3',
  '#5d7c67': 'fg-4',
  '#e5a93c': 'gold',
  '#d4992e': 'gold-hi',
  '#f5d280': 'gold-soft',
  '#1c1202': 'gold-ink',
  '#241603': 'gold-ink-2',
  '#4ade80': 'leaf',
};

// utility prefix ที่ Tailwind สร้างให้จาก --color-*
const PREFIXES = [
  'bg', 'text', 'border', 'fill', 'stroke', 'ring', 'outline', 'shadow',
  'from', 'via', 'to', 'divide', 'placeholder', 'caret', 'decoration', 'accent',
];

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = files.length > 0 ? files : globSync('src/**/*.tsx');

let totalReplaced = 0;
const perColor = new Map();

for (const file of targets) {
  const before = readFileSync(file, 'utf8');
  let after = before;

  for (const [hex, token] of Object.entries(MAP)) {
    for (const prefix of PREFIXES) {
      // จับทั้ง bg-[#E5A93C] และแบบมี modifier ต่อท้าย bg-[#E5A93C]/20
      // ตัว i ทำให้ตรงทั้งตัวพิมพ์เล็กและใหญ่ เพราะโค้ดเดิมเขียนปนกัน
      const re = new RegExp(`\\b${prefix}-\\[${hex}\\]`, 'gi');
      const hits = after.match(re);
      if (hits) {
        after = after.replace(re, `${prefix}-${token}`);
        totalReplaced += hits.length;
        perColor.set(hex, (perColor.get(hex) ?? 0) + hits.length);
      }
    }
  }

  if (after !== before) {
    if (WRITE) writeFileSync(file, after, 'utf8');
    const n = before.length - after.length;
    console.log(`  ${WRITE ? 'เขียน' : 'จะแก้'} ${file}  (สั้นลง ${n} ตัวอักษร)`);
  }
}

console.log(`\nแทนที่ทั้งหมด ${totalReplaced} จุด`);
for (const [hex, n] of [...perColor].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${hex} -> ${MAP[hex].padEnd(11)} ${n}`);
}
if (!WRITE) console.log('\n(ยังไม่ได้เขียนไฟล์ ใส่ --write เพื่อเขียนจริง)');
