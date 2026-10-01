# Actualizar la landing con descarga de diagnóstico en PDF

Esta guía corresponde a la instalación que ya funciona en **https://elquetengatienda.com/quiz/**, con todo el formulario dentro de `elquetengatienda.com/quiz/` en HostGator.

El botón **Descargar diagnóstico en PDF** aparece después de **Por dónde empezar** y antes de **¿Quieres trabajar en lo que encontraste?**. La descarga está disponible al completar el cuestionario, incluso antes de registrar el nombre o enviar el correo. El PDF se genera en el navegador y contiene porcentaje, puntaje, nivel, cinco áreas, recomendaciones y las doce respuestas. Descargarlo no envía un correo.

## 1. Obtener la actualización

Desde la carpeta del repositorio en PowerShell:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build:hosting
npm.cmd run test:hosting
```

La terminal indica la ruta a `artifacts/hosting-FECHA/quiz-actualizacion-pdf.zip`. Puedes encontrar la ruta más reciente en `artifacts/latest-hosting.json`, campo `updateArchive`.

**Para esta actualización utiliza `quiz-actualizacion-pdf.zip`.** El archivo `quiz-hosting.zip` corresponde a una instalación completa y contiene puntos de entrada PHP con una ruta privada predeterminada distinta a la que se adaptó en tu hosting.

El ZIP de actualización contiene únicamente:

```text
index.html
_astro/
  archivos CSS, JavaScript e imágenes compilados
```

## 2. Respaldar la página actual

En cPanel, abre el Administrador de archivos y entra en `elquetengatienda.com/quiz/`.

Descarga a tu computadora una copia de `index.html` y la carpeta `_astro`. Conserva ese respaldo para poder volver a la versión anterior si fuera necesario.

La configuración del formulario permanece en `api/` y `quiz-private/`. El paquete de actualización no incluye esas carpetas, ni `.htaccess`, ni claves de correo. No reemplaces `api/private-root.php` ni `quiz-private/backend/config.local.php`.

## 3. Subir a HostGator

1. Descomprime `quiz-actualizacion-pdf.zip` en tu computadora.
2. Sube los archivos de su carpeta `_astro` a `elquetengatienda.com/quiz/_astro/` primero. Debes incluir **todos** los archivos nuevos: el generador de PDF se carga como un módulo adicional al pulsar el botón.
3. Después reemplaza `elquetengatienda.com/quiz/index.html` con el archivo nuevo.
4. Si prefieres usar **Cargar → Extraer** de cPanel, selecciona como destino exacto `elquetengatienda.com/quiz/`. El ZIP ya contiene `index.html` y `_astro` directamente; no crees una carpeta adicional `quiz`, `dist` o `public_html`.
5. Tras comprobar la actualización, retira el ZIP subido si lo dejaste en la carpeta pública.

Conserva los recursos antiguos de `_astro` durante la actualización: una persona con la página anterior abierta puede seguir utilizándolos. Los archivos nuevos tienen nombres propios y pueden coexistir.

La estructura final es:

```text
elquetengatienda.com/
└── quiz/
    ├── index.html                    ← reemplazar
    ├── _astro/                      ← agregar recursos nuevos
    ├── .htaccess
    ├── api/
    │   └── private-root.php          ← conservar la ruta que ya funciona
    └── quiz-private/
        ├── .htaccess
        ├── backend/config.local.php ← conservar las claves
        ├── shared/
        └── .runtime/sessions/
```

Solo se actualiza el contenido de `quiz`. No hacen falta nuevas extensiones PHP ni cambios en el dominio principal.

## 4. Comprobar la descarga

1. Recarga la landing con **Ctrl + F5** o abre una ventana de incógnito. Si utilizas caché del hosting o CDN, purga la página `/quiz/`.
2. Contesta las doce preguntas y abre el resultado.
3. Confirma la posición y el texto del botón **Descargar diagnóstico en PDF**.
4. Pulsa el botón sin completar el registro de correo. Debe descargarse un archivo `diagnostico-dependencia-AAAA-MM-DD.pdf`.
5. Abre el archivo y compara el porcentaje, el nivel y las cinco áreas con lo mostrado en pantalla. Revisa también las recomendaciones, las doce respuestas y los acentos.
6. Vuelve a hacer el test con respuestas distintas y descarga otro PDF. Debe corresponder al resultado nuevo, no al anterior.
7. Para confirmar el funcionamiento completo del formulario, puedes realizar un envío de correo identificado como prueba y revisar su recepción. Ese paso sí envía correo; descargar el PDF no lo hace.

Si el botón no aparece, se está sirviendo HTML anterior. Si aparece pero la descarga falla, revisa que todos los JavaScript nuevos de `_astro` se hayan subido y que no devuelvan 404 en la pestaña Red/Network del navegador. En móviles el navegador puede ofrecer abrir, guardar o compartir el PDF.

## 5. Volver a la versión anterior

Si necesitas restaurar, vuelve a subir el `index.html` del respaldo. Como los archivos antiguos de `_astro` se conservaron, la página anterior podrá cargarlos. Purga la caché de la landing y vuelve a abrirla.
