<?php
declare(strict_types=1);
// Solo para el servidor de vista previa PHP, nunca para Apache.
if (PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if ($path === '/quiz-tienda') { header('Location: /quiz-tienda/'); return true; }
if (str_starts_with($path, '/quiz-tienda/')) $path = substr($path, strlen('/quiz-tienda'));
if (str_contains($path, "\0") || str_contains($path, '\\')) { http_response_code(404); return true; }
$root = realpath(__DIR__ . '/../dist');
$file = realpath($root . ($path === '/' ? '/index.html' : $path));
if (!$file || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || !is_file($file)) { http_response_code(404); return true; }
$extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
if ($extension === 'php' && in_array($path, ['/api/session.php', '/api/submit.php'], true)) { require $file; return true; }
$types = ['html' => 'text/html; charset=utf-8', 'css' => 'text/css', 'js' => 'text/javascript', 'webp' => 'image/webp', 'png' => 'image/png', 'svg' => 'image/svg+xml', 'ico' => 'image/x-icon', 'woff2' => 'font/woff2'];
if (!isset($types[$extension])) { http_response_code(404); return true; }
header('Content-Type: ' . $types[$extension]);
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') readfile($file);
return true;
