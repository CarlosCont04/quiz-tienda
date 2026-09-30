import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';

const php = process.env.PHP_BINARY || (existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
let directory, server, base, serverError, logs = '';

before(async () => {
  assert.ok(existsSync('artifacts/latest-hosting.json'), 'Ejecuta npm run build:hosting antes de esta prueba.');
  const release = JSON.parse(readFileSync('artifacts/latest-hosting.json', 'utf8'));
  mkdirSync('.runtime', { recursive: true });
  directory = mkdtempSync(resolve('.runtime/hosting-test-'));
  cpSync(release.directory, directory, { recursive: true });
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  base = `http://127.0.0.1:${port}`;
  // Sin router especial: atender los archivos PHP reales del paquete en /quiz/.
  // Claves vacías garantizan que esta comprobación nunca envíe correos reales.
  server = spawn(php, ['-d', 'display_errors=0', '-S', `127.0.0.1:${port}`, '-t', resolve(directory, 'public_html')], {
    env: { ...process.env, EMAILJS_SERVICE_ID: '', EMAILJS_TEMPLATE_ID: '', EMAILJS_PUBLIC_KEY: '', EMAILJS_PRIVATE_KEY: '' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  server.stderr.on('data', data => { logs += data.toString(); });
  server.on('error', error => { serverError = error; });
  server.on('exit', code => { serverError = new Error(`PHP terminó: ${code}`); });
  for (let i = 0; i < 50; i++) {
    if (serverError) throw serverError;
    try { if ((await fetch(`${base}/quiz/`)).ok) return; } catch {}
    await setTimeout(100);
  }
  throw new Error('No inició el servidor PHP para el paquete de hosting.');
});

after(async () => {
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill();
    await stopped;
  }
  // Solo retirar la copia temporal creada por esta prueba, nunca una entrega.
  if (directory && directory.startsWith(resolve('.runtime') + sep)) rmSync(directory, { recursive: true, force: true });
});

test('la página compilada utiliza /quiz/api/ y sus recursos públicos existen', async () => {
  const page = await fetch(`${base}/quiz/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /data-api-base="\/quiz\/api\/"/);
  const assets = [...html.matchAll(/(?:src|href)="(\/quiz\/_astro\/[^\"]+)"/g)];
  assert.ok(assets.length >= 3);
  for (const [, path] of assets) assert.equal((await fetch(base + path)).status, 200, path);
});

test('la instalación crea y conserva una sesión usando la carpeta privada', async () => {
  const first = await fetch(`${base}/quiz/api/session.php`);
  assert.equal(first.status, 200);
  assert.match(first.headers.get('cache-control'), /no-store/);
  const token = (await first.json()).csrfToken;
  assert.match(token, /^[a-f0-9]{64}$/);
  const cookie = first.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  const second = await fetch(`${base}/quiz/api/session.php`, { headers: { Cookie: cookie.split(';')[0] } });
  assert.equal((await second.json()).csrfToken, token);
  const sessionId = cookie.match(/tienda_quiz_session=([^;]+)/)[1];
  assert.ok(existsSync(resolve(directory, 'quiz-private/.runtime/sessions', `sess_${sessionId}`)));
  assert.equal((await fetch(`${base}/quiz/api/submit.php`)).status, 405);
});

test('un registro válido llega hasta la configuración privada sin enviar correo', async () => {
  const identity = await fetch(`${base}/quiz/api/session.php`);
  const { csrfToken } = await identity.json();
  const response = await fetch(`${base}/quiz/api/submit.php`, {
    method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken,
      Cookie: identity.headers.get('set-cookie').split(';')[0],
    },
    body: JSON.stringify({
      requestId: randomUUID(), name: 'Prueba local de instalación', consent: true, website: '',
      answers: Array.from({ length: 12 }, (_, i) => ({ questionId: i + 1, value: 1 })),
    }),
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /No pudimos confirmar/);
  assert.match(logs, /code=1005/);
});

test('los archivos privados y las credenciales locales no forman parte de la carpeta pública', async () => {
  assert.ok(!existsSync(resolve(directory, 'quiz-private/backend/config.local.php')));
  for (const path of ['/quiz-private/shared/quiz.json', '/quiz/backend/config.local.php', '/quiz/shared/quiz.json']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});

test('una instalación incompleta devuelve JSON y registra la causa sin exponer rutas', async () => {
  const file = resolve(directory, 'quiz-private/backend/http.php');
  renameSync(file, file + '.test-backup');
  try {
    const response = await fetch(`${base}/quiz/api/session.php`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.match(body.message, /No pudimos iniciar/);
    assert.ok(!JSON.stringify(body).includes(directory));
    assert.match(logs, /setup: private_files_missing/);
  } finally { renameSync(file + '.test-backup', file); }
});

test('un directorio de sesiones inutilizable se detecta sin entregar un token falso', async () => {
  const sessions = resolve(directory, 'quiz-private/.runtime/sessions');
  renameSync(sessions, sessions + '.test-backup');
  writeFileSync(sessions, 'archivo que impide crear el directorio');
  try {
    const response = await fetch(`${base}/quiz/api/session.php`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).csrfToken, undefined);
    assert.match(logs, /code=1001/);
  } finally {
    rmSync(sessions);
    renameSync(sessions + '.test-backup', sessions);
  }
});
