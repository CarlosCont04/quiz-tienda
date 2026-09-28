import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createQuizHandlers } from '../server/handlers.ts';
import { quizEmailContent } from '../server/email.ts';
import { validateSubmission } from '../server/submission.ts';
import { calculateResult } from '../src/scripts/scoring.ts';
import sessionEndpoint from '../api/session.ts';
import submitEndpoint from '../api/submit.ts';

const env = { EMAILJS_SERVICE_ID: 'service_test', EMAILJS_TEMPLATE_ID: 'template_test', EMAILJS_PUBLIC_KEY: 'public_test', EMAILJS_PRIVATE_KEY: 'private_test_only_no_real_email' };
const base = 'https://quiz.example';
const input = (value = 3) => ({ requestId: randomUUID(), name: 'José & María', consent: true, website: '', answers: Array.from({ length: 12 }, (_, i) => ({ questionId: i + 1, value })) });
type Identity = { csrf: string; cookie: string };
async function identity(api: ReturnType<typeof createQuizHandlers>): Promise<Identity> {
  const response = await api.session(new Request(`${base}/api/session.php`));
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Secure/);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  return { csrf: (await response.json()).csrfToken, cookie: cookie.split(';')[0] };
}
const request = (user: Identity, data: unknown, extra: Record<string, string> = {}) => new Request(`${base}/api/submit.php`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: user.cookie, 'X-CSRF-Token': user.csrf, Origin: base, ...extra },
  body: typeof data === 'string' ? data : JSON.stringify(data),
});
const mockTransport = (fn: (url: string, options: RequestInit) => Response | Promise<Response>) => (async (url, options) => fn(String(url), options!)) as typeof fetch;

test('las funciones Vercel exponen handlers Web y conservan las rutas del frontend', () => {
  assert.equal(typeof sessionEndpoint.fetch, 'function'); assert.equal(typeof submitEndpoint.fetch, 'function');
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.deepEqual(config.rewrites, [
    { source: '/api/session.php', destination: '/api/session' },
    { source: '/api/submit.php', destination: '/api/submit' },
  ]);
});
test('envía los tres niveles por EmailJS sin SQL, calcula en servidor y mantiene destinatarios fijos', async () => {
  const deliveries: Record<string, any>[] = [];
  const api = createQuizHandlers(env, mockTransport((url, options) => {
    assert.equal(url, 'https://api.emailjs.com/api/v1.0/email/send');
    assert.equal(options.redirect, 'error');
    deliveries.push(JSON.parse(String(options.body)));
    return new Response('OK');
  }));
  for (const [value, expected] of [[0, 'baja'], [1, 'media'], [3, 'alta']] as const) {
    const user = await identity(api); const body = input(value);
    const response = await api.submit(request(user, { ...body, score: 0, to_email: 'attacker@example.invalid' }));
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.result.score, value * 12); assert.equal(result.result.key, expected);
    assert.equal(result.message, 'Gracias por responder el quiz');
    assert.doesNotMatch(JSON.stringify(result), /private_test_only/);
  }
  assert.equal(deliveries.length, 3);
  for (const payload of deliveries) {
    assert.equal(payload.accessToken, env.EMAILJS_PRIVATE_KEY);
    assert.equal(payload.template_params.to_email, 'carolina.candedo@elquetenga.com');
    assert.equal(payload.template_params.from_email, 'jesus.rivas01@elquetengatienda.com');
    assert.match(payload.template_params.html_content, /José &amp; María/);
    assert.match(payload.template_params.html_content, /12\. Cuando algo sale mal/);
    assert.match(payload.template_params.html_content, /#102a43/);
    assert.match(payload.template_params.html_content, /#f39200/);
    assert.doesNotMatch(payload.template_params.html_content, /\{\{[a-z_]+\}\}/);
  }
});
test('recibo firmado evita repetir envíos confirmados incluso en una instancia nueva', async () => {
  let sent = 0;
  const transport = mockTransport(() => { sent++; return new Response('OK'); });
  const api = createQuizHandlers(env, transport); const user = await identity(api); const data = input();
  const response = await api.submit(request(user, data)); assert.equal(response.status, 201);
  const receipt = response.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await api.submit(request(user, data))).status, 200);
  const cold = createQuizHandlers(env, transport);
  const returning = { ...user, cookie: `${user.cookie}; ${receipt}` };
  assert.equal((await cold.submit(request(returning, { ...data, answers: [...data.answers].reverse() }))).status, 200);
  assert.equal((await cold.submit(request(returning, { ...data, name: 'Otro nombre' }))).status, 409);
  assert.equal(sent, 1);
});
test('bloquea envíos concurrentes de un mismo registro en una instancia', async () => {
  let resolveDelivery!: (value: Response) => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const api = createQuizHandlers(env, mockTransport(() => { entered(); return new Promise(resolve => { resolveDelivery = resolve; }); }));
  const user = await identity(api); const data = input();
  const first = api.submit(request(user, data)); await started;
  assert.equal((await api.submit(request(user, data))).status, 409);
  resolveDelivery(new Response('OK'));
  assert.equal((await first).status, 201);
});
test('rechaza CSRF, cookies alteradas, origen ajeno, métodos, formatos y respuestas inválidas', async () => {
  const api = createQuizHandlers(env, mockTransport(() => { throw new Error('Nunca debe enviar'); }));
  const user = await identity(api); const data = input();
  assert.equal((await api.submit(new Request(`${base}/api/submit.php`))).status, 405);
  assert.equal((await api.submit(request(user, data, { 'X-CSRF-Token': 'fake' }))).status, 403);
  assert.equal((await api.submit(request(user, data, { Cookie: `${user.cookie}modified` }))).status, 403);
  assert.equal((await api.submit(request(user, data, { Origin: 'https://attacker.example' }))).status, 403);
  assert.equal((await api.submit(request(user, data, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403);
  assert.equal((await api.submit(request(user, data, { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal((await api.submit(request(user, 'x'.repeat(17000)))).status, 413);
  assert.equal((await api.submit(request(user, '{broken'))).status, 422);
  for (const bad of [{ ...data, consent: false }, { ...data, name: '<script>' }, { ...data, answers: data.answers.slice(1) }, { ...data, answers: data.answers.map(() => ({ questionId: 1, value: 3 })) }, { ...data, answers: data.answers.map(a => ({ ...a, value: '3' })) }, { ...data, website: 'bot' }]) {
    assert.equal((await api.submit(request(user, bad))).status, 422);
  }
});
test('fallos y saturación de EmailJS no se anuncian como éxito ni exponen claves', async () => {
  for (const code of [400, 401, 429, 500]) {
    const api = createQuizHandlers(env, mockTransport(() => new Response('private_test_only', { status: code })));
    const user = await identity(api); const data = input();
    const response = await api.submit(request(user, data));
    assert.equal(response.status, code === 429 ? 429 : 503);
    assert.doesNotMatch(await response.text(), /private_test_only/);
    if (code === 500) assert.equal((await api.submit(request(user, data))).status, 409);
  }
  let attempts = 0;
  const api = createQuizHandlers(env, mockTransport(() => { attempts++; throw new Error('Timeout'); }));
  const user = await identity(api); const data = input();
  assert.equal((await api.submit(request(user, data))).status, 503);
  assert.equal((await api.submit(request(user, data))).status, 409);
  assert.equal(attempts, 1);
  assert.equal((await createQuizHandlers({}).session(new Request(`${base}/api/session.php`))).status, 503);
});
test('límite de 30 intentos por sesión e instancia', async () => {
  const api = createQuizHandlers(env, mockTransport(() => { throw new Error('No enviar'); }));
  const user = await identity(api);
  for (let i = 0; i < 30; i++) assert.equal((await api.submit(request(user, {}))).status, 422);
  const response = await api.submit(request(user, {}));
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '900');
});
test('la plantilla PHP y la plantilla Node producen el mismo HTML', () => {
  const raw = input(2);
  const submission = validateSubmission(raw);
  const content = quizEmailContent(submission, calculateResult(submission.answers));
  const php = process.env.PHP_BINARY || (existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
  const run = spawnSync(php, ['tests/email-content.php'], { input: JSON.stringify(raw), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const normalizeDate = (html: string) => html.replace(/Registro de \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} UTC/, 'Registro de FECHA UTC');
  assert.equal(normalizeDate(content.html), normalizeDate(JSON.parse(run.stdout).html));
});
