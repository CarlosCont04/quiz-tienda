import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { calculateResult } from '../src/scripts/scoring.ts';
import { validateSubmission } from './submission.ts';
import { emailConfig, sendQuizEmail, DeliveryError, type Environment } from './email.ts';

type Session = { sid: string; exp: number };
type Receipt = { sid: string; exp: number; entries: { id: string; hash: string }[] };
type Attempt = { hash: string; at: number; state: 'pending' | 'sent' | 'uncertain' };
const sessionCookie = 'quiz_vercel_session';
const receiptCookie = 'quiz_vercel_receipt';
const day = 86400;
const unavailable = 'No pudimos confirmar el envío del diagnóstico. Tus respuestas siguen aquí; puedes reintentar.';

const json = (body: unknown, status = 200, headers: HeadersInit = {}) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', ...headers },
});
function cookie(request: Request, name: string) {
  return (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}
function equal(a: string, b: string) {
  const first = Buffer.from(a); const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
function signature(value: string, key: string, purpose: string) {
  return createHmac('sha256', key).update(`quiz-tienda:${purpose}:v1:${value}`).digest('base64url');
}
function sign(value: unknown, key: string, purpose: string) {
  const data = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${data}.${signature(data, key, purpose)}`;
}
function verify<T extends { exp: number }>(token: string, key: string, purpose: string): T | null {
  if (token.length > 3800) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !equal(parts[1], signature(parts[0], key, purpose))) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as T;
    return typeof value.exp === 'number' && value.exp > Date.now() / 1000 ? value : null;
  } catch { return null; }
}
function setCookie(request: Request, name: string, value: string) {
  const secure = new URL(request.url).protocol === 'https:';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${day}${secure ? '; Secure' : ''}`;
}
function methodError(request: Request, expected: string) {
  if (request.method !== expected) return json({ message: 'Método no permitido.' }, 405, { Allow: expected });
  if (request.headers.get('sec-fetch-site') === 'cross-site') return json({ message: 'Abre el quiz desde su sitio para continuar.' }, 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ message: 'Origen no permitido.' }, 403);
  return null;
}
async function readBody(request: Request) {
  if (Number(request.headers.get('content-length')) > 16384) throw new RangeError('Cuerpo demasiado grande.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('El envío no es válido.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new RangeError('Cuerpo demasiado grande.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

// Memoria acotada por instancia, sin SQL ni almacenamiento de nombres/respuestas.
// La cookie firmada recuerda los últimos 8 envíos confirmados entre instancias.
export function createQuizHandlers(env: Environment, transport: typeof fetch = fetch) {
  const attempts = new Map<string, Attempt>();
  const limits = new Map<string, number[]>();

  async function session(request: Request): Promise<Response> {
    const invalid = methodError(request, 'GET'); if (invalid) return invalid;
    try {
      const { privateKey } = emailConfig(env);
      const existing = verify<Session>(cookie(request, sessionCookie), privateKey, 'session');
      const value = existing || { sid: randomBytes(24).toString('hex'), exp: Math.floor(Date.now() / 1000) + day };
      return json({ csrfToken: signature(value.sid, privateKey, 'csrf') }, 200, {
        'Set-Cookie': setCookie(request, sessionCookie, sign(value, privateKey, 'session')),
      });
    } catch { return json({ message: unavailable }, 503); }
  }

  async function submit(request: Request): Promise<Response> {
    const invalid = methodError(request, 'POST'); if (invalid) return invalid;
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ message: 'El formato de envío debe ser JSON.' }, 415);
    try {
      const config = emailConfig(env);
      const current = verify<Session>(cookie(request, sessionCookie), config.privateKey, 'session');
      if (!current || !equal(request.headers.get('x-csrf-token') || '', signature(current.sid, config.privateKey, 'csrf'))) return json({ message: 'La sesión expiró. Intenta registrar nuevamente.' }, 403);
      const now = Date.now();
      for (const [id, entry] of attempts) if (entry.at < now - day * 1000) attempts.delete(id);
      for (const [id, entries] of limits) if (entries.every(time => time < now - 900000)) limits.delete(id);
      const recent = (limits.get(current.sid) || []).filter(time => time > now - 900000);
      if (recent.length >= 30) return json({ message: 'Has realizado varios intentos. Espera 15 minutos antes de volver a enviar.' }, 429, { 'Retry-After': '900' });
      recent.push(now); limits.set(current.sid, recent);
      if (limits.size > 1000) limits.delete(limits.keys().next().value!);
      let submission;
      try { submission = validateSubmission(await readBody(request)); }
      catch (error) {
        if (error instanceof RangeError) return json({ message: 'El envío excede el tamaño permitido.' }, 413);
        return json({ message: error instanceof SyntaxError ? 'El envío no contiene un JSON válido.' : (error as Error).message }, 422);
      }
      const result = calculateResult(submission.answers);
      const hash = createHash('sha256').update(JSON.stringify(submission)).digest('hex');
      const key = `${current.sid}:${submission.requestId}`;
      const previous = attempts.get(key);
      const receipt = verify<Receipt>(cookie(request, receiptCookie), config.privateKey, 'receipt');
      const entries = receipt?.sid === current.sid ? receipt.entries : [];
      const confirmed = entries.find(entry => entry.id === submission.requestId);
      if ((previous && !equal(previous.hash, hash)) || (confirmed && !equal(confirmed.hash, hash))) return json({ message: 'Este intento corresponde a otros datos. Usa los datos originales o inicia otro test.' }, 409);
      const success = (status: number) => {
        const updated = [...entries.filter(entry => entry.id !== submission.requestId), { id: submission.requestId, hash }].slice(-8);
        return json({ message: 'Gracias por responder el quiz', result }, status, {
          'Set-Cookie': setCookie(request, receiptCookie, sign({ sid: current.sid, exp: current.exp, entries: updated }, config.privateKey, 'receipt')),
        });
      };
      if (confirmed || previous?.state === 'sent') return success(200);
      if (previous?.state === 'pending') return json({ message: 'Este diagnóstico se está enviando. Espera unos segundos antes de reintentar.' }, 409);
      if (previous?.state === 'uncertain') return json({ message: `La entrega no se pudo confirmar. Contacta al equipo e indica el registro ${submission.requestId} antes de repetir el envío.` }, 409);
      if (attempts.size >= 1000) return json({ message: 'El servicio está ocupado. Intenta de nuevo más tarde.' }, 429, { 'Retry-After': '60' });
      attempts.set(key, { hash, at: now, state: 'pending' });
      try {
        await sendQuizEmail(submission, result, config, transport);
      } catch (error) {
        if (error instanceof DeliveryError && error.uncertain) attempts.set(key, { hash, at: now, state: 'uncertain' });
        else attempts.delete(key);
        if (error instanceof DeliveryError && error.status === 429) return json({ message: 'El servicio de correo está ocupado. Espera unos segundos y vuelve a intentarlo.' }, 429, { 'Retry-After': '1' });
        return json({ message: error instanceof DeliveryError && error.uncertain ? `La entrega no se pudo confirmar. Contacta al equipo e indica el registro ${submission.requestId} antes de repetir el envío.` : unavailable }, 503);
      }
      attempts.set(key, { hash, at: now, state: 'sent' });
      return success(201);
    } catch {
      return json({ message: unavailable }, 503);
    }
  }
  return { session, submit };
}
const handlers = createQuizHandlers(process.env);
export const sessionHandler = handlers.session;
export const submitHandler = handlers.submit;
