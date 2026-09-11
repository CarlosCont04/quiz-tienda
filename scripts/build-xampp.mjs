import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const astroPackage = JSON.parse(readFileSync('node_modules/astro/package.json', 'utf8'));
const cli = resolve('node_modules/astro', astroPackage.bin.astro);
const result = spawnSync(process.execPath, [cli, 'check'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const build = spawnSync(process.execPath, [cli, 'build'], {
  stdio: 'inherit', env: { ...process.env, PUBLIC_BASE_PATH: '/quiz-tienda/' },
});
process.exit(build.status ?? 1);
