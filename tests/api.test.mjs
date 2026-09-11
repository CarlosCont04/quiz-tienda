import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

const php = process.env.PHP_BINARY || (existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
const env = { ...process.env, DB_NAME: 'quiz_tienda_test' };
const base = 'http://127.0.0.1:8083/api/';
const ids = [];
let server;
let serverError;
const runPhp = args => {
  const result = spawnSync(php, args, { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
};
async function session() {
  const response = await fetch(`${base}session.php`);
  assert.equal(response.status, 200);
  const cookieHeader = response.headers.get('set-cookie');
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);
  return { token: (await response.json()).csrfToken, cookie: cookieHeader.split(';')[0] };
}
const payload = value => {
  const requestId = randomUUID(); ids.push(requestId);
  return { requestId, name: "PRUEBA AUTOMATIZADA José O’Connor", consent: true, website: '', answers: Array.from({ length: 12 }, (_, i) => ({ questionId: i + 1, value })) };
};
const submit = (identity, body, headers = {}) => fetch(`${base}submit.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: identity.cookie, 'X-CSRF-Token': identity.token, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
before(async () => {
  runPhp(['scripts/setup-db.php']);
  mkdirSync('.runtime/tmp', { recursive: true });
  server = spawn(php, ['-d', 'display_errors=0', '-d', 'display_startup_errors=0', '-d', `sys_temp_dir=${resolve('.runtime/tmp')}`, '-S', '127.0.0.1:8083', '-t', 'public'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr.on('data', () => {});
  server.on('error', error => { serverError = error; });
  server.on('exit', code => { serverError = new Error(`PHP terminó: ${code}`); });
  for (let i = 0; i < 40; i++) {
    if (serverError) throw serverError;
    try { await session(); return; } catch { await setTimeout(100); }
  }
  throw new Error('El servidor PHP de pruebas no inició en 8083.');
});
after(async () => {
  for (const id of ids) runPhp(['tests/db-record.php', 'delete', id]);
  server?.kill();
});
test('guarda los tres niveles, 12 respuestas y nombre Unicode en MySQL', async () => {
  for (const [value, key, percentage] of [[0, 'baja', 0], [1, 'media', 33], [3, 'alta', 100]]) {
    const identity = await session(); const input = payload(value);
    const response = await submit(identity, { ...input, total_score: 0, result_key: 'baja' });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.message, 'Gracias por responder el quiz');
    assert.equal(body.result.key, key); assert.equal(body.result.percentage, percentage);
    const record = JSON.parse(runPhp(['tests/db-record.php', 'read', input.requestId]));
    assert.equal(record.full_name, input.name);
    assert.equal(Number(record.total_score), value * 12);
    assert.equal(Number(record.answer_count), 12);
    assert.equal(Number(record.answer_score), value * 12);
    assert.equal(record.result_key, key);
    assert.equal(record.consent_version, 'registro-nombre-2026-1');
  }
});
test('un reintento no duplica; otro contenido o sesión no reutiliza el registro', async () => {
  const identity = await session(); const input = payload(2);
  assert.equal((await submit(identity, input)).status, 201);
  assert.equal((await submit(identity, input)).status, 200);
  assert.equal((await submit(identity, { ...input, answers: [...input.answers].reverse() })).status, 200);
  assert.equal((await submit(identity, { ...input, name: 'PRUEBA AUTOMATIZADA Otro' })).status, 409);
  assert.equal((await submit(await session(), input)).status, 409);
  const record = JSON.parse(runPhp(['tests/db-record.php', 'read', input.requestId]));
  assert.equal(Number(record.answer_count), 12);
});
test('rechaza CSRF, origen ajeno, métodos y formatos incorrectos', async () => {
  const identity = await session(); const input = payload(1);
  assert.equal((await fetch(`${base}submit.php`)).status, 405);
  assert.equal((await submit(identity, input, { 'X-CSRF-Token': 'invalid' })).status, 403);
  assert.equal((await submit(identity, input, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await submit(identity, input, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await submit(identity, 'x'.repeat(17000))).status, 413);
  assert.equal((await submit(identity, '{invalid')).status, 422);
  assert.equal((await submit(identity, { ...input, consent: false })).status, 422);
  assert.equal((await submit(identity, { ...input, name: '<script>' })).status, 422);
  assert.equal((await submit(identity, { ...input, answers: input.answers.slice(1) })).status, 422);
  assert.equal(JSON.parse(runPhp(['tests/db-record.php', 'read', input.requestId])), null);
});
test('el límite de sesión devuelve 429 sin guardar datos inválidos', async () => {
  const identity = await session();
  for (let i = 0; i < 30; i++) assert.equal((await submit(identity, {})).status, 422);
  const response = await submit(identity, {});
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '900');
});
