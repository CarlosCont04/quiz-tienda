import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), 'PUBLIC_');
const rawBase = process.env.PUBLIC_BASE_PATH || env.PUBLIC_BASE_PATH || '/';

// Se reestructuró la validación para evitar el slash final (trailing slash) exigido por Astro.
const base = rawBase === '/' ? '/' : '/' + rawBase.split('/').filter(Boolean).join('/');

// Se ajustó la concatenación del apiPrefix para evitar dobles slashes en la configuración del proxy.
const apiPrefix = `${base === '/' ? '' : base}/api`;

export default defineConfig({
  output: 'static',
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