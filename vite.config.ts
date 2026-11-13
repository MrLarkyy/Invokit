import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative asset URLs: the same build works under a GitHub Pages project path and at the root of invoo.cz.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022' },
});
