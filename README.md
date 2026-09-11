# Test de Dependencia · El que tenga tienda

Quiz diagnóstico en español con Astro, HTML5, CSS3 y TypeScript; Vite para desarrollo y compilación; PHP 8.2 y MySQL/MariaDB para guardar los registros. Parte de la arquitectura local de `quiz-the-money-bridge`, con contenido, identidad, puntuación y base de datos independientes.

## Abrir en este equipo

**http://localhost/quiz-tienda/**

La versión compilada está en `dist/`. Apache sirve esa carpeta mediante el `.htaccess` de la raíz. Apache y MySQL deben estar activos en XAMPP. En este equipo Apache utiliza el puerto 80 y MySQL el 3308; la base es `quiz_tienda`. `backend/config.local.php` contiene el ajuste local del puerto y está excluido de Git.

## Instalación desde GitHub

Requiere Node.js 22.12 o posterior, Git LFS, PHP 8.2 con `pdo_mysql` y `mbstring`, y MySQL 8 o MariaDB 10.4 o posterior. En PowerShell se utiliza `npm.cmd` para evitar la restricción del archivo `npm.ps1`.

```powershell
git clone https://github.com/CarlosCont04/quiz-tienda.git
cd quiz-tienda
git lfs install --local
git lfs pull
npm.cmd ci
Copy-Item backend/config.example.php backend/config.local.php
# Ajustar puerto, base, usuario y contraseña en config.local.php.
# Iniciar MySQL en XAMPP.
npm.cmd run db:setup
npm.cmd run dev
```

El desarrollo abre **http://127.0.0.1:4322/**. Un solo comando inicia Astro/Vite en 4322 y PHP en 8082. Vite redirige las peticiones `/api/` a PHP. Son puertos distintos a los del proyecto anterior. Detener con Ctrl+C. Si se usa otra instalación, configurar `PHP_BINARY` con su ruta.

Las variables de proceso `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` tienen prioridad sobre `config.local.php`; después se aplican los valores de `config.example.php`. Los archivos `.env` se reservan a configuración pública de Astro: no escribir credenciales SQL en variables `PUBLIC_*`.

`db:setup` crea la base configurada y las tablas faltantes sin borrar registros. También se puede importar `database/schema.sql` en una base ya creada con phpMyAdmin.

## Compilar para XAMPP

Desde `C:\xampp\htdocs\quiz-tienda`:

```powershell
npm.cmd run build:xampp
```

Abrir **http://localhost/quiz-tienda/**. El comando fija la base de recursos `/quiz-tienda/`. Requiere Apache con `mod_rewrite`, PHP y `AllowOverride All`; la configuración estándar de XAMPP ya los incluye.

Para servir en la raíz de un dominio o probar sin Apache:

```powershell
npm.cmd run build
npm.cmd start
```

Abrir **http://127.0.0.1:8082/**. Detener antes el modo de desarrollo, que utiliza el mismo puerto PHP. La vista previa también admite la compilación de XAMPP en `http://127.0.0.1:8082/quiz-tienda/`.

En un dominio propio, apuntar `DocumentRoot` a `dist/` y conservar `backend/` y `shared/` como directorios hermanos. La carpeta `.runtime/` necesita permisos de escritura para sesiones y temporales; nunca debe servirse públicamente. Los lanzadores locales configuran los temporales PHP dentro del proyecto.

## Experiencia y reglas

El documento **Test de Dependencia - contenido y logica.docx** es la fuente de las doce preguntas, sus cuatro opciones, las tres descripciones y los siguientes pasos por área. Sus notas editoriales y pendientes se trataron como contexto, no como instrucciones de ejecución ni como contenido para el visitante.

1. La primera pregunta está visible al abrir la página. Se puede retroceder y cambiar respuestas antes de terminar.
2. Cada opción vale 0, 1, 2 o 3 puntos según su posición. Máximo: 36 puntos.
3. Al terminar aparece una ventana accesible con “Gracias por responder el quiz”, porcentaje total, descripción, cinco porcentajes por área y recomendaciones.
4. El resultado completo se muestra **antes de pedir datos**. El nombre y la aceptación del uso de datos se solicitan en un registro opcional dentro de esa ventana; no se pide correo.
5. Al registrar el nombre, PHP valida todas las respuestas, vuelve a calcular el resultado y guarda nombre, respuestas, resultado, versión y fecha en una transacción SQL.

Las respuestas permanecen en memoria durante el test; cerrar o recargar la página descarta lo que aún no se haya registrado. Resolver el test sin completar el registro opcional no crea una fila en SQL. No se envían correos ni mensajes ni se suscribe al visitante a campañas. Si falla el registro, el resultado sigue disponible y se puede reintentar.

| Índice mostrado | Puntos | Resultado |
| --- | --- | --- |
| 0–30 % | 0–10 | Dependencia baja |
| 31–64 % | 11–23 | Dependencia media |
| 65–100 % | 24–36 | Dependencia alta |

El índice es `round(puntaje / 36 × 100)`. Se redondea al entero más cercano antes de aplicar los intervalos del documento. Por ejemplo, 11 puntos = 30.56 % → 31 %, dependencia media; 23 puntos → 64 %, media; 24 puntos → 67 %, alta.

| Área | Preguntas | Máximo |
| --- | --- | --- |
| Finanzas | 2, 3, 4 | 9 |
| Operación | 1, 9, 10 | 9 |
| Ventas | 5, 6 | 6 |
| Marketing | 7, 8 | 6 |
| Equipo | 11, 12 | 6 |

El área crítica se determina por su proporción exacta, antes del redondeo para presentación: 6/6 supera a 8/9. El documento no define desempates: se muestran todas las áreas con la mayor proporción y sus siguientes pasos, en el orden de la tabla. Con todos los valores en cero no se marca ninguna como crítica.

El enlace comercial conduce al sitio principal proporcionado. No se inventó un calendario de agenda: el documento lo identifica como pendiente y no incluye su URL. El texto de uso de datos utiliza el contacto publicado por la marca; no se enlaza a su aviso de privacidad porque la ruta consultada devolvía 404. Un calendario y un aviso institucional vigentes pueden integrarse cuando existan sus destinos.

## Arquitectura

```text
src/components/       Cabecera, test, iconos y ventana de resultados
src/layouts/          HTML, metadatos y estilos globales
src/pages/            Página principal Astro
src/scripts/          Navegación, registro y cálculo TypeScript
src/styles/           Variables de marca y diseño responsive
src/assets/           Originales multimedia administrados con Git LFS
shared/quiz.json       Fuente única de preguntas, áreas y mensajes
public/api/           session.php y submit.php
backend/              Cálculo PHP, validación, sesiones, configuración y PDO
database/schema.sql   Esquema MySQL/MariaDB
scripts/              Desarrollo, compilación para XAMPP e instalación SQL
tests/                Reglas, equivalencia TypeScript/PHP e integración SQL
.github/workflows/    Verificación automática en GitHub
dist/                 Salida generada, excluida de Git
```

Se conservaron exactamente las variables de diseño solicitadas en `src/styles/global.css`. El HTML se genera estáticamente; el navegador carga solo el JavaScript del test, sin framework de interfaz ni fuentes remotas. La portada del libro se reutilizó del recurso local `JesusRivas/public/media/libro-atienda.webp`, se verificó visualmente y Astro produce una versión WebP optimizada para su tamaño de presentación.

La interfaz incluye controles nativos, grupos de radio con leyenda, navegación por teclado, mensajes de validación, foco dirigido al cambiar de pregunta, diálogo modal con Escape y retorno de foco, texto alternativo, enlace de salto, estados de guardado y soporte de movimiento reducido. Se definieron adaptaciones para pantallas de 320 px en adelante. La verificación de esta entrega fue de compilación, reglas, HTTP y SQL; no incluye una auditoría visual automatizada en navegador.

## Datos y API

- `GET /api/session.php`: obtiene una cookie de sesión HttpOnly/SameSite y un token CSRF.
- `POST /api/submit.php`: acepta JSON con `requestId` UUID v4, `name`, `consent: true`, `website: ""` y `answers: [{"questionId": 1, "value": 0}, ...]`. Requiere cookie y cabecera `X-CSRF-Token`.
- `201`: guardado; `200`: reintento idéntico ya guardado; `403`: sesión inválida; `409`: identificador utilizado con otro contenido/sesión; `413`: cuerpo excesivo; `415`: formato incorrecto; `422`: datos inválidos; `429`: límite por sesión; `503`: servicio no disponible.

Las consultas usan PDO con parámetros y una transacción para las dos tablas. El identificador único evita registros duplicados en reintentos. El servidor ignora puntajes enviados por el cliente; también valida consentimiento, longitud de nombre, IDs únicos, enteros entre 0 y 3 y tamaño máximo del cuerpo. El esquema refuerza los rangos, la clasificación y la relación entre preguntas y áreas. Los errores públicos no revelan SQL ni credenciales.

`quiz_submissions` almacena el nombre, índice, puntuación, nivel, resultado completo en JSON —incluidas áreas críticas y desglose—, versiones, fecha UTC y hashes del envío y de la sesión. `quiz_answers` guarda las doce respuestas, área y puntos, vinculadas por clave foránea. Se consultan mediante phpMyAdmin u otro cliente SQL autorizado; no hay un listado público de participantes. Borrar una participación elimina sus respuestas por cascada.

Para un servidor público, usar HTTPS y un usuario SQL limitado a `SELECT` e `INSERT` en estas tablas. Las credenciales de instalación se mantienen fuera del servicio web. El límite de 30 intentos cada 15 minutos por sesión es básico; la protección adicional frente a tráfico abusivo corresponde al servidor frontal. La marca debe definir su política de conservación e integrar su aviso institucional al publicar públicamente.

## Verificación

```powershell
npm.cmd test
npm.cmd run test:api
npm.cmd run build:xampp
```

- Las pruebas PHP cubren todos los puntajes, clasificación, normalización, validaciones, áreas, empates y manipulación de puntuación.
- Las pruebas TypeScript comparan el resultado completo con PHP para 293 casos deterministas.
- La integración inicia PHP temporalmente en 8083 y crea una base separada `quiz_tienda_test`. Comprueba persistencia SQL real de los tres niveles, Unicode, doce respuestas, idempotencia, CSRF, límites, formatos y validación. Elimina solo los UUID creados por esa ejecución con el prefijo de nombre `PRUEBA AUTOMATIZADA`; no toca la base de uso normal.
- GitHub Actions ejecuta estas verificaciones con MySQL 8.

## Git y Git LFS

Repositorio: **https://github.com/CarlosCont04/quiz-tienda**. Los originales WebP, PNG, JPG, fuentes y otros recursos binarios se administran con `.gitattributes` y Git LFS; JSON, código y lockfile con Git. Se excluyen dependencias, salida compilada, secretos, sesiones y temporales. El documento de entrada no se copia al repositorio.

Referencias: [sitio de El que tenga tienda](https://elquetengatienda.com/), [documentación oficial de Astro](https://docs.astro.build/en/install-and-setup/) y [sentencias preparadas de PDO](https://www.php.net/manual/en/pdo.prepared-statements.php).
