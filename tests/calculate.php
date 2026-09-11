<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../backend/quiz.php';
$fixtures = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$results = [];
foreach ($fixtures as $answers) {
    $normalized = [];
    foreach ($answers as $answer) $normalized[$answer['questionId']] = $answer['value'];
    $results[] = calculateResult($normalized);
}
echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
