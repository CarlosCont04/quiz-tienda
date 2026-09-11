import definition from '../../shared/quiz.json' with { type: 'json' };

export type Answer = { questionId: number; value: number };
export type Result = ReturnType<typeof calculateResult>;

export function calculateResult(answers: Answer[]) {
  if (!Array.isArray(answers) || answers.length !== definition.questions.length) throw new Error('Responde las 12 preguntas.');
  const byId = new Map<number, number>();
  for (const answer of answers) {
    if (!answer || !Number.isInteger(answer.questionId) || !definition.questions.some(q => q.id === answer.questionId) || byId.has(answer.questionId) || !Number.isInteger(answer.value) || answer.value < 0 || answer.value > 3) throw new Error('Respuesta inválida o repetida.');
    byId.set(answer.questionId, answer.value);
  }
  const score = [...byId.values()].reduce((sum, value) => sum + value, 0);
  const percentage = Math.round(score / definition.maxScore * 100);
  const level = definition.results.find(level => percentage >= level.min && percentage <= level.max)!;
  const areas = definition.areas.map(area => {
    const areaScore = definition.questions.filter(q => q.area === area.id).reduce((sum, q) => sum + byId.get(q.id)!, 0);
    return { ...area, score: areaScore, percentage: Math.round(areaScore / area.maxScore * 100) };
  });
  // Compare ratios before rounding: areas contain different numbers of questions.
  const top = areas.reduce((a, b) => b.score * a.maxScore > a.score * b.maxScore ? b : a);
  const criticalAreas = score === 0 ? [] : areas.filter(area => area.score * top.maxScore === top.score * area.maxScore).map(area => area.id);
  return { score, maxScore: definition.maxScore, percentage, key: level.key, title: level.title, description: level.description, areas, criticalAreas };
}
