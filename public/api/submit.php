<?php
declare(strict_types=1);
$quizPrivateRoot = require __DIR__ . '/bootstrap.php';
require_once $quizPrivateRoot . '/backend/submission.php';
submitQuizRequest();
