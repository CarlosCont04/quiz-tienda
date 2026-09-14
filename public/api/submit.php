<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/backend/http.php';
require_once dirname(__DIR__, 2) . '/backend/quiz.php';
require_once dirname(__DIR__, 2) . '/backend/database.php';
require_once dirname(__DIR__, 2) . '/backend/notifications.php';

requireMethod('POST');
if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
    jsonResponse(['message' => 'El formato de envío debe ser JSON.'], 415);
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 16384) {
    jsonResponse(['message' => 'El envío excede el tamaño permitido.'], 413);
}
startQuizSession();
if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
    jsonResponse(['message' => 'La sesión expiró. Intenta registrar nuevamente.'], 403);
}
$now = time();
$_SESSION['attempts'] = array_values(array_filter($_SESSION['attempts'] ?? [], fn ($timestamp) => $timestamp > $now - 900));
if (count($_SESSION['attempts']) >= 30) {
    header('Retry-After: 900');
    jsonResponse(['message' => 'Has realizado varios intentos. Espera 15 minutos antes de volver a enviar.'], 429);
}
$_SESSION['attempts'][] = $now;
$sessionHash = hash('sha256', session_id());
session_write_close();

try {
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if (strlen($raw) > 16384) jsonResponse(['message' => 'El envío excede el tamaño permitido.'], 413);
    $input = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($input) || array_is_list($input)) throw new InvalidArgumentException('El envío no es válido.');
    $submission = validateSubmission($input);
} catch (JsonException | InvalidArgumentException $error) {
    jsonResponse(['message' => $error instanceof JsonException ? 'El envío no contiene un JSON válido.' : $error->getMessage()], 422);
}

// El servidor calcula todo desde las respuestas; ignora puntajes enviados por el cliente.
$result = calculateResult($submission['answers']);
$payloadHash = hash('sha256', json_encode($submission, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
$pdo = database();
$findExisting = function () use ($pdo, $submission, $sessionHash, $payloadHash): ?array {
    $query = $pdo->prepare('SELECT id, result_json, payload_hash, session_hash FROM quiz_submissions WHERE request_id = ?');
    $query->execute([$submission['requestId']]);
    $existing = $query->fetch();
    if (!$existing) return null;
    if (!hash_equals($existing['session_hash'], $sessionHash) || !hash_equals($existing['payload_hash'], $payloadHash)) {
        jsonResponse(['message' => 'Este intento ya está registrado con otros datos. Usa los datos originales para reintentar o inicia otro test.'], 409);
    }
    return ['id' => (int) $existing['id'], 'result' => json_decode($existing['result_json'], true, 512, JSON_THROW_ON_ERROR)];
};
if ($existing = $findExisting()) {
    deliverQuizEmail($pdo, $existing['id'], $submission, $existing['result']);
    jsonResponse(['message' => 'Gracias por responder el quiz', 'result' => $existing['result']]);
}
try {
    $pdo->beginTransaction();
    $query = $pdo->prepare('INSERT INTO quiz_submissions (request_id, full_name, total_score, dependence_percentage, result_key, result_json, quiz_version, consent_version, consent_at, payload_hash, session_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)');
    $query->execute([$submission['requestId'], $submission['name'], $result['score'], $result['percentage'], $result['key'], json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), quizDefinition()['version'], 'registro-nombre-2026-1', $payloadHash, $sessionHash]);
    $id = (int) $pdo->lastInsertId();
    $saveAnswer = $pdo->prepare('INSERT INTO quiz_answers (submission_id, question_id, area_key, points) VALUES (?, ?, ?, ?)');
    foreach (quizDefinition()['questions'] as $question) {
        $saveAnswer->execute([$id, $question['id'], $question['area'], $submission['answers'][$question['id']]]);
    }
    queueQuizEmail($pdo, $id);
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($error instanceof PDOException && (int) ($error->errorInfo[1] ?? 0) === 1062 && ($existing = $findExisting())) {
        deliverQuizEmail($pdo, $existing['id'], $submission, $existing['result']);
        jsonResponse(['message' => 'Gracias por responder el quiz', 'result' => $existing['result']]);
    }
    throw $error;
}
deliverQuizEmail($pdo, $id, $submission, $result);
jsonResponse(['message' => 'Gracias por responder el quiz', 'result' => $result], 201);
