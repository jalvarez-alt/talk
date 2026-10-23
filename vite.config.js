import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, el backend PHP se levanta aparte: php -S localhost:8000 -t public
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy: { '/api': 'http://localhost:8000' } },
});
