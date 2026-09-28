# Test de Dependencia · El que tenga tienda

Quiz en español con Astro, TypeScript y PHP 8.2. Al completar las doce preguntas y enviar el registro con nombre y consentimiento, el servidor recalcula el diagnóstico y lo envía mediante EmailJS. Se conserva la plantilla HTML azul marino, naranja y crema del proyecto.

- Destinataria: **carolina.candedo@elquetenga.com**.
- Remitente que debe conectarse y autorizarse en EmailJS: **jesus.rivas01@elquetengatienda.com**.
- El correo contiene nombre, UUID del registro, fecha UTC, consentimiento, versión del quiz, doce respuestas, puntaje, nivel y desglose por áreas.
- La aplicación ya no utiliza SQL ni SMTP directo. No necesita MySQL ni migraciones.
- El cambio no borra ni migra los datos de una base anterior.

## Instalación y configuración

Requiere Node.js 22.12 o posterior, Git LFS y PHP 8.2 con `curl` y `mbstring`. Para enviar se necesita acceso HTTPS a EmailJS y una cuenta con el servicio de correo autorizado.

```powershell
npm.cmd ci
git lfs install --local
git lfs pull
# Solo si no existe config.local.php:
Copy-Item backend/config.example.php backend/config.local.php
```

Completar las cuatro claves `emailjs_*` en el archivo local. No reemplazar un archivo local existente sin revisarlo; sus claves SQL/SMTP antiguas se ignoran.

**Seguir [la guía de EmailJS](docs/emailjs.md)** para conectar al remitente, crear la plantilla conservando el HTML y obtener las claves. El archivo local está excluido de Git. Las variables de proceso `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY` y `EMAILJS_PRIVATE_KEY` tienen prioridad. PHP no carga archivos `.env`; estos se reservan a configuración pública de Astro. No colocar credenciales en `PUBLIC_*`.

## Desarrollo y publicación

```powershell
npm.cmd run dev
```

Abre http://127.0.0.1:4322/. El comando inicia Astro y PHP en 8082; Vite redirige `/api/` hacia PHP. Si PHP no está en XAMPP ni en PATH, configurar `PHP_BINARY`.

Para Apache/XAMPP:

```powershell
npm.cmd run build:xampp
```

Abre http://localhost/quiz-tienda/. Solo debe estar activo Apache, con PHP, `mod_rewrite` y `AllowOverride All`. No se requiere MySQL. El `.htaccess` publica `dist/` y bloquea archivos internos.

Para un dominio en la raíz:

```powershell
npm.cmd run build
npm.cmd start
```

La vista previa está en http://127.0.0.1:8082/. En alojamiento, apuntar `DocumentRoot` a `dist/` y mantener `backend/` y `shared/` como carpetas hermanas. PHP necesita escribir sesiones en `.runtime/sessions/`, fuera del directorio público. Publicar con HTTPS. No basta con subir HTML a un hosting sin PHP.

## Flujo y puntuación

El resultado aparece al terminar las doce preguntas. El usuario registra su nombre y acepta el envío en la ventana del resultado. El botón **Enviar mi diagnóstico** realiza el envío a EmailJS. Ver el resultado sin completar el registro no envía información. Si falla el envío, el resultado sigue visible y se puede reintentar. No se solicita correo al participante.

Cada opción vale 0, 1, 2 o 3 puntos. El porcentaje es `round(puntaje / 36 × 100)`.

| Puntaje | Porcentaje mostrado | Resultado |
| --- | --- | --- |
| 0–10 | 0–30 % | Dependencia baja |
| 11–23 | 31–64 % | Dependencia media |
| 24–36 | 65–100 % | Dependencia alta |

| Área | Preguntas | Máximo |
| --- | --- | --- |
| Finanzas | 2, 3, 4 | 9 |
| Operación | 1, 9, 10 | 9 |
| Ventas | 5, 6 | 6 |
| Marketing | 7, 8 | 6 |
| Equipo | 11, 12 | 6 |

Las áreas críticas se comparan por proporción exacta; se conservan empates. Con puntaje cero no hay área crítica. Preguntas, textos y versión proceden de `shared/quiz.json`.

## API y datos

- `GET /api/session.php`: cookie HttpOnly/SameSite y token CSRF.
- `POST /api/submit.php`: JSON con `requestId` UUID v4, `name`, `consent: true`, `website: ""` y doce `answers: [{questionId, value}]`. Requiere cookie y `X-CSRF-Token`.
- `201`: EmailJS aceptó el envío. `200`: envío ya confirmado en esa sesión.
- `403`: sesión/origen inválido. `409`: UUID con datos diferentes dentro de la sesión. `413`: más de 16 KB. `415`: formato incorrecto. `422`: validación. `429`: límite. `503`: configuración o envío no confirmado.

Los puntajes y destinatarios del navegador no se consideran fiables: PHP valida y calcula el resultado, genera el HTML con valores escapados y llama a la API HTTPS fija de EmailJS. Las claves no se incluyen en el JavaScript generado. El remitente efectivo debe pertenecer al servicio autorizado en EmailJS.

La única persistencia local del flujo es la sesión: CSRF, tiempos para limitar intentos y UUID/huella/fecha/estado de los envíos. No se guardan nombres, respuestas ni resultados completos en archivos o tablas. Las huellas expiran a las 24 horas o antes si expira la sesión. La copia del registro queda en el buzón y EmailJS procesa el contenido según la configuración de la cuenta.

El bloqueo de sesión evita reenvíos simultáneos y los reintentos después de una confirmación. No hay cola persistente, reintentos automáticos ni garantía de entrega exactamente una vez: una sesión nueva, una pérdida de sesión o un corte después de que EmailJS acepte pero antes de guardar la confirmación puede ocasionar duplicados. El UUID incluido en el correo permite identificarlos. Un HTTP 200 de EmailJS acredita aceptación, no llegada a bandeja de entrada.

## Verificación

```powershell
npm.cmd test
npm.cmd run test:api
npm.cmd run build:xampp
```

Las pruebas cubren reglas PHP, equivalencia con TypeScript y el flujo HTTP con un transporte EmailJS simulado. Verifican contenido, remitente/destinataria, acentos, HTML, reintentos, fallos del proveedor, CSRF y límites, sin SQL ni correos reales. GitHub Actions ejecuta esas comprobaciones sin un servicio MySQL. La entrega a un buzón y su visualización se validan tras configurar la cuenta siguiendo la guía.

## Archivos principales

- `src/`: interfaz Astro, estilos y cálculo en el navegador.
- `shared/quiz.json`: definición del cuestionario.
- `backend/submission.php`: validación, sesión y coordinación del envío.
- `backend/mailer.php`: plantilla conservada y transporte EmailJS.
- `backend/config.example.php`: claves necesarias, sin secretos.
- `public/api/`: endpoints PHP.
- `tests/`: reglas e integración simulada.
- `docs/emailjs.md`: configuración y comprobación de entrega real.

Los recursos binarios siguen administrados con Git LFS. Dependencias, salida compilada, configuración local y temporales permanecen excluidos de Git.
