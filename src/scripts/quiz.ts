import definition from '../../shared/quiz.json';
import { calculateResult, type Answer, type Result } from './scoring';

function element<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing interface element: ${selector}`);
  return node;
}
const card = element<HTMLElement>('#quiz');
const form = element<HTMLFormElement>('#quiz-form');
const registration = element<HTMLFormElement>('#registration-form');
const steps = [...form.querySelectorAll<HTMLFieldSetElement>('.question-step')];
const previous = element<HTMLButtonElement>('#previous-question');
const dialog = element<HTMLDialogElement>('#result-dialog');
const progress = element<HTMLProgressElement>('#quiz-progress');
const error = element<HTMLParagraphElement>('#question-error');
const status = element<HTMLParagraphElement>('#save-status');
const save = element<HTMLButtonElement>('#save-result');
const name = element<HTMLInputElement>('#participant-name');
const download = element<HTMLButtonElement>('#download-diagnosis');
const downloadLabel = element<HTMLElement>('#download-label');
const downloadStatus = element<HTMLParagraphElement>('#download-status');
const answers = new Map<number, number>();
let current = 0;
let completedAnswers: Answer[] = [];
let requestId = '';
let saving = false;
let saved = false;
let downloading = false;
let csrfToken = '';
let restoreFocus: HTMLElement | null = null;
const apiBase = card.dataset.apiBase!;

function newRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function updateProgress() {
  progress.value = answers.size;
  progress.textContent = `${answers.size} de 12`;
  element('#answered-label').textContent = `${answers.size} de 12 respondidas`;
}
function showQuestion(index: number) {
  current = index;
  steps.forEach((step, i) => { step.hidden = i !== index; step.disabled = i !== index; });
  previous.disabled = index === 0;
  element('#step-label').textContent = `Pregunta ${String(index + 1).padStart(2, '0')} de 12`;
  element('#next-label').textContent = index === steps.length - 1 ? 'Ver mi resultado' : 'Siguiente';
  error.hidden = true;
  steps[index].querySelector<HTMLElement>('.question-title')!.focus();
}
function renderResult(result: Result) {
  element('#result-percentage').textContent = String(result.percentage);
  element('#result-title').textContent = result.title;
  element('#result-score').textContent = `${result.score} de ${result.maxScore} puntos de dependencia`;
  element('#result-description').textContent = result.description;
  const dial = element('#score-dial');
  dial.style.setProperty('--percentage', `${result.percentage}%`);
  dial.style.setProperty('--score-color', `var(--color-${({ baja: 'low', media: 'medium', alta: 'high' } as Record<string,string>)[result.key]})`);
  for (const area of result.areas) {
    const row = element(`[data-area="${area.id}"]`);
    const critical = result.criticalAreas.includes(area.id);
    row.classList.toggle('is-critical', critical);
    row.querySelector<HTMLElement>('.critical-tag')!.hidden = !critical;
    row.querySelector<HTMLElement>('.area-percent')!.textContent = `${area.percentage} %`;
    const meter = row.querySelector('meter')!;
    meter.value = area.percentage;
    meter.textContent = `${area.percentage} %`;
  }
  const critical = result.areas.filter(area => result.criticalAreas.includes(area.id));
  element('#critical-title').textContent = critical.length ? `${critical.length > 1 ? 'Áreas críticas' : 'Área crítica'}: ${critical.map(area => area.label).join(', ')}` : 'Sin un área crítica de dependencia';
  const nextSteps = element('#critical-steps');
  nextSteps.replaceChildren();
  const descriptions = critical.length ? critical.map(area => ({ title: critical.length > 1 ? `${area.label}. ` : '', text: area.nextStep })) : [{ title: '', text: 'Todas tus áreas tienen un índice de 0 %. Tu siguiente reto es trabajar en escala, equipo y estrategia.' }];
  if (critical.length > 1) {
    const explanation = document.createElement('p');
    explanation.textContent = 'Estas áreas comparten el mayor porcentaje de dependencia. Elige una para empezar.';
    nextSteps.append(explanation);
  }
  descriptions.forEach(item => {
    const p = document.createElement('p');
    if (item.title) { const strong = document.createElement('strong'); strong.textContent = item.title; p.append(strong); }
    p.append(document.createTextNode(item.text));
    nextSteps.append(p);
  });
}
function openResult() {
  restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.showModal();
  dialog.scrollTop = 0;
  element('#result-title').focus({ preventScroll: true });
}
form.addEventListener('change', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
  answers.set(definition.questions[current].id, Number(input.value));
  error.hidden = true;
  updateProgress();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!answers.has(definition.questions[current].id)) {
    error.hidden = false;
    steps[current].querySelector<HTMLInputElement>('input')!.focus();
    return;
  }
  if (current < steps.length - 1) { showQuestion(current + 1); return; }
  completedAnswers = definition.questions.map(q => ({ questionId: q.id, value: answers.get(q.id)! }));
  renderResult(calculateResult(completedAnswers));
  requestId = newRequestId();
  form.hidden = true;
  element('#quiz-complete').hidden = false;
  element('#step-label').textContent = 'Test completado';
  openResult();
});
previous.addEventListener('click', () => { if (current > 0) showQuestion(current - 1); });
element('#close-result').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (restoreFocus?.checkVisibility()) restoreFocus.focus();
  else element('#reopen-result').focus();
});
element('#reopen-result').addEventListener('click', openResult);
element('#restart-quiz').addEventListener('click', () => {
  if (saving || downloading) return;
  answers.clear(); completedAnswers = []; requestId = ''; saved = false;
  form.reset(); registration.reset(); name.setCustomValidity('');
  registration.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = false; });
  save.disabled = false; save.textContent = 'Enviar mi diagnóstico'; status.hidden = true;
  downloadStatus.hidden = true;
  form.hidden = false; element('#quiz-complete').hidden = true;
  updateProgress(); showQuestion(0);
});
name.addEventListener('input', () => name.setCustomValidity(''));

download.addEventListener('click', async () => {
  if (downloading || completedAnswers.length !== definition.questions.length) return;
  downloading = true; download.disabled = true; downloadLabel.textContent = 'Preparando PDF…';
  downloadStatus.hidden = true;
  download.setAttribute('aria-busy', 'true');
  // Una copia fija conserva este diagnóstico mientras se carga el generador.
  const snapshot = completedAnswers.map(answer => ({ ...answer }));
  try {
    const { createDiagnosisPdf, diagnosisFilename } = await import('./diagnosis-pdf');
    const generatedAt = new Date();
    await createDiagnosisPdf(snapshot, generatedAt).save(diagnosisFilename(generatedAt), { returnPromise: true });
    downloadStatus.classList.remove('error-message');
    downloadStatus.textContent = 'Tu diagnóstico en PDF está listo. Revisa las descargas de tu navegador.';
  } catch {
    downloadStatus.classList.add('error-message');
    downloadStatus.textContent = 'No pudimos descargar el PDF. Intenta de nuevo; tu resultado sigue disponible.';
  } finally {
    downloading = false; download.disabled = false;
    downloadLabel.textContent = 'Descargar diagnóstico en PDF';
    download.removeAttribute('aria-busy');
    downloadStatus.hidden = false;
  }
});

async function fetchJson(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  return { response, data };
}
registration.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || saved) return;
  const cleanName = name.value.trim();
  if ([...cleanName].length < 2 || [...cleanName].length > 120 || /[\u0000-\u001f\u007f<>]/u.test(cleanName)) {
    name.setCustomValidity('Escribe un nombre válido de 2 a 120 caracteres.'); name.reportValidity(); return;
  }
  if (!registration.reportValidity()) return;
  saving = true; save.disabled = true; save.textContent = 'Enviando…';
  element<HTMLButtonElement>('#restart-quiz').disabled = true;
  status.hidden = true;
  registration.setAttribute('aria-busy', 'true');
  const payload = { requestId, name: cleanName, answers: completedAnswers, consent: true, website: element<HTMLInputElement>('#website').value };
  registration.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = true; });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!csrfToken) {
        const session = await fetchJson('session.php');
        if (!session.response.ok || typeof session.data.csrfToken !== 'string') throw new Error(session.data.message || 'No pudimos iniciar el registro. Intenta de nuevo.');
        csrfToken = session.data.csrfToken;
      }
      const { response, data } = await fetchJson('submit.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(payload),
      });
      if (response.status === 403 && attempt === 0) { csrfToken = ''; continue; }
      if (!response.ok) throw new Error(data.message || 'No pudimos enviar tu diagnóstico. Intenta de nuevo.');
      renderResult(data.result as Result);
      saved = true;
      status.classList.remove('error-message');
      status.textContent = `Listo, ${cleanName}. Tu diagnóstico fue aceptado para envío al correo del equipo. Gracias por responder el quiz.`;
      save.textContent = 'Diagnóstico enviado';
      break;
    }
  } catch (caught) {
    status.classList.add('error-message');
    status.textContent = caught instanceof Error && !['TypeError', 'TimeoutError', 'SyntaxError', 'AbortError'].includes(caught.name) ? caught.message : 'No pudimos confirmar el envío. Tu resultado sigue aquí; vuelve a intentarlo.';
    save.textContent = 'Reintentar envío';
  } finally {
    saving = false; save.disabled = saved;
    element<HTMLButtonElement>('#restart-quiz').disabled = false;
    registration.removeAttribute('aria-busy');
    if (!saved) registration.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = false; });
    status.hidden = false;
    if (dialog.open) status.focus({ preventScroll: true });
  }
});
