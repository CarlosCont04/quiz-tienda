import { calculateResult, type Answer } from '../src/scripts/scoring.ts';

export type Submission = { requestId: string; name: string; consent: true; answers: Answer[] };

export function validateSubmission(input: unknown): Submission {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('El envío no es válido.');
  const data = input as Record<string, unknown>;
  if (typeof data.name !== 'string') throw new Error('Escribe tu nombre para registrar tu resultado.');
  const name = data.name.trim();
  if ([...name].length < 2 || [...name].length > 120 || /[\u0000-\u001f\u007f<>]/u.test(name)) throw new Error('Escribe un nombre válido de 2 a 120 caracteres.');
  if (data.consent !== true) throw new Error('Acepta el envío de tus datos para registrar el diagnóstico.');
  if (typeof data.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)) throw new Error('El identificador de registro no es válido. Vuelve a abrir el test.');
  if (data.website !== undefined && data.website !== '') throw new Error('No fue posible registrar el resultado.');
  // Valida IDs únicos, cantidad, tipos y rango mediante la misma función de cálculo.
  calculateResult(data.answers as Answer[]);
  return { requestId: data.requestId.toLowerCase(), name, consent: true, answers: (data.answers as Answer[]).map(({ questionId, value }) => ({ questionId, value })).sort((a, b) => a.questionId - b.questionId) };
}
