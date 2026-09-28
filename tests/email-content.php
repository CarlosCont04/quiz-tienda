<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../backend/mailer.php';
$submission = validateSubmission(json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR));
echo json_encode(quizEmailContent($submission, calculateResult($submission['answers'])), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
