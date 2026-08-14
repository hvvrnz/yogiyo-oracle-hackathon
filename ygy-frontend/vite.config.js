import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000';

  return {
    envDir: process.cwd(),
    plugins: [react()],
    root: 'frontend',
    publicDir: '../public',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': backendTarget,
        '/docs': backendTarget,
        '/openapi.json': backendTarget,
        '/ws': { target: backendTarget, ws: true },
      },
    },
  };
});
