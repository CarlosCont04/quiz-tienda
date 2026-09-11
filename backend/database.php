<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

function database(bool $withDatabase = true): PDO
{
    $config = config();
    $dsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $config['db_host'], (int) $config['db_port']);
    if ($withDatabase) {
        $dsn .= ';dbname=' . $config['db_name'];
    }
    $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}
