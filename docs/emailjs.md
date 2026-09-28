# Configurar EmailJS para quiz-tienda

El código está preparado para enviar el diagnóstico a **carolina.candedo@elquetenga.com** desde **jesus.rivas01@elquetengatienda.com**. Debes autorizar esa cuenta emisora en EmailJS: escribir una dirección en el código no concede permiso para enviar desde ella.

## 1. Conectar el servicio

En el [panel de EmailJS](https://dashboard.emailjs.com/), abrir **Email Services → Add New Service**, seleccionar el proveedor que aloja el buzón de Jesús y autorizar **jesus.rivas01@elquetengatienda.com**. El dominio por sí solo no determina si usa Google, Microsoft u otro proveedor. Ejecutar la prueba de conexión del servicio y copiar su **Service ID**.

Referencia: [añadir un servicio](https://www.emailjs.com/docs/tutorial/adding-email-service/).

## 2. Crear la plantilla conservando el HTML

En **Email Templates**, crear una plantilla y configurar:

| Campo | Valor |
| --- | --- |
| To Email | `carolina.candedo@elquetenga.com` (dirección fija) |
| From Name | `El que tenga tienda` |
| From Email | Usar el remitente predeterminado del servicio conectado: `jesus.rivas01@elquetengatienda.com` |
| Reply-To | `jesus.rivas01@elquetengatienda.com` |
| Subject | `{{subject}}` |
| CC / BCC | Vacíos |
| Contenido, en modo edición HTML/código | `{{{html_content}}}` |

El contenido HTML debe consistir en esa variable con **tres llaves**, sin otra plantilla envolvente. PHP ya genera el documento completo con el diseño actual. No pegar el PHP en el panel ni usar `{{html_content}}`: dos llaves mostrarían el HTML escapado. La aplicación escapa los datos del participante antes de incorporarlos al diseño.

Guardar y copiar el **Template ID**. La dirección fija en To Email impide que parámetros del navegador cambien la destinataria. El código también transmite `to_email` y `from_email` con las direcciones solicitadas, pero el servicio y la plantilla autorizados determinan las cabeceras reales.

Referencias: [campos de la plantilla](https://www.emailjs.com/docs/tutorial/creating-email-template/) y [HTML desde código](https://www.emailjs.com/docs/faq/can-i-send-html-from-my-code/).

## 3. Habilitar llamadas desde el servidor

En **Account → Security**, habilitar solicitudes de API desde aplicaciones que no sean un navegador. Esta integración llama a EmailJS desde PHP. Obtener la **Public Key** y la **Private Key**; habilitar la autorización con clave privada. El proyecto exige ambas para que la plantilla que recibe HTML arbitrario solo se utilice desde el servidor autorizado.

EmailJS documenta la habilitación de solicitudes no procedentes de navegador en [su SDK oficial de servidor](https://github.com/emailjs-com/emailjs-nodejs#usage), y la autorización con clave privada en [opciones de seguridad](https://www.emailjs.com/docs/sdk/options/). La API REST recibe esa clave como `accessToken`; no se expone al visitante.

## 4. Configurar PHP

Editar `backend/config.local.php` (excluido de Git). Para esta integración basta:

```php
<?php
declare(strict_types=1);

return [
    'emailjs_service_id' => 'service_REEMPLAZAR',
    'emailjs_template_id' => 'template_REEMPLAZAR',
    'emailjs_public_key' => 'REEMPLAZAR_CLAVE_PUBLICA',
    'emailjs_private_key' => 'REEMPLAZAR_CLAVE_PRIVADA',
];
```

Si ya existe, agregar las claves sin sobrescribir otros valores necesarios. Las claves SQL y SMTP antiguas son ignoradas; no se conecta a esos servicios. No hace falta crear tablas ni ejecutar `db:setup`.

Alternativamente, configurar en el proceso PHP las variables `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY` y `EMAILJS_PRIVATE_KEY`. Tienen prioridad sobre el archivo local. Reiniciar Apache si se cambiaron variables de su proceso. No usar `PUBLIC_*` ni el `.env` de Astro para estas claves.

Habilitar `curl` y `mbstring` en PHP. La conexión sale a `https://api.emailjs.com/api/v1.0/email/send` y verifica TLS. Si XAMPP informa un fallo de certificado, configurar un almacén CA válido mediante `curl.cainfo` en el `php.ini` que utiliza Apache; no desactivar la verificación.

## 5. Probar la entrega y activar a Carolina

Para mantener la fase de pruebas previa, duplicar la plantilla y fijar **To Email = aldoemonterm@gmail.com**, conservando el servicio de Jesús. Usar el Template ID de esa copia temporal en `config.local.php`. El destinatario fijo de esa plantilla prevalece sobre los parámetros enviados por el código.

```powershell
npm.cmd test
npm.cmd run test:api
npm.cmd run build:xampp
```

Las pruebas automatizadas simulan EmailJS y no mandan correos. Para la prueba real, abrir http://localhost/quiz-tienda/, responder las doce preguntas, escribir un nombre de prueba, aceptar el envío y pulsar **Enviar mi diagnóstico**.

Comprobar en el historial de EmailJS y en Gmail (incluido spam):

- Remitente real: Jesús, con la cuenta solicitada.
- Nombre, UUID, fecha y consentimiento del registro.
- Doce preguntas con la opción seleccionada y puntos.
- Índice total, nivel y cinco áreas.
- Diseño azul marino/naranja/crema y acentos correctos.

Una vez revisada la entrega, cambiar al **Template ID de producción**, cuyo To Email fijo es **carolina.candedo@elquetenga.com**. No hace falta recompilar al cambiar solo las claves PHP. No enviar al cliente las pruebas anteriores ni reenviar registros históricos automáticamente.

El código no puede verificar recepción en el buzón sin esta comprobación. EmailJS puede aceptar el mensaje y el proveedor todavía clasificarlo como spam o rechazar su entrega.

## Reintentos y diagnóstico

- **503:** revisar las cuatro claves, servicio conectado, autorización no-browser/privada y TLS. El mensaje público oculta las respuestas internas del proveedor.
- **429:** esperar y reintentar. EmailJS documenta un límite de una solicitud por segundo; la aplicación añade 30 intentos cada 15 minutos por sesión.
- **HTML mostrado como texto:** verificar las tres llaves y el modo HTML del editor.
- **Otro remitente:** corregir el servicio conectado y From Email, no el nombre del participante.
- **Mensaje vacío:** comprobar que el campo se llame exactamente `html_content`.
- **Envío no confirmado:** si pudo llegar a EmailJS antes de interrumpirse la conexión, revisar el historial por UUID antes de repetirlo.

La sesión evita repetir envíos confirmados en la misma sesión y hasta 24 horas. No hay una cola SQL ni recuperación automática de envíos al cerrar la página. Conservar el buzón conforme a la política de datos del equipo.

Contrato usado: [API REST /send](https://www.emailjs.com/docs/rest-api/send/). El cuerpo lleva `service_id`, `template_id`, `user_id`, `accessToken` y `template_params`; solo una respuesta HTTP 200 con `OK` se considera confirmada.
