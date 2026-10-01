import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Este paquete corresponde a https://www.elquetengatienda.com/quiz/.
const astroPackage = JSON.parse(readFileSync('node_modules/astro/package.json', 'utf8'));
const cli = resolve('node_modules/astro', astroPackage.bin.astro);
for (const command of ['check', 'build']) {
  const result = spawnSync(process.execPath, [cli, command], {
    stdio: 'inherit', env: { ...process.env, PUBLIC_BASE_PATH: '/quiz/' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const html = readFileSync('dist/index.html', 'utf8');
assert.match(html, /data-api-base="\/quiz\/api\/"/, 'La API debe apuntar a /quiz/api/.');
assert.match(html, /src="\/quiz\/_astro\//, 'Los recursos deben apuntar a /quiz/_astro/.');

// Una salida nueva en cada ejecución evita sobrescribir una entrega anterior.
const releaseId = new Date().toISOString().replace(/[:.]/g, '-');
const release = resolve('artifacts', `hosting-${releaseId}`);
const directory = resolve(release, 'package');
const publicDirectory = resolve(directory, 'public_html/quiz');
const privateDirectory = resolve(directory, 'quiz-private');
mkdirSync(publicDirectory, { recursive: true });
mkdirSync(resolve(privateDirectory, 'backend'), { recursive: true });
mkdirSync(resolve(privateDirectory, 'shared'), { recursive: true });
mkdirSync(resolve(privateDirectory, '.runtime/sessions'), { recursive: true });
cpSync('dist', publicDirectory, { recursive: true });
// Lista explícita: nunca copiar config.local.php, sesiones o registros locales.
for (const name of ['config.php', 'config.example.php', 'http.php', 'mailer.php', 'quiz.php', 'submission.php']) {
  copyFileSync(resolve('backend', name), resolve(privateDirectory, 'backend', name));
}
copyFileSync('shared/quiz.json', resolve(privateDirectory, 'shared/quiz.json'));
writeFileSync(resolve(privateDirectory, '.htaccess'), 'Require all denied\n');
writeFileSync(resolve(privateDirectory, '.runtime/sessions/.gitkeep'), '');
writeFileSync(resolve(publicDirectory, 'api/private-root.php'), `<?php
// Estructura: CUENTA/public_html/quiz/api y CUENTA/quiz-private.
// Si la raíz del dominio es distinta, usar la ruta absoluta privada del hosting.
return dirname(__DIR__, 3) . '/quiz-private';
`);
copyFileSync('docs/hosting.md', resolve(directory, 'INSTRUCCIONES-HOSTING.md'));
writeFileSync(resolve(directory, 'VERSION.json'), JSON.stringify({
  builtAt: releaseId, publicPath: '/quiz/', apiPath: '/quiz/api/',
  credentialsIncluded: false,
}, null, 2) + '\n');

function createZip(source, target) {
  // Pasar nombres explícitos evita la entrada raíz ./ que algunos descompresores rechazan.
  const entries = readdirSync(source).sort();
  const zip = process.platform === 'win32'
    ? spawnSync('tar.exe', ['-a', '-c', '-f', target, '-C', source, ...entries], { stdio: 'inherit' })
    : spawnSync('zip', ['-q', '-r', target, ...entries], { cwd: source, stdio: 'inherit' });
  if (zip.error) throw zip.error;
  if (zip.status !== 0) throw new Error('No se pudo crear el ZIP; se requiere tar.exe en Windows o zip en Linux/macOS.');
}
const archive = resolve(release, 'quiz-hosting.zip');
createZip(directory, archive);

// Actualización de una instalación ya configurada: solo HTML y recursos del navegador.
const updateDirectory = resolve(release, 'actualizacion-quiz');
mkdirSync(updateDirectory, { recursive: true });
copyFileSync('dist/index.html', resolve(updateDirectory, 'index.html'));
cpSync('dist/_astro', resolve(updateDirectory, '_astro'), { recursive: true });
const updateArchive = resolve(release, 'quiz-actualizacion-pdf.zip');
createZip(updateDirectory, updateArchive);
copyFileSync('docs/actualizacion-pdf-hostgator.md', resolve(release, 'INSTRUCCIONES-ACTUALIZACION-PDF.md'));
writeFileSync(resolve('artifacts/latest-hosting.json'), JSON.stringify({ directory, archive, updateDirectory, updateArchive }, null, 2) + '\n');
console.log(`\nInstalación completa: ${archive}\nActualización de la landing existente: ${updateArchive}\nSigue INSTRUCCIONES-ACTUALIZACION-PDF.md y ejecuta npm run test:hosting.`);
