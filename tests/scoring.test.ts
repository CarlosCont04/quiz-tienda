import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { calculateResult, type Answer } from '../src/scripts/scoring.ts';

const answersFor = (score: number): Answer[] => Array.from({ length: 12 }, (_, i) => { const value = Math.min(3, score); score -= value; return { questionId: i + 1, value }; });
test('los 37 puntajes posibles tienen porcentaje y nivel correctos', () => {
  for (let score = 0; score <= 36; score++) {
    const result = calculateResult(answersFor(score));
    assert.equal(result.score, score);
    assert.equal(result.percentage, Math.round(score / 36 * 100));
    assert.equal(result.key, score <= 10 ? 'baja' : score <= 23 ? 'media' : 'alta');
  }
});
test('compara áreas por proporción y conserva empates', () => {
  const answers = answersFor(0);
  for (const id of [2, 3, 5]) answers[id - 1].value = 3;
  answers[3].value = 2; answers[5].value = 3;
  assert.deepEqual(calculateResult(answers).criticalAreas, ['ventas']);
  answers[3].value = 0; answers[5].value = 1;
  assert.deepEqual(calculateResult(answers).criticalAreas, ['finanzas', 'ventas']);
  assert.deepEqual(calculateResult(answersFor(0)).criticalAreas, []);
  assert.equal(calculateResult(answersFor(36)).criticalAreas.length, 5);
});
test('rechaza preguntas faltantes, repetidas y valores inválidos', () => {
  assert.throws(() => calculateResult([]));
  const duplicate = answersFor(12); duplicate[11].questionId = 1;
  assert.throws(() => calculateResult(duplicate));
  for (const value of [-1, 4, 0.5, NaN, '3', null]) {
    const answers = answersFor(12); answers[0].value = value as number;
    assert.throws(() => calculateResult(answers));
  }
});
test('TypeScript y PHP devuelven el mismo resultado para 293 casos', () => {
  const cases = Array.from({ length: 37 }, (_, score) => answersFor(score));
  let seed = 52801;
  for (let n = 0; n < 256; n++) cases.push(Array.from({ length: 12 }, (_, i) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return { questionId: i + 1, value: (seed >>> 16) % 4 };
  }));
  const php = process.env.PHP_BINARY || (existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
  const run = spawnSync(php, ['tests/calculate.php'], { input: JSON.stringify(cases), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), cases.map(calculateResult));
});
