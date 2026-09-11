<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../backend/database.php';

try {
    $pdo = database(false);
    $name = config()['db_name'];
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$name`");
    $pdo->exec(file_get_contents(__DIR__ . '/../database/schema.sql'));
    echo "Base de datos $name y tablas listas. No se eliminaron registros existentes.\n";
} catch (Throwable $error) {
    fwrite(STDERR, "No se pudo preparar la base. Verifica MySQL, el puerto y backend/config.local.php. Error: " . $error->getCode() . "\n");
    exit(1);
}
