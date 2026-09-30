<?php
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

function jsonResponse(array $body, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function requireMethod(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        header('Allow: ' . $method);
        jsonResponse(['message' => 'Método no permitido.'], 405);
    }
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        jsonResponse(['message' => 'Abre el quiz desde su sitio para continuar.'], 403);
    }
}

function startQuizSession(): void
{
    $sessionDir = __DIR__ . '/../.runtime/sessions';
    if (!is_dir($sessionDir) && !mkdir($sessionDir, 0700, true) && !is_dir($sessionDir)) {
        throw new RuntimeException('Session directory unavailable', 1001);
    }
    if (!is_writable($sessionDir)) throw new RuntimeException('Session directory not writable', 1002);
    ini_set('session.save_handler', 'files');
    ini_set('session.use_strict_mode', '1');
    session_save_path($sessionDir);
    session_name('tienda_quiz_session');
    session_set_cookie_params(['httponly' => true, 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Lax', 'path' => '/', 'lifetime' => 0]);
    if (!session_start()) throw new RuntimeException('Session start failed', 1003);
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}

set_exception_handler(function (Throwable $error): void {
    // No se registran nombres, correos, respuestas ni credenciales en los logs.
    error_log('Tienda quiz API failure: ' . get_class($error) . ' code=' . $error->getCode());
    jsonResponse(['message' => 'No pudimos confirmar el envío del diagnóstico. Tus respuestas siguen aquí; puedes reintentar.'], 503);
});
