import { readFileSync } from 'node:fs';
import quiz from '../shared/quiz.json' with { type: 'json' };
import type { Result } from '../src/scripts/scoring.ts';
import type { Submission } from './submission.ts';

export type Environment = Record<string, string | undefined>;
export type EmailConfig = { serviceId: string; templateId: string; publicKey: string; privateKey: string };
export class DeliveryError extends Error {
  status: number;
  uncertain: boolean;
  constructor(status: number, uncertain = false) {
    super('No pudimos confirmar el envío del diagnóstico.');
    this.status = status; this.uncertain = uncertain;
  }
}
export function emailConfig(env: Environment): EmailConfig {
  const config = { serviceId: env.EMAILJS_SERVICE_ID, templateId: env.EMAILJS_TEMPLATE_ID, publicKey: env.EMAILJS_PUBLIC_KEY, privateKey: env.EMAILJS_PRIVATE_KEY };
  if (Object.values(config).some(value => !value?.trim())) throw new Error('EmailJS no configurado.');
  return config as EmailConfig;
}
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);

export function quizEmailContent(submission: Submission, result: Result, now = new Date()) {
  const answers = new Map(submission.answers.map(answer => [answer.questionId, answer.value]));
  const areasHtml = result.areas.map(area => {
    const priority = result.criticalAreas.includes(area.id) ? ' <span style="padding:2px 7px;background:#fff0d6;color:#845000;font-size:11px;font-weight:bold">PRIORIDAD</span>' : '';
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #e5ebef;color:#102a43;font-weight:bold">${escapeHtml(area.label)}${priority}</td><td align="right" style="padding:12px 0;border-bottom:1px solid #e5ebef;color:#102a43;font-weight:bold">${area.percentage} %</td></tr>`;
  }).join('');
  const answersHtml = quiz.questions.map(question => {
    const value = answers.get(question.id)!;
    return `<tr><td style="padding:15px 0;border-bottom:1px solid #e5ebef;color:#17212b;font-size:14px;line-height:1.5"><strong style="color:#102a43">${question.id}. ${escapeHtml(question.text)}</strong><br><span style="color:#53677a">${escapeHtml(question.options[value])}</span></td><td align="right" valign="top" style="padding:15px 0 15px 14px;border-bottom:1px solid #e5ebef;color:#845000;font-size:12px;font-weight:bold;white-space:nowrap">${value} / 3</td></tr>`;
  }).join('');
  const priority = result.areas.filter(area => result.criticalAreas.includes(area.id)).map(area => area.label).join(', ') || 'Sin área crítica';
  const registration = `<p style="color:#66788a;font-size:12px;line-height:1.5">Registro: ${escapeHtml(submission.requestId)}<br>Puntaje: ${result.score} / ${result.maxScore}<br>Versión: ${escapeHtml(quiz.version)}<br>Consentimiento: aceptado para enviar el diagnóstico.</p>`;
  const date = `${String(now.getUTCDate()).padStart(2, '0')}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${now.getUTCFullYear()} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
  const fields: Record<string, string> = { date, name: escapeHtml(submission.name), percentage: String(result.percentage), title: escapeHtml(result.title), description: escapeHtml(result.description), areas_html: areasHtml, priority: escapeHtml(priority), answers_html: answersHtml, registration_html: registration };
  const html = readFileSync(new URL('../shared/quiz-email.html', import.meta.url), 'utf8').replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => fields[key] ?? '');
  const text = `EL QUE TENGA TIENDA\n\nNombre: ${submission.name}\nÍndice: ${result.percentage}% (${result.title})\nPuntaje: ${result.score} de ${result.maxScore}\nÁrea(s) crítica(s): ${priority}\n\nRespuestas:\n` + quiz.questions.map(question => `${question.id}. ${question.text}\n${question.options[answers.get(question.id)!]}\n\n`).join('');
  return { subject: `Nuevo Test de Dependencia: ${submission.name} (${result.percentage}%)`, html, text };
}

export async function sendQuizEmail(submission: Submission, result: Result, config: EmailConfig, transport: typeof fetch = fetch) {
  const content = quizEmailContent(submission, result);
  let response: Response;
  try {
    response = await transport('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
      signal: AbortSignal.timeout(10000), redirect: 'error',
      body: JSON.stringify({
        service_id: config.serviceId, template_id: config.templateId, user_id: config.publicKey, accessToken: config.privateKey,
        template_params: {
          to_email: 'carolina.candedo@elquetenga.com', from_email: 'jesus.rivas01@elquetengatienda.com', from_name: 'El que tenga tienda',
          subject: content.subject, html_content: content.html, text_content: content.text, request_id: submission.requestId,
        },
      }),
    });
    if (response.status === 200 && (await response.text()).trim() === 'OK') return;
  } catch {
    throw new DeliveryError(503, true);
  }
  // Nunca devolver el cuerpo del proveedor: puede contener información privada.
  throw new DeliveryError(response.status === 429 ? 429 : 503, response.status >= 500 || response.status === 200);
}
