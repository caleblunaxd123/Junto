# Beta 1.1.1 — 11 de octubre de 2026

Fuente funcional: `15f75fd`, sincronizada desde `5550a6f` de GitHub sin descartar cambios.
API `junto-api:20261011-polish`, web `junto-web:20261011-polish`.

## Activación comprobada

Respaldo PostgreSQL validado: `/opt/junto/backups/junto-20261011T135721Z.dump`.
Prisma: diez migraciones presentes, ninguna pendiente; no se agregó migración en esta ronda.
Solo se recrearon los servicios API/web de JUNTO. Base privada y contenedores de otros proyectos
sin recrear; DNS, MX, Caddy y TLS global de Cloudflare sin cambios.

`/health` y `/ready`: 200. Chat sin sesión: 401. `/app/` y `/app/register`: 200.
Bundle web nuevo `entry-3b403186773b335aa773c6d64d69147d.js` confirmado por HTTPS.

APK: `https://junto.lunalav.pe/app/descargas/JUNTO-beta-20261011-polish.apk`.
75,065,795 bytes; MIME Android; versión 1.1.1, versionCode 3; arm64-v8a + x86_64;
no depurable y firmado con el mismo certificado local de beta anterior.
SHA-256 local y descargado: `f2510c42619915a5c33ad735a7e6429ab755ac754ab0f2cf8d6d3870ca196c5e`.
Instalación `adb install -r`: Success; paquete del emulador confirma versión 1.1.1/code 3.
No se usó Metro para compilar la entrega. No equivale a una validación nativa completa.

Se conservaron las descargas públicas `JUNTO-beta-20261010.apk` y `JUNTO-beta-20261011.apk`.
No se crearon cuentas ni pagos de prueba en producción. Las pruebas de SMTP fueron locales.

## Rollback

API: `compose.env.20261011-polish.bak` conserva la selección previa de imagen;
`junto-api:20261011-chat` sigue disponible. Activar explícitamente esa imagen al revertir API.
Web: `cd /opt/junto-beta` y seleccionar `JUNTO_WEB_IMAGE=junto-web:20261011-chat`
al ejecutar Docker Compose del servicio web. El despliegue web requiere selección explícita
de imagen (no hay `.env` web). APK anterior 1.1.0 conservado.

Validaciones funcionales y límites actuales: `PROGRESS.md` (sección beta 1.1.1).
Push externo, OAuth Android real, alias invitado, pruebas en dispositivos físicos y tiendas
siguen pendientes; no afirmar «lista para Play Store» basándose solo en estas pruebas.
