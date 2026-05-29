import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

if (!isDev && process.env.VITE_SUPABASE_URL) {
  const devUrl = 'http://localhost:54321';
  if (process.env.VITE_SUPABASE_URL === devUrl) {
    throw new Error(
      'Test environment is using the development Supabase URL. Set VITE_SUPABASE_URL to point to a test Supabase project.'
    );
  }
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/setup.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
