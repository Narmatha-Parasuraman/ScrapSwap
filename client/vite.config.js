import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Served from https://<user>.github.io/ScrapSwap/ -- asset URLs need the
  // repo name as a prefix, unlike a custom domain or Render's own hosting.
  base: '/ScrapSwap/',
});
