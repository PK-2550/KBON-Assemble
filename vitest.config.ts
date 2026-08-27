import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * ชุดทดสอบแบ่งเป็นสองกลุ่ม เพราะต้องการสภาพแวดล้อมคนละแบบ
 *
 *   server  ทดสอบ Express กับฐานข้อมูลจริง ใช้ environment node
 *   web     ทดสอบคอมโพเนนต์ React ใช้ environment jsdom
 *
 * ถ้ารวมเป็นชุดเดียวแล้วตั้ง jsdom ทั้งหมด ฝั่ง server จะได้ global ของเบราว์เซอร์
 * ที่ไม่ควรมี และการทดสอบอาจผ่านทั้งที่โค้ดจริงบนเซิร์ฟเวอร์จะพัง
 */
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./test/setup-web.ts'],
        },
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          globals: true,
          include: ['server/**/*.test.ts', 'test/api/**/*.test.ts'],
          // ชุดทดสอบฝั่ง API แตะฐานข้อมูลจริงและต้องทำงานตามลำดับ
          // รันขนานกันเมื่อไหร่ ข้อมูลทดสอบของแต่ละไฟล์จะชนกันเอง
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
