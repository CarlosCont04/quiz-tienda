# Compilación y compatibilidad con Vercel

## Interpretar el registro de compilación

El fragmento que termina en `astro check` con `0 errors`, `0 warnings` y `0 hints` confirma que la comprobación de tipos terminó correctamente. No contiene un error de compilación. Si no aparecen más líneas, el registro no permite distinguir por sí solo un proceso que no termina, una cancelación o un registro incompleto. La compilación original sí terminó en este equipo; no se confirmó una causa única del bloqueo remoto.

`npm run build` ejecuta ahora una comprobación de la portada LFS y `astro build` directamente. La comprobación de tipos se conserva en `npm run check` y en GitHub Actions, separada del despliegue. La primera etapa imprime `Recursos Git LFS verificados. Iniciando astro build…`, para distinguir las fases en el registro. `build:xampp` conserva la comprobación de tipos y su prefijo local.

Se fijó `engines.node` a `24.x` para evitar el aviso por el rango abierto `>=22.12.0`. `.nvmrc` usa la misma rama. El proyecto permite específicamente el script de instalación de `esbuild@0.28.2` mediante `allowScripts`; no habilita scripts de todas las dependencias. Si se actualiza esbuild, revisar su nueva versión antes de renovar esa autorización. Con npm que soporte esta política se puede comprobar con `npm install-scripts ls`.

## Configuración de la compilación del frontend

| Ajuste de Vercel | Valor |
| --- | --- |
| Root Directory | Raíz del repositorio |
| Framework Preset | Astro |
| Node.js Version | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| `PUBLIC_BASE_PATH` | `/`, o dejarla sin definir |

No usar `build:xampp` en Vercel: genera las rutas con el prefijo local `/quiz-tienda/`. `npm start` sirve únicamente para la vista previa local con PHP; no es un comando de arranque para el alojamiento estático de Vercel.

La portada `src/assets/libro.webp` utiliza Git LFS. En **Project Settings → Git → Git Large File Storage (LFS)**, habilitar el soporte y volver a desplegar. Sin descargar los objetos, el archivo puede contener un puntero de texto en lugar de una imagen y fallar durante su procesamiento. Esto es una causa posible que debe contrastarse con el registro completo, no un fallo confirmado por el fragmento recibido.

Referencias: [versión de Node en Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Git LFS en Vercel](https://vercel.com/docs/project-configuration/git-settings) y [política de scripts de npm](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/).

## Envío por EmailJS en Vercel, sin SQL

`vercel.json` configura el frontend estático y dos funciones Node.js 24:

| Petición del navegador | Función de Vercel |
| --- | --- |
| `GET /api/session.php` | `api/session.ts` |
| `POST /api/submit.php` | `api/submit.ts` |

Las reescrituras conservan las rutas del frontend. El sufijo `.php` es solo la URL compatible; Vercel ejecuta TypeScript. Las funciones validan nombre, consentimiento y las doce respuestas, recalculan el resultado e invocan la API REST de EmailJS. La versión XAMPP conserva PHP. Ambas comparten el contenido de preguntas y la plantilla `shared/quiz-email.html`, cuyo HTML se comprueba equivalente en pruebas.

Cuando `VERCEL=1` —variable de sistema de Vercel— Astro usa `public-vercel/` y base `/`. De esta forma no copia `public/api/*.php` ni `.htaccess` a la salida estática, y una variable `PUBLIC_BASE_PATH=/quiz-tienda/` heredada no rompe las rutas del despliegue.

## Variables que debes configurar en Vercel

En **Project Settings → Environment Variables**, crear estas cuatro variables para los entornos donde deba funcionar el envío:

```text
EMAILJS_SERVICE_ID
EMAILJS_TEMPLATE_ID
EMAILJS_PUBLIC_KEY
EMAILJS_PRIVATE_KEY
```

Usar los valores del servicio y plantilla ya autorizados en EmailJS. `backend/config.local.php` no se sube ni se lee en Vercel. No trasladar claves a `PUBLIC_*`, al JavaScript del navegador ni al repositorio. Después de cambiar variables, hacer un nuevo despliegue. No es necesario configurar SQL, SMTP ni un servidor XAMPP accesible desde Internet.

La plantilla de EmailJS debe conservar `{{{html_content}}}` en modo HTML y `{{subject}}` como asunto. El destinatario de producción sigue siendo `carolina.candedo@elquetenga.com`, con el servicio emisor autorizado de `jesus.rivas01@elquetengatienda.com`. La cuenta debe permitir solicitudes de servidor y autenticación con clave privada, según [la guía existente de EmailJS](emailjs.md). Para pruebas reales, utilizar primero la plantilla de pruebas ya descrita en esa guía. El despliegue no envía correos automáticamente.

## Sesiones y reintentos sin base de datos

Las funciones usan una cookie de sesión firmada y HttpOnly/SameSite, Secure bajo HTTPS, y un token CSRF. Las firmas usan contextos distintos derivados de la clave privada del servidor. No guardan nombres o respuestas en las cookies ni en disco.

Una segunda cookie firmada recuerda los últimos ocho UUID y hashes confirmados durante la vigencia de la sesión (24 horas), lo que permite reconocer esos reintentos aunque cambie la instancia de Vercel. Dentro de cada instancia también se bloquean envíos concurrentes del mismo registro y se limitan los intentos a 30 por sesión cada 15 minutos.

Sin un almacenamiento compartido no hay garantía de entrega exactamente una vez: dos primeras peticiones simultáneas a instancias diferentes, una respuesta perdida antes de recibir la cookie o el reinicio de una instancia pueden impedir reconocer un envío previo. El límite de intentos en memoria tampoco es global. Los tiempos de espera o respuestas ambiguas del proveedor se informan como entrega no confirmada; revisar el UUID en EmailJS antes de repetir. Las respuestas 429 permiten reintentar después de la espera indicada. Para control global del tráfico, usar las reglas del firewall de Vercel. No existe una cola de reenvío ni una base de participantes.

## Verificar antes de activar

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run test:api
npm.cmd run test:vercel
$env:VERCEL = '1'
npm.cmd run build
Remove-Item Env:VERCEL
```

Las pruebas de PHP y Node simulan EmailJS y nunca llaman al proveedor real. Cubren validación, cálculo, destinatarios fijos, plantilla HTML, CSRF, firma de cookies, reintentos, concurrencia dentro de la instancia, límites y fallos del proveedor.

Después del despliegue, abrir el quiz, completar las preguntas y realizar un envío de prueba autorizado; confirmar HTTP 201 o 200, historial de EmailJS y recepción del mensaje. Sin acceso al proyecto Vercel y a su configuración no se puede confirmar la entrega real desde las pruebas locales.

Referencias: [funciones Node.js de Vercel](https://vercel.com/docs/functions/runtimes/node-js), [sistema de archivos de Vercel](https://vercel.com/docs/functions/runtimes) y [API REST de EmailJS](https://www.emailjs.com/docs/rest-api/send/).
