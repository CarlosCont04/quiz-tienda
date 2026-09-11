import { dev } from 'astro';

// La API mantiene el proceso bajo el control del lanzador y de Playwright.
const server = await dev({ server: { host: '127.0.0.1', port: 4322 } });
async function stop() { await server.stop(); process.exit(0); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
