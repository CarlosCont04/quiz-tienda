<?php
declare(strict_types=1);

function config(): array
{
    static $config;
    if ($config !== null) {
        return $config;
    }
    $config = require __DIR__ . '/config.example.php';
    if (is_file(__DIR__ . '/config.local.php')) {
        $config = array_replace($config, require __DIR__ . '/config.local.php');
    }
    foreach (['email_transport', 'email_recipient', 'email_from', 'email_from_name', 'smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_password'] as $key) {
        $value = getenv(strtoupper($key));
        if ($value !== false) { $config[$key] = $value; }
    }
    foreach (['host', 'port', 'name', 'user', 'password'] as $key) {
        $value = getenv('DB_' . strtoupper($key));
        if ($value !== false) {
            $config['db_' . $key] = $value;
        }
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $config['db_name'])) {
        throw new RuntimeException('Invalid database name');
    }
    return $config;
}
