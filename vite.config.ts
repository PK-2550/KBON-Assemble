import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // ส่งทุก request ที่ขึ้นต้นด้วย /api ไปให้ Express ที่รันแยกอีก process
      // เบราว์เซอร์จึงเห็นเป็น origin เดียวกัน ไม่ต้องตั้ง CORS และ cookie ทำงานปกติ
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.API_PORT ?? 3001}`,
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
