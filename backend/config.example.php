<?php
declare(strict_types=1);

// Copiar a config.local.php para personalizar XAMPP. Nunca publicar credenciales.
return [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'quiz_tienda',
    'db_user' => 'root', // Desarrollo local.
    'db_password' => '',
    // Fase de pruebas: conservar este destinatario. Cambiarlo por carolina.candedo@elquetenga.com al aprobar la entrega.
    'email_transport' => 'smtp',
    'email_recipient' => 'aldoemonterm@gmail.com',
    'email_from' => 'quiz@elquetengatienda.com',
    'email_from_name' => 'El que tenga tienda',
    // Usar una cuenta SMTP con contraseña de aplicación; nunca guardar la contraseña en Git.
    'smtp_host' => '',
    'smtp_port' => 587,
    'smtp_encryption' => 'starttls', // starttls o ssl
    'smtp_username' => '',
    'smtp_password' => '',
];
