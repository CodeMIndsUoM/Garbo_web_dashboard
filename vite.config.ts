import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import * as path from 'node:path'; // Fix import for ESM compatibility

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // If you actually use any of these packages in your imports, add them here without versions, e.g.:
      // 'lucide-react': 'lucide-react',
      // 'react-hook-form': 'react-hook-form',
      // ...etc.
    },
  },
  build: {
    target: 'esnext',
    outDir: 'build',
  },
  server: {
    port: 3000,
    open: true,
  },
});
