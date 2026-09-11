<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/backend/http.php';
requireMethod('GET');
startQuizSession();
jsonResponse(['csrfToken' => $_SESSION['csrf']]);
