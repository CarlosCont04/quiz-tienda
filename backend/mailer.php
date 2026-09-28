<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/quiz.php';

const QUIZ_EMAIL_TO = 'carolina.candedo@elquetenga.com';
const QUIZ_EMAIL_FROM = 'jesus.rivas01@elquetengatienda.com';

final class EmailJsException extends RuntimeException
{
    public function __construct(public readonly int $httpStatus)
    {
        // No incluir respuestas del proveedor: pueden contener datos o claves.
        parent::__construct('EmailJS no aceptó el envío.', $httpStatus);
    }
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
    $registration = '<p style="color:#66788a;font-size:12px;line-height:1.5">Registro: ' . emailEscape($submission['requestId']) . '<br>Puntaje: ' . (int) $result['score'] . ' / ' . (int) $result['maxScore'] . '<br>Versión: ' . emailEscape($quiz['version']) . '<br>Consentimiento: aceptado para enviar el diagnóstico.</p>';
    $html = str_replace('</h1>', '</h1>' . $registration, $html);
    $text = "EL QUE TENGA TIENDA\n\nNombre: {$submission['name']}\nÍndice: {$result['percentage']}% ({$result['title']})\nPuntaje: {$result['score']} de {$result['maxScore']}\nÁrea(s) crítica(s): {$priority}\n\nRespuestas:\n";
    foreach ($quiz['questions'] as $question) $text .= "{$question['id']}. {$question['text']}\n{$question['options'][$answers[$question['id']]]}\n\n";
    return ['subject' => "Nuevo Test de Dependencia: {$submission['name']} ({$result['percentage']}%)", 'html' => $html, 'text' => $text];
}

/**
 * El parámetro de transporte permite simular EmailJS en pruebas, sin enviar correos.
 * El endpoint público siempre usa emailjsHttpPost y su URL HTTPS fija.
 */
function sendQuizEmail(array $submission, array $result, ?callable $post = null): void
{
    $config = config();
    foreach (['emailjs_service_id', 'emailjs_template_id', 'emailjs_public_key', 'emailjs_private_key'] as $key) {
        if (!is_string($config[$key]) || trim($config[$key]) === '') {
            throw new RuntimeException('Falta configurar EmailJS.');
        }
    }
    $content = quizEmailContent($submission, $result);
    $payload = [
        'service_id' => $config['emailjs_service_id'],
        'template_id' => $config['emailjs_template_id'],
        'user_id' => $config['emailjs_public_key'],
        'accessToken' => $config['emailjs_private_key'],
        'template_params' => [
            'to_email' => QUIZ_EMAIL_TO,
            'from_email' => QUIZ_EMAIL_FROM,
            'from_name' => 'El que tenga tienda',
            'subject' => $content['subject'],
            'html_content' => $content['html'],
            'text_content' => $content['text'],
            'request_id' => $submission['requestId'],
        ],
    ];
    $response = ($post ?? 'emailjsHttpPost')($payload);
    if ($response['status'] !== 200 || trim($response['body']) !== 'OK') {
        throw new EmailJsException($response['status']);
    }
}

function emailjsHttpPost(array $payload): array
{
    if (!extension_loaded('curl')) throw new RuntimeException('Se requiere la extensión cURL de PHP.');
    $curl = curl_init('https://api.emailjs.com/api/v1.0/email/send');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: text/plain'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    try {
        $body = curl_exec($curl);
        if ($body === false) throw new RuntimeException('No se pudo confirmar el envío a EmailJS.');
        return ['status' => (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE), 'body' => $body];
    } finally {
        curl_close($curl);
    }
}
