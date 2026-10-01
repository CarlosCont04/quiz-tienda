import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import definition from '../shared/quiz.json' with { type: 'json' };
import { createDiagnosisPdf, diagnosisFilename } from '../src/scripts/diagnosis-pdf.ts';
import { calculateResult, type Answer } from '../src/scripts/scoring.ts';

// El documento usa texto PDF estándar con fuentes WinAnsi, sin imágenes ni HTML.
function pdfText(bytes: ArrayBuffer): string {
  const raw = Buffer.from(bytes).toString('latin1');
  const texts: string[] = [];
  for (const match of raw.matchAll(/<<([^]*?)>>\s*stream\r?\n/g)) {
    const length = Number(match[1].match(/\/Length\s+(\d+)/)?.[1]);
    if (!length) continue;
    const start = match.index! + match[0].length;
    const compressed = Buffer.from(raw.slice(start, start + length), 'latin1');
    const stream = match[1].includes('/FlateDecode') ? inflateSync(compressed) : compressed;
    for (const text of stream.toString('latin1').matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
      texts.push(text[1].replace(/\\([()\\])/g, '$1'));
    }
  }
  return texts.join(' ').replace(/\s+/g, ' ');
}
const date = new Date(2026, 9, 1, 12);
const answersFor = (value: number): Answer[] => definition.questions.map(question => ({ questionId: question.id, value }));

test('el PDF contiene resultados reales, acentos, recomendaciones y las doce respuestas', () => {
  for (const value of [0, 1, 2, 3]) {
    const answers = answersFor(value).reverse();
    const result = calculateResult(answers);
    const doc = createDiagnosisPdf(answers, date);
    const bytes = doc.output('arraybuffer');
    assert.match(Buffer.from(bytes).toString('latin1'), /^%PDF-/);
    const text = pdfText(bytes);
    assert.ok(text.includes(result.title));
    assert.ok(text.includes(`${result.percentage}%`));
    assert.ok(text.includes(`${result.score} de 36 puntos de dependencia`));
    assert.ok(text.includes('Por dónde empezar'));
    for (const area of result.areas) {
      assert.ok(text.includes(area.label));
      if (result.criticalAreas.includes(area.id)) assert.ok(text.includes(area.nextStep));
    }
    for (const question of definition.questions) {
      assert.ok(text.includes(question.text), question.text);
      assert.ok(text.includes(`Respuesta: ${question.options[value]} (${value} / 3 puntos)`));
    }
    assert.ok(doc.getNumberOfPages() >= 2 && doc.getNumberOfPages() <= 4);
    if (value === 0) assert.ok(text.includes('Sin un área crítica de dependencia'));
  }
});

test('el PDF distingue el empate entre Finanzas y Ventas y mantiene las respuestas por pregunta', () => {
  const answers = answersFor(0);
  for (const id of [2, 3, 5]) answers[id - 1].value = 3;
  answers[5].value = 1;
  const text = pdfText(createDiagnosisPdf(answers, date).output('arraybuffer'));
  assert.ok(text.includes('Áreas críticas: Finanzas, Ventas'));
  assert.ok(text.includes('Estas áreas comparten el mayor porcentaje de dependencia.'));
  assert.ok(text.includes('Respuesta: No lo sé (3 / 3 puntos)'));
});

test('la descarga usa un nombre estable y rechaza respuestas incompletas', () => {
  assert.equal(diagnosisFilename(date), 'diagnostico-dependencia-2026-10-01.pdf');
  assert.throws(() => createDiagnosisPdf([], date), /Responde las 12 preguntas/);
  const duplicate = answersFor(1); duplicate[11].questionId = 1;
  assert.throws(() => createDiagnosisPdf(duplicate, date), /Respuesta inválida/);
});
