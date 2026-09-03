import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * ตั้งค่า ESLint
 *
 * จุดประสงค์หลักคือกฎของ React Hooks ซึ่ง tsc ตรวจไม่ได้เลย
 *
 *   rules-of-hooks      เรียก hook ในเงื่อนไข ในลูป หรือหลัง early return
 *   exhaustive-deps     dependency array ของ useEffect/useMemo ตกไปตัวหนึ่ง
 *                       แล้วกลายเป็น stale closure อ่านค่าเก่าไปเรื่อย ๆ
 *
 * ข้อหลังสำคัญกับงานแยกไฟล์ที่กำลังจะทำ เพราะ effect ที่เซฟแบบร่างอัตโนมัติ
 * ใน FarmRegistrationModal ไล่ฟิลด์ใน dependency array ด้วยมือหลายสิบตัว
 * ตอนย้าย logic ออกไปเป็น hook ถ้าตกไปตัวเดียวจะไม่มีอะไรฟ้องเลย
 *
 * ยังไม่เปิดกฎ style หรือ type-checked rules ชุดใหญ่ เพราะจะได้ error
 * จำนวนมากที่ไม่เกี่ยวกับความถูกต้อง แล้วกลบสัญญาณที่ต้องการจริง
 */
export default tseslint.config(
  {
    // ไฟล์ที่สร้างจากการ build และ dependency ไม่ต้องตรวจ
    ignores: ['dist/**', 'node_modules/**', '.claude/**'],
  },

  // โค้ดฝั่งเบราว์เซอร์
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // React Compiler perf-lint ที่ติดมากับ eslint-plugin-react-hooks เวอร์ชันใหม่
      //
      // อยู่นอกเจตนาของไฟล์นี้ (ดูหัวไฟล์: เปิดแค่ rules-of-hooks กับ exhaustive-deps)
      // ทั้งสองเป็นคำเตือนเรื่องประสิทธิภาพ ไม่ใช่ความถูกต้อง
      //   set-state-in-effect        setState ใน effect ตอน init (เช่น setLoading(true)
      //                              ก่อนยิง fetch) ไม่ได้ทำให้ผลลัพธ์ผิด
      //   preserve-manual-memoization  useMemo/useCallback ที่ compiler แปลงต่อไม่ได้
      //                              ยังทำงานถูกเหมือนเดิม แค่ compiler ไม่ช่วย optimize
      // เปิดไว้จะได้ error หลายสิบจุดที่ไม่เกี่ยวความถูกต้อง แล้วกลบสัญญาณที่ต้องการจริง
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',

      // ปิดกฎที่ซ้ำกับ tsc หรือไม่เกี่ยวกับความถูกต้อง
      // ของพวกนี้ tsc ตรวจให้อยู่แล้วด้วยข้อความที่ตรงกว่า
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',

      // catch {} ที่ว่างเปล่าเป็นรูปแบบที่โปรเจกต์นี้ใช้อยู่หลายที่โดยตั้งใจ
      // เช่นตอนอ่าน localStorage ที่เบราว์เซอร์อาจบล็อกไว้ ซึ่งล้มเหลวได้ไม่เป็นไร
      // บังคับให้ใส่คอมเมนต์ทั้ง 8 จุดเป็นการแก้ให้ผ่านกฎ ไม่ได้ทำให้โค้ดดีขึ้น
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // โค้ดฝั่ง server และสคริปต์ ไม่มี React จึงไม่ต้องใช้กฎ hooks
  {
    files: ['server/**/*.ts', 'scripts/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  }
);
