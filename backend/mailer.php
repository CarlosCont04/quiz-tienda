<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function mailConfig(): array
{
    $config = config();
    foreach (['email_transport', 'email_recipient', 'email_from', 'email_from_name', 'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_password'] as $key) {
        if (!array_key_exists($key, $config)) throw new RuntimeException('Email configuration is incomplete');
    }
    if (!filter_var($config['email_recipient'], FILTER_VALIDATE_EMAIL) || !filter_var($config['email_from'], FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Email address configuration is invalid');
    if (!in_array($config['email_transport'], ['smtp', 'log'], true)) throw new RuntimeException('Email transport configuration is invalid');
    return $config;
}
function emailEscape(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function quizEmailContent(array $submission, array $result): array
{
    $quiz = quizDefinition(); $answers = $submission['answers']; $areas = ''; $responses = '';
    foreach ($result['areas'] as $area) {
        $priority = in_array($area['id'], $result['criticalAreas'], true) ? ' <span style="padding:2px 7px;background:#fff0d6;color:#845000;font-size:11px;font-weight:bold">PRIORIDAD</span>' : '';
        $areas .= '<tr><td style="padding:12px 0;border-bottom:1px solid #e5ebef;color:#102a43;font-weight:bold">' . emailEscape($area['label']) . $priority . '</td><td align="right" style="padding:12px 0;border-bottom:1px solid #e5ebef;color:#102a43;font-weight:bold">' . (int) $area['percentage'] . ' %</td></tr>';
    }
    foreach ($quiz['questions'] as $question) {
        $value = $answers[$question['id']];
        $responses .= '<tr><td style="padding:15px 0;border-bottom:1px solid #e5ebef;color:#17212b;font-size:14px;line-height:1.5"><strong style="color:#102a43">' . $question['id'] . '. ' . emailEscape($question['text']) . '</strong><br><span style="color:#53677a">' . emailEscape($question['options'][$value]) . '</span></td><td align="right" valign="top" style="padding:15px 0 15px 14px;border-bottom:1px solid #e5ebef;color:#845000;font-size:12px;font-weight:bold;white-space:nowrap">' . $value . ' / 3</td></tr>';
    }
    $critical = array_filter($result['areas'], fn (array $area): bool => in_array($area['id'], $result['criticalAreas'], true));
    $priority = implode(', ', array_map(fn (array $area): string => $area['label'], $critical)) ?: 'Sin área crítica';
    $html = '<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#fff8ee;color:#17212b;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8ee"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:auto;background:#fff;border:1px solid #e5ebef"><tr><td style="padding:24px 32px;background:#102a43;color:#fff"><div style="font-size:12px;letter-spacing:1.3px;color:#dce7f0">EL QUE TENGA</div><div style="font-size:30px;font-weight:bold">TIENDA<span style="color:#f39200">.</span></div><div style="margin-top:16px;font-size:12px;letter-spacing:1.2px;color:#dce7f0">NUEVO TEST DE DEPENDENCIA</div></td></tr><tr><td style="padding:32px"><p style="margin:0 0 8px;color:#66788a;font-size:14px">Registro de ' . gmdate('d/m/Y H:i') . ' UTC</p><h1 style="margin:0;color:#102a43;font-size:28px">' . emailEscape($submission['name']) . ' terminó el quiz</h1><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0;background:#fff8ee;border-left:4px solid #f39200"><tr><td style="padding:20px 22px"><p style="margin:0;color:#66788a;font-size:13px">ÍNDICE DE DEPENDENCIA</p><p style="margin:4px 0;color:#102a43;font-size:40px;font-weight:bold">' . $result['percentage'] . '<span style="font-size:22px">%</span></p><p style="margin:9px 0;color:#102a43;font-size:18px;font-weight:bold">' . emailEscape($result['title']) . '</p><p style="margin:8px 0 0;color:#53677a;font-size:14px;line-height:1.55">' . emailEscape($result['description']) . '</p></td></tr></table><h2 style="margin:0 0 10px;color:#102a43;font-size:20px">Resultado por área</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">' . $areas . '</table><div style="margin:24px 0;padding:18px 20px;background:#fff8ee;border-left:3px solid #f39200"><p style="margin:0;color:#8e5600;font-size:11px;font-weight:bold;letter-spacing:1px">POR DÓNDE EMPEZAR</p><p style="margin:7px 0 0;color:#102a43;font-size:17px;font-weight:bold">' . emailEscape($priority) . '</p></div><h2 style="margin:30px 0 10px;color:#102a43;font-size:20px">Respuestas del quiz</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">' . $responses . '</table><p style="margin:30px 0 0;padding-top:18px;border-top:1px solid #e5ebef;color:#66788a;font-size:12px">Este correo se generó al registrar el resultado del Test de Dependencia.</p></td></tr></table></td></tr></table></body></html>';
    $text = "EL QUE TENGA TIENDA\n\nNombre: {$submission['name']}\nÍndice: {$result['percentage']}% ({$result['title']})\nPuntaje: {$result['score']} de {$result['maxScore']}\nÁrea(s) crítica(s): {$priority}\n\nRespuestas:\n";
    foreach ($quiz['questions'] as $question) $text .= "{$question['id']}. {$question['text']}\n{$question['options'][$answers[$question['id']]]}\n\n";
    return ['subject' => "Nuevo Test de Dependencia: {$submission['name']} ({$result['percentage']}%)", 'html' => $html, 'text' => $text];
}
function sendQuizEmail(array $submission, array $result): void
{
    $config = mailConfig(); $content = quizEmailContent($submission, $result);
    if ($config['email_transport'] === 'log') {
        $directory = __DIR__ . '/../.runtime/mail-log';
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Email log directory unavailable');
        file_put_contents($directory . '/' . $submission['requestId'] . '.html', $content['html'], LOCK_EX); return;
    }
    smtpSend($config, $content);
}
function smtpSend(array $config, array $content): void
{
    if ($config['smtp_host'] === '' || $config['smtp_username'] === '' || $config['smtp_password'] === '') throw new RuntimeException('SMTP is not configured');
    $port = (int) $config['smtp_port'];
    if ($port < 1 || $port > 65535 || !in_array($config['smtp_encryption'], ['starttls', 'ssl'], true)) throw new RuntimeException('SMTP configuration is invalid');
    $socket = @stream_socket_client(($config['smtp_encryption'] === 'ssl' ? 'ssl://' : 'tcp://') . $config['smtp_host'] . ':' . $port, $code, $error, 15, STREAM_CLIENT_CONNECT);
    if (!$socket) throw new RuntimeException('SMTP connection unavailable'); stream_set_timeout($socket, 15);
    try {
        smtpExpect($socket, [220]); smtpCommand($socket, 'EHLO localhost', [250]);
        if ($config['smtp_encryption'] === 'starttls') { smtpCommand($socket, 'STARTTLS', [220]); if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('SMTP TLS negotiation failed'); smtpCommand($socket, 'EHLO localhost', [250]); }
        smtpCommand($socket, 'AUTH LOGIN', [334]); smtpCommand($socket, base64_encode($config['smtp_username']), [334]); smtpCommand($socket, base64_encode($config['smtp_password']), [235]);
        smtpCommand($socket, 'MAIL FROM:<' . $config['email_from'] . '>', [250]); smtpCommand($socket, 'RCPT TO:<' . $config['email_recipient'] . '>', [250, 251]); smtpCommand($socket, 'DATA', [354]);
        $boundary = '=_quiz_' . bin2hex(random_bytes(12)); $fromName = str_replace(["\r", "\n"], '', $config['email_from_name']); $name = '=?UTF-8?B?' . base64_encode($fromName) . '?='; $subject = '=?UTF-8?B?' . base64_encode($content['subject']) . '?=';
        $message = "From: {$name} <{$config['email_from']}>\r\nTo: <{$config['email_recipient']}>\r\nSubject: {$subject}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n\r\n--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{$content['text']}\r\n--{$boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n{$content['html']}\r\n--{$boundary}--";
        fwrite($socket, preg_replace('/(?m)^\./', '..', str_replace("\n", "\r\n", str_replace("\r\n", "\n", $message))) . "\r\n.\r\n"); smtpExpect($socket, [250]); smtpCommand($socket, 'QUIT', [221]);
    } finally { fclose($socket); }
}
function smtpCommand($socket, string $command, array $codes): void { fwrite($socket, $command . "\r\n"); smtpExpect($socket, $codes); }
function smtpExpect($socket, array $codes): void { do { $line = fgets($socket, 2048); if ($line === false) throw new RuntimeException('SMTP server did not respond'); $response = ($response ?? '') . $line; } while (isset($line[3]) && $line[3] === '-'); if (!in_array((int) substr($response, 0, 3), $codes, true)) throw new RuntimeException('SMTP delivery was rejected'); }