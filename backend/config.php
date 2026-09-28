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
        // Ignorar las antiguas claves SQL/SMTP del archivo local.
        $config = array_replace($config, array_intersect_key(require __DIR__ . '/config.local.php', $config));
    }
    foreach (array_keys($config) as $key) {
        $value = getenv(strtoupper($key));
        if ($value !== false) { $config[$key] = $value; }
    }
    return $config;
}
