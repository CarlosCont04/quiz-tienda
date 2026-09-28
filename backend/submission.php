<?php
declare(strict_types=1);

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/quiz.php';
require_once __DIR__ . '/mailer.php';

function submitQuizRequest(?callable $post = null): never
{
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
    $_SESSION['attempts'] = array_values(array_filter($_SESSION['attempts'] ?? [], fn ($time) => $time > $now - 900));
    if (count($_SESSION['attempts']) >= 30) {
        header('Retry-After: 900');
        jsonResponse(['message' => 'Has realizado varios intentos. Espera 15 minutos antes de volver a enviar.'], 429);
    }
    $_SESSION['attempts'][] = $now;

    try {
        $raw = file_get_contents('php://input', false, null, 0, 16385);
        if (strlen($raw) > 16384) jsonResponse(['message' => 'El envío excede el tamaño permitido.'], 413);
        $input = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($input) || array_is_list($input)) throw new InvalidArgumentException('El envío no es válido.');
        $submission = validateSubmission($input);
    } catch (JsonException | InvalidArgumentException $error) {
        jsonResponse(['message' => $error instanceof JsonException ? 'El envío no contiene un JSON válido.' : $error->getMessage()], 422);
    }

    // La sesión conserva solo UUID, huella, fecha y confirmación; nunca el registro completo.
    // Mantener su bloqueo hasta confirmar evita duplicados concurrentes de la misma sesión.
    $result = calculateResult($submission['answers']);
    $hash = hash('sha256', json_encode($submission, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    $_SESSION['email_requests'] = array_filter($_SESSION['email_requests'] ?? [], fn ($entry) => $entry['time'] > $now - 86400);
    $id = $submission['requestId'];
    $existing = $_SESSION['email_requests'][$id] ?? null;
    if ($existing !== null) {
        if (!hash_equals($existing['hash'], $hash)) {
            jsonResponse(['message' => 'Este intento corresponde a otros datos. Usa los datos originales o inicia otro test.'], 409);
        }
        if ($existing['sent']) {
            jsonResponse(['message' => 'Gracias por responder el quiz', 'result' => $result], 200);
        }
    }
    $_SESSION['email_requests'][$id] = ['hash' => $hash, 'time' => $now, 'sent' => false];
    try {
        sendQuizEmail($submission, $result, $post);
    } catch (EmailJsException $error) {
        if ($error->httpStatus === 429) {
            header('Retry-After: 1');
            jsonResponse(['message' => 'El servicio de correo está ocupado. Espera unos segundos y vuelve a intentarlo.'], 429);
        }
        throw $error;
    }
    $_SESSION['email_requests'][$id]['sent'] = true;
    session_write_close();
    jsonResponse(['message' => 'Gracias por responder el quiz', 'result' => $result], 201);
}
