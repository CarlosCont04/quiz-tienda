<?php
declare(strict_types=1);
require_once __DIR__ . '/../backend/quiz.php';
$checks = 0;
function verify(bool $condition, string $message): void {
    global $checks; $checks++;
    if (!$condition) throw new RuntimeException($message);
}
function reject(callable $run): void {
    try { $run(); } catch (InvalidArgumentException) { verify(true, 'rechazado'); return; }
    throw new RuntimeException('Se aceptó un dato inválido.');
}
function answersForScore(int $score): array {
    $answers = [];
    for ($i = 1; $i <= 12; $i++) { $answers[$i] = min(3, $score); $score -= $answers[$i]; }
    return $answers;
}
for ($score = 0; $score <= 36; $score++) {
    $result = calculateResult(answersForScore($score));
    verify($result['score'] === $score, "Puntaje $score");
    verify($result['percentage'] === (int) round($score / 36 * 100), "Porcentaje $score");
    verify($result['key'] === ($score <= 10 ? 'baja' : ($score <= 23 ? 'media' : 'alta')), "Nivel $score");
    verify(array_sum(array_column($result['areas'], 'score')) === $score, "Suma por áreas $score");
}
verify(calculateResult(answersForScore(0))['criticalAreas'] === [], 'Cero sin áreas críticas');
verify(count(calculateResult(answersForScore(36))['criticalAreas']) === 5, 'Empate en cinco áreas');
$areas = array_fill(1, 12, 0);
$areas[2] = 3; $areas[3] = 3; $areas[4] = 2; $areas[5] = 3; $areas[6] = 3;
verify(calculateResult($areas)['criticalAreas'] === ['ventas'], '6/6 supera a 8/9');
$areas[4] = 0; $areas[6] = 1;
verify(calculateResult($areas)['criticalAreas'] === ['finanzas', 'ventas'], '6/9 empata con 4/6');
$input = ['requestId' => '11111111-1111-4111-8111-111111111111', 'name' => '  José O’Connor  ', 'consent' => true, 'answers' => array_map(fn($id) => ['questionId' => $id, 'value' => 3], range(1, 12))];
$valid = validateSubmission($input);
verify($valid['name'] === 'José O’Connor', 'Nombre Unicode normalizado');
verify(calculateResult(validateSubmission($input + ['score' => 0, 'result_key' => 'baja'])['answers'])['score'] === 36, 'Puntaje del cliente ignorado');
foreach (['', ' ', 'A', str_repeat('é', 121), '<script>', "Juan\nPérez", 42, null] as $name) reject(fn() => validateSubmission(array_replace($input, ['name' => $name])));
foreach ([false, 1, 'true', null] as $consent) reject(fn() => validateSubmission(array_replace($input, ['consent' => $consent])));
foreach (['', 'not-a-uuid', [], null] as $id) reject(fn() => validateSubmission(array_replace($input, ['requestId' => $id])));
reject(fn() => validateSubmission(array_replace($input, ['website' => 'bot'])));
foreach ([-1, 4, 1.5, '3', true, null] as $value) {
    $bad = $input; $bad['answers'][0]['value'] = $value;
    reject(fn() => validateSubmission($bad));
}
$bad = $input; $bad['answers'][11]['questionId'] = 1; reject(fn() => validateSubmission($bad));
$bad = $input; array_pop($bad['answers']); reject(fn() => validateSubmission($bad));
$bad = $input; $bad['answers'][0]['questionId'] = 13; reject(fn() => validateSubmission($bad));
reject(fn() => calculateResult([]));
reject(fn() => calculateResult(array_fill(1, 12, '3')));
reject(fn() => calculateResult(array_fill(2, 12, 1)));
echo "$checks verificaciones PHP correctas.\n";
