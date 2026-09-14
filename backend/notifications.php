<?php
declare(strict_types=1);
require_once __DIR__ . '/mailer.php';
function queueQuizEmail(PDO $pdo, int $submissionId): void { $statement = $pdo->prepare('INSERT IGNORE INTO quiz_email_deliveries (submission_id, recipient) VALUES (?, ?)'); $statement->execute([$submissionId, mailConfig()['email_recipient']]); }
function deliverQuizEmail(PDO $pdo, int $submissionId, array $submission, array $result): void
{
    $statement = $pdo->prepare('SELECT status FROM quiz_email_deliveries WHERE submission_id = ?'); $statement->execute([$submissionId]); $delivery = $statement->fetch();
    if (!$delivery || $delivery['status'] === 'sent') return;
    try { sendQuizEmail($submission, $result); $statement = $pdo->prepare("UPDATE quiz_email_deliveries SET status = 'sent', attempts = attempts + 1, last_error = NULL, sent_at = UTC_TIMESTAMP() WHERE submission_id = ?"); $statement->execute([$submissionId]); }
    catch (Throwable $error) { $statement = $pdo->prepare('UPDATE quiz_email_deliveries SET attempts = attempts + 1, last_error = ? WHERE submission_id = ?'); $statement->execute([get_class($error), $submissionId]); throw new RuntimeException('No se pudo entregar el correo del resultado. Vuelve a intentar el registro.'); }
}