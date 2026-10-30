import { defineConfig } from 'vite';

// Relative asset URLs: the same build works under /Invokit/ on GitHub Pages and at the root locally.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
