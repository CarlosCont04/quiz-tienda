<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
requireMethod('GET');
startQuizSession();
session_write_close();
jsonResponse(['csrfToken' => $_SESSION['csrf']]);
