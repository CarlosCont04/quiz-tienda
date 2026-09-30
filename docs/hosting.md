# Publicar el formulario en el hosting

Destino: **https://www.elquetengatienda.com/quiz/**.

La entrega corrige la dirección `/quizapi/` a `/quiz/api/` e incluye el código PHP y la definición del cuestionario. No es suficiente volver a subir el antiguo `dist.zip`.

El formulario envía los registros mediante EmailJS. **No guarda nombres, respuestas ni resultados en una base de datos.** La copia del registro queda en el correo cuando se entrega; no hay recuperación automática de envíos fallidos.

## 1. Qué necesitas

- Acceso al administrador de archivos del hosting o SFTP y al registro de errores de PHP/Apache.
- PHP **8.2 o posterior**, con las extensiones `curl`, `mbstring` y sesiones habilitadas para este dominio.
- HTTPS y conexiones salientes desde PHP hacia `https://api.emailjs.com` por el puerto 443.
- Acceso a la cuenta de EmailJS que tiene el servicio, la plantilla y las claves.
- Una carpeta privada fuera de la raíz pública, accesible por PHP. Si el hosting restringe rutas mediante `open_basedir`, debe permitir esa carpeta.

La instalación pública está preparada para Apache, el servidor observado en la landing. Debe aceptar los archivos `.htaccess` incluidos. No se necesita Node.js, npm ni MySQL en el hosting; la página ya va compilada.

## 2. Generar o localizar el paquete

Si ya recibiste `quiz-hosting.zip`, utiliza ese archivo. Para volver a generarlo desde el proyecto, en PowerShell:

```powershell
cd C:\xampp\htdocs\quiz-tienda
npm.cmd ci
npm.cmd run build:hosting
npm.cmd run test:hosting
```

Para compilar localmente se requiere Node.js 22.12 o posterior y la imagen real `src/assets/libro.webp`. Si proviene de una descarga de Git, ejecutar `git lfs pull` cuando corresponda. La prueba de instalación requiere PHP local. El empaquetado utiliza `tar.exe` (incluido en Windows 10/11) o `zip` en Linux/macOS. `test:hosting` extrae el ZIP con PowerShell en Windows o `unzip` en Linux/macOS, compara cada archivo y prueba la aplicación extraída.

Cada compilación crea una carpeta nueva en `artifacts/hosting-FECHA/`, con `quiz-hosting.zip` y su contenido descomprimido en `package/`. `artifacts/latest-hosting.json` identifica la entrega más reciente. **El ZIP no contiene claves de EmailJS ni sesiones locales.**

Si un descompresor rechaza un ZIP anterior como «no válido», genera una entrega con el script actualizado: las rutas internas ya no llevan el prefijo `./`. También puedes subir directamente las carpetas de `package/`, que contienen los mismos archivos sin comprimir.

## 3. Respaldar y ubicar las carpetas

Descarga una copia de la carpeta `/quiz/` que ya está publicada y de cualquier configuración privada existente. Guarda ese respaldo fuera del directorio público. Si ya existe `quiz-private`, respáldala y conserva su `backend/config.local.php` y `.runtime/` al actualizar.

En el administrador de archivos, identifica la carpeta que contiene el sitio principal. A menudo se llama `public_html`, aunque puede llamarse `httpdocs`, `www` o tener otro nombre. **No reemplaces los archivos del sitio principal ni su `.htaccess`.**

Descomprime el ZIP en tu computadora. Distribuye sus dos carpetas así:

```text
CARPETA-DE-LA-CUENTA/
├── quiz-private/                 ← fuera de la carpeta pública
│   ├── .htaccess
│   ├── backend/
│   │   ├── config.example.php
│   │   ├── config.local.php      ← se configura por separado
│   │   ├── config.php
│   │   ├── http.php
│   │   ├── mailer.php
│   │   ├── quiz.php
│   │   └── submission.php
│   ├── shared/quiz.json
│   └── .runtime/sessions/
└── public_html/                  ← raíz del sitio principal
    └── quiz/
        ├── .htaccess
        ├── index.html
        ├── _astro/
        └── api/
            ├── .htaccess
            ├── bootstrap.php
            ├── private-root.php
            ├── session.php
            └── submit.php
```

`public_html` en el ZIP indica la raíz pública: si ya estás dentro de ella, sube solamente su carpeta `quiz`. Evita crear `public_html/public_html/quiz`, `quiz/quiz` o `quiz/dist`. Activa la visualización de archivos ocultos para incluir ambos `.htaccess` y `.runtime`.

Primero sube `quiz-private`. Configura los pasos 4–6 y después sube el contenido de `public_html/quiz` del paquete a la carpeta pública `/quiz/`, sustituyendo los archivos de la entrega anterior. La carpeta pública final debe corresponder al árbol anterior; conserva los archivos anteriores en el respaldo externo.

Si utilizas el gestor de archivos para descomprimir, extrae el paquete en una carpeta privada temporal y distribuye desde ahí. No dejes el ZIP ni las instrucciones en la carpeta pública.

## 4. Comprobar la ruta privada

El archivo público `quiz/api/private-root.php` contiene:

```php
<?php
return dirname(__DIR__, 3) . '/quiz-private';
```

Esta ruta funciona con el árbol anterior, incluso si `public_html` tiene otro nombre. Si la carpeta privada no puede quedar junto a la raíz pública, cambia **únicamente este archivo** para devolver su ruta absoluta real. Ejemplo ilustrativo; reemplaza el usuario y la ubicación:

```php
<?php
return '/home/USUARIO/quiz-private';
```

Debe ser una ruta del sistema de archivos del servidor, no una URL. Solicítala al administrador si no aparece en el panel. Si solo tienes acceso a la carpeta pública, pide al administrador que cree y suba la carpeta privada; no la coloques dentro de `/quiz/`.

Al actualizar a una nueva entrega, conserva cualquier ruta absoluta adaptada a tu hosting: el paquete vuelve a incluir la ruta relativa predeterminada.

## 5. Configurar EmailJS

Dentro de `quiz-private/backend/`, copia `config.example.php` como `config.local.php` y completa:

```php
<?php
declare(strict_types=1);

return [
    'emailjs_service_id' => 'TU_SERVICE_ID',
    'emailjs_template_id' => 'TU_TEMPLATE_ID',
    'emailjs_public_key' => 'TU_PUBLIC_KEY',
    'emailjs_private_key' => 'TU_PRIVATE_KEY',
];
```

En la computadora de este proyecto ya existe `backend/config.local.php`. Puedes transferir ese archivo por el administrador de archivos/SFTP a la ubicación privada anterior si sus claves corresponden a la cuenta que se usará en producción. Su existencia local no acredita que las claves sean válidas ni que la plantilla sea la definitiva. No sobrescribas una configuración de producción existente sin compararla de forma privada.

No coloques claves en `index.html`, JavaScript, archivos `.env` de Astro ni variables `PUBLIC_*`. PHP también admite `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY` y `EMAILJS_PRIVATE_KEY`; si existen en el proceso del hosting, prevalecen sobre el archivo local.

En el panel de EmailJS, comprueba:

1. **Email Services:** el servicio está conectado y autorizado para enviar desde `jesus.rivas01@elquetengatienda.com`.
2. **Email Templates:** la plantilla correspondiente al Template ID tiene `To Email` fijo en `carolina.candedo@elquetenga.com`. Verifica que no siga apuntando a un destinatario de pruebas.
3. `From Email`: el remitente predeterminado del servicio conectado. `Reply-To`: `jesus.rivas01@elquetengatienda.com`. Asunto: `{{subject}}`.
4. El contenido, en modo HTML/código, es `{{{html_content}}}` con **tres llaves**. PHP genera el documento completo.
5. **Account → Security:** habilita las llamadas desde aplicaciones que no son navegadores y la autorización con clave privada. El formulario llama a EmailJS desde PHP.

Referencias oficiales: [solicitudes desde servidor](https://github.com/emailjs-com/emailjs-nodejs#usage), [clave privada](https://www.emailjs.com/docs/sdk/options/), [contenido HTML](https://www.emailjs.com/docs/faq/can-i-send-html-from-my-code/). La guía del proyecto `docs/emailjs.md` amplía estos pasos.

## 6. PHP y permisos

En la configuración PHP del dominio selecciona PHP 8.2 o posterior y habilita `curl` y `mbstring`. Los cambios deben aplicarse al PHP que atiende el sitio, no únicamente al PHP de terminal.

PHP debe poder leer los archivos privados y escribir en `quiz-private/.runtime/sessions/`. Con PHP ejecutándose como el usuario de la cuenta, normalmente bastan permisos `700` en las carpetas privadas y `600` en `config.local.php`; si ejecuta como otro usuario, el administrador debe ajustar propietario/grupo y permisos. No pongas `777` como solución general.

Mantén `display_errors` desactivado y `log_errors` activado. Solicita salida HTTPS a `api.emailjs.com:443` y un almacén de certificados CA válido. Esta integración no necesita habilitar `mail()` ni abrir un puerto SMTP del hosting.

## 7. Comprobar la instalación sin enviar correos

Después de subir todos los archivos, purga la caché del hosting/CDN para `/quiz/` y `/quiz/index.html`, y recarga con Ctrl+F5. Excluye `/quiz/api/*` de cualquier caché forzada.

Abre estas direcciones:

| Dirección | Resultado esperado |
| --- | --- |
| `https://www.elquetengatienda.com/quiz/` | Página completa, imagen y estilos visibles |
| `https://www.elquetengatienda.com/quiz/api/session.php` | HTTP 200 y JSON con `csrfToken` |
| `https://www.elquetengatienda.com/quiz/api/submit.php` | HTTP 405 y mensaje «Método no permitido» al abrirla directamente |

El 405 en `submit.php` es correcto: abrir una dirección utiliza GET y el envío exige POST. Esas comprobaciones no envían correos. Que `session.php` funcione confirma el arranque y la sesión; **no valida las claves ni la entrega de EmailJS**.

En el código fuente de la landing debe aparecer `data-api-base="/quiz/api/"`. Si aparece `/quizapi/`, todavía se sirve una versión anterior. En las herramientas del navegador, pestaña Red/Network, las solicitudes deben dirigirse a `/quiz/api/`.

## 8. Prueba final de entrega

Con la configuración terminada, responde las 12 preguntas, usa un nombre identificable como `PRUEBA DE INSTALACIÓN`, acepta el consentimiento y pulsa **Enviar mi diagnóstico**. Este paso sí envía un correo real a la destinataria configurada en la plantilla.

Comprueba que `submit.php` responda HTTP 201, que la interfaz confirme el envío y que el registro aparezca en el historial de EmailJS. Revisa también el buzón de destino y spam: una respuesta de aceptación no garantiza por sí sola la llegada al buzón. Verifica nombre, respuestas, resultado y diseño del correo. Para probar con otro buzón, utiliza una plantilla de prueba con destinatario fijo y vuelve al Template ID de producción al terminar.

## 9. Si sigue fallando

Busca entradas `Tienda quiz` en el registro de errores del hosting. Si ocurre un 500 sin esas entradas, revisa los errores PHP/Apache inmediatamente anteriores: puede fallar la configuración del servidor antes de ejecutar la aplicación.

| Evidencia | Qué revisar |
| --- | --- |
| 404 en `/quizapi/…` | HTML antiguo o caché; debe usar `/quiz/api/` |
| 404 en `/quiz/api/…` | Ubicación de la carpeta y subida completa de `api/` |
| `setup: php_version` | Cambiar PHP del dominio a 8.2 o posterior |
| `setup: private_root_missing` / `private_root_invalid` | Archivo `api/private-root.php` ausente o con un valor incorrecto |
| `setup: private_files_missing` | Ruta privada, archivos faltantes, permisos de lectura u `open_basedir` |
| `code=1001` / `1002` / `1003` | Creación, escritura o apertura de sesiones en `.runtime/sessions/` |
| `code=1004` | Falta `mbstring` |
| `code=1005` | Falta una de las cuatro claves de EmailJS |
| `code=1006` | Falta cURL |
| `code=1007` y `curl_errno=…` | Conexión con EmailJS: DNS, salida HTTPS, tiempo de espera o certificados TLS |
| `EmailJsException code=…` | EmailJS rechazó la solicitud; revisar servicio, plantilla, claves, autorización desde servidor y límites de la cuenta |
| 403 al enviar | Cookies/sesión, caché de la API o una regla del firewall del hosting |
| 429 | Límite temporal; esperar según el mensaje y revisar límites de EmailJS |
| 500 en toda `/quiz/` | Error de Apache/PHP, incluidas directivas `.htaccess` no permitidas; pedir al administrador el detalle del registro |
| PHP se descarga o se muestra como texto | PHP no está ejecutándose: pedir al hosting que configure el intérprete antes de usar el formulario |

El código conserva respuestas públicas genéricas y registra códigos de diagnóstico sin claves, nombres ni respuestas del cuestionario. No publiques el archivo de configuración ni el registro completo de errores.

Texto para solicitar ayuda al administrador:

> Necesito instalar el formulario PHP de https://www.elquetengatienda.com/quiz/. Se requiere PHP 8.2 o posterior con curl, mbstring y sesiones; una carpeta quiz-private fuera de la raíz pública, legible por PHP; escritura en quiz-private/.runtime/sessions; salida HTTPS a api.emailjs.com:443; y .htaccess habilitado en /quiz/. Favor de confirmar la raíz pública, la ruta absoluta privada y cualquier restricción open_basedir. Si la API falla, necesito las entradas de error correspondientes a /quiz/api/session.php y /quiz/api/submit.php, incluidas las que empiezan por Tienda quiz.
