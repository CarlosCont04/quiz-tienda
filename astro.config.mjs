import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), 'PUBLIC_');
const isVercel = process.env.VERCEL === '1';
const rawBase = isVercel ? '/' : (process.env.PUBLIC_BASE_PATH || env.PUBLIC_BASE_PATH || '/');
const base = '/' + rawBase.split('/').filter(Boolean).join('/') + (rawBase === '/' ? '' : '/');
const apiPrefix = `${base.replace(/\/$/, '')}/api`;

export default defineConfig({
  output: 'static',
  // Vercel ejecuta api/*.ts. Nunca publicar los archivos fuente PHP como estáticos.
  publicDir: isVercel ? './public-vercel' : './public',
  base,
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 4322 },
  vite: {
    server: {
      strictPort: true,
      proxy: {
        [apiPrefix]: {
          target: 'http://127.0.0.1:8082',
          changeOrigin: false,
          rewrite: (path) => '/api' + path.slice(apiPrefix.length),
        },
      },
    },
  },
});
