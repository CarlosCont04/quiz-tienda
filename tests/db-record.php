<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../backend/database.php';
// Las pruebas solo acceden a una base explícitamente separada.
if (!str_ends_with(config()['db_name'], '_test')) { fwrite(STDERR, 'Se requiere base _test.'); exit(1); }
$mode = $argv[1] ?? '';
$requestId = $argv[2] ?? '';
if (!preg_match('/^[a-f0-9-]{36}$/', $requestId)) exit(1);
$pdo = database();
if ($mode === 'delete') {
    $q = $pdo->prepare("DELETE FROM quiz_submissions WHERE request_id = ? AND full_name LIKE 'PRUEBA AUTOMATIZADA %'");
    $q->execute([$requestId]);
    exit;
}
$q = $pdo->prepare("SELECT s.full_name, s.total_score, s.dependence_percentage, s.result_key, s.quiz_version, s.consent_version, COUNT(a.question_id) answer_count, SUM(a.points) answer_score FROM quiz_submissions s JOIN quiz_answers a ON a.submission_id = s.id WHERE s.request_id = ? AND s.full_name LIKE 'PRUEBA AUTOMATIZADA %' GROUP BY s.id");
$q->execute([$requestId]);
echo json_encode($q->fetch() ?: null, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
