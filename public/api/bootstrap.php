<?php
declare(strict_types=1);

// Este archivo usa sintaxis compatible con PHP 7 para informar de una versión antigua.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');

function quizSetupFailure(string $reason): void
{
    // Solo códigos fijos; nunca rutas, claves ni datos de participantes.
    error_log('Tienda quiz setup: ' . $reason);
    http_response_code(503);
    echo json_encode(['message' => 'No pudimos iniciar el registro. Intenta de nuevo más tarde.']);
    exit;
}

if (PHP_VERSION_ID < 80200) quizSetupFailure('php_version');
if (!is_readable(__DIR__ . '/private-root.php')) quizSetupFailure('private_root_missing');
$quizPrivateRoot = require __DIR__ . '/private-root.php';
if (!is_string($quizPrivateRoot) || $quizPrivateRoot === '') quizSetupFailure('private_root_invalid');
foreach (['backend/http.php', 'backend/submission.php', 'backend/quiz.php', 'backend/mailer.php', 'backend/config.php', 'backend/config.example.php', 'shared/quiz.json'] as $file) {
    if (!is_readable($quizPrivateRoot . '/' . $file)) quizSetupFailure('private_files_missing');
}
require_once $quizPrivateRoot . '/backend/http.php';
return $quizPrivateRoot;
