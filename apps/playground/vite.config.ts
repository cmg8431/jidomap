import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 등 서브패스 배포용 — 미지정 시 루트
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
});
