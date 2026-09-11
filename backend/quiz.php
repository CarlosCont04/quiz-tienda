<?php
declare(strict_types=1);

function quizDefinition(): array
{
    static $quiz;
    return $quiz ??= json_decode(file_get_contents(__DIR__ . '/../shared/quiz.json'), true, 512, JSON_THROW_ON_ERROR);
}

function validateSubmission(array $input): array
{
    if (!is_string($input['name'] ?? null)) {
        throw new InvalidArgumentException('Escribe tu nombre para registrar tu resultado.');
    }
    $name = trim($input['name']);
    if (mb_strlen($name) < 2 || mb_strlen($name) > 120 || preg_match('/[\x00-\x1F\x7F<>]/u', $name)) {
        throw new InvalidArgumentException('Escribe un nombre válido de 2 a 120 caracteres.');
    }
    if (($input['consent'] ?? null) !== true) {
        throw new InvalidArgumentException('Acepta el uso de tus datos para registrar el resultado.');
    }
    if (!is_string($input['requestId'] ?? null) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $input['requestId'])) {
        throw new InvalidArgumentException('El identificador de registro no es válido. Vuelve a abrir el test.');
    }
    if (($input['website'] ?? '') !== '') {
        throw new InvalidArgumentException('No fue posible registrar el resultado.');
    }
    $raw = $input['answers'] ?? null;
    $ids = array_column(quizDefinition()['questions'], 'id');
    if (!is_array($raw) || !array_is_list($raw) || count($raw) !== count($ids)) {
        throw new InvalidArgumentException('Responde las 12 preguntas antes de registrar el resultado.');
    }
    $answers = [];
    foreach ($raw as $answer) {
        if (!is_array($answer) || !is_int($answer['questionId'] ?? null) || !in_array($answer['questionId'], $ids, true) || isset($answers[$answer['questionId']]) || !is_int($answer['value'] ?? null) || $answer['value'] < 0 || $answer['value'] > 3) {
            throw new InvalidArgumentException('Hay una respuesta inválida o repetida. Revisa el test.');
        }
        $answers[$answer['questionId']] = $answer['value'];
    }
    ksort($answers);
    return ['requestId' => strtolower($input['requestId']), 'name' => $name, 'answers' => $answers, 'consent' => true];
}

function calculateResult(array $answers): array
{
    $definition = quizDefinition();
    if (count($answers) !== count($definition['questions'])) {
        throw new InvalidArgumentException('Respuestas incompletas.');
    }
    foreach ($definition['questions'] as $question) {
        $value = $answers[$question['id']] ?? null;
        if (!is_int($value) || $value < 0 || $value > 3) {
            throw new InvalidArgumentException('Respuesta inválida.');
        }
    }
    $score = array_sum($answers);
    $percentage = (int) round($score / $definition['maxScore'] * 100);
    $level = null;
    foreach ($definition['results'] as $candidate) {
        if ($percentage >= $candidate['min'] && $percentage <= $candidate['max']) {
            $level = $candidate;
            break;
        }
    }
    if ($level === null) throw new LogicException('Resultado sin clasificación.');
    $areas = [];
    foreach ($definition['areas'] as $area) {
        $areaScore = 0;
        foreach ($definition['questions'] as $question) {
            if ($question['area'] === $area['id']) $areaScore += $answers[$question['id']];
        }
        $areas[] = array_merge($area, ['score' => $areaScore, 'percentage' => (int) round($areaScore / $area['maxScore'] * 100)]);
    }
    // Productos cruzados: comparar porcentajes exactos, no puntajes ni redondeos.
    $top = $areas[0];
    foreach ($areas as $area) {
        if ($area['score'] * $top['maxScore'] > $top['score'] * $area['maxScore']) $top = $area;
    }
    $critical = [];
    if ($score > 0) {
        foreach ($areas as $area) {
            if ($area['score'] * $top['maxScore'] === $top['score'] * $area['maxScore']) $critical[] = $area['id'];
        }
    }
    return ['score' => $score, 'maxScore' => $definition['maxScore'], 'percentage' => $percentage, 'key' => $level['key'], 'title' => $level['title'], 'description' => $level['description'], 'areas' => $areas, 'criticalAreas' => $critical];
}
