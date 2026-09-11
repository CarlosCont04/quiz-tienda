-- MySQL 8+ / MariaDB 10.4+ (XAMPP). Importar dentro de la base quiz_tienda.
CREATE TABLE IF NOT EXISTS quiz_submissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    total_score TINYINT UNSIGNED NOT NULL,
    dependence_percentage TINYINT UNSIGNED NOT NULL,
    result_key ENUM('baja', 'media', 'alta') NOT NULL,
    result_json JSON NOT NULL,
    quiz_version VARCHAR(40) NOT NULL,
    consent_version VARCHAR(40) NOT NULL,
    consent_at DATETIME NOT NULL,
    payload_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    session_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_request (request_id),
    KEY by_date (created_at),
    CONSTRAINT valid_score CHECK (total_score BETWEEN 0 AND 36),
    CONSTRAINT valid_percentage CHECK (dependence_percentage = ROUND(total_score / 36 * 100)),
    CONSTRAINT valid_result CHECK ((total_score BETWEEN 0 AND 10 AND result_key = 'baja') OR (total_score BETWEEN 11 AND 23 AND result_key = 'media') OR (total_score BETWEEN 24 AND 36 AND result_key = 'alta'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_answers (
    submission_id BIGINT UNSIGNED NOT NULL,
    question_id TINYINT UNSIGNED NOT NULL,
    area_key ENUM('finanzas', 'operacion', 'ventas', 'marketing', 'equipo') NOT NULL,
    points TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (submission_id, question_id),
    CONSTRAINT answers_submission FOREIGN KEY (submission_id) REFERENCES quiz_submissions(id) ON DELETE CASCADE,
    CONSTRAINT valid_question CHECK (question_id BETWEEN 1 AND 12),
    CONSTRAINT valid_points CHECK (points BETWEEN 0 AND 3),
    CONSTRAINT valid_area CHECK ((question_id IN (2,3,4) AND area_key = 'finanzas') OR (question_id IN (1,9,10) AND area_key = 'operacion') OR (question_id IN (5,6) AND area_key = 'ventas') OR (question_id IN (7,8) AND area_key = 'marketing') OR (question_id IN (11,12) AND area_key = 'equipo'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
