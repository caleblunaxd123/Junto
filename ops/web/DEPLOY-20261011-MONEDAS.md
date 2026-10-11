# Beta 1.3.0 — monedas, cambio y pagos externos

Fuente de aplicación: `79587a4` (funcionalidad `582e95d`). CI `38178461503` verde antes de activar. App 1.3.0, versionCode 7.

## Respaldo y activación

- Respaldo privado `/opt/junto/backups/junto-20261011T215741Z.dump`, restaurado en una base nueva de ensayo: doce registros de migraciones, ninguno pendiente. Solo esa base temporal fue eliminada al pasar; el dump se conserva.
- Copia fuera del VPS cifrada con Windows DPAPI, verificada por descifrado y comparación SHA-256; protegida por la cuenta Windows del propietario. Requiere preservar esa cuenta/credenciales para recuperarla. La copia temporal sin cifrar se retiró; no se subió a Git.
- Aplicadas cinco migraciones aditivas: importación de cuentas, moneda del grupo, conversión, fecha/referencia/avisos de pago y moneda del comprobante. Producción tiene diecisiete migraciones terminadas. Grupos existentes siguen en PEN.
- API `junto-api:20261011-beta130` (alias auditado `junto-api:20261011-monedas`), web `junto-web:20261011-monedas`. Configuración API anterior preservada en `compose.env.20261011-beta130.bak` y `runtime.env.20261011-beta130.bak`.
- Contexto fuente archivado sin secretos en `/opt/junto/releases/79587a4`. La primera prueba de arranque detectó permisos privados de la extracción: se normalizaron únicamente archivos/directorios de esa fuente pública antes de reconstruir/auditar. No se cambiaron permisos de los archivos privados de entorno ni se activó la imagen fallida.
- Usuario runtime `node`, sin puertos públicos de API/DB ni cambios a Caddy, DNS, MX, TLS u otros servicios. Auditoría de la imagen API: cero vulnerabilidades instaladas. Readiness devuelve 503 con DB inaccesible. Rol `junto_app` no propietario; comprobados SELECT/INSERT/UPDATE/DELETE en todas las tablas y prohibición de editar migraciones/crear esquema.

## APK y verificación

- [APK 1.3.0](https://junto.lunalav.pe/app/descargas/JUNTO-beta-1.3.0.apk), Google habilitado y **sin entrega push configurada**. Mismo certificado beta SHA-256 `0f0c5c53e2ab1e83d9b278c805d9be75e99961f0abd7b239d9a26e4d2ee7df97`.
- SHA-256 binario `c084ed81d2e1b69d19c33e16ef0298be35d4cb90086cef62be17015e7c5f4163`, idéntico en local y descarga HTTPS. No depurable, Android 7+, ARM64/x86_64 y bundle Hermes incluido; no depende de Metro. Sin valores privados de los entornos conocidos ni archivos de llaves. Descargas anteriores conservadas.
- Actualización sobre la APK anterior en el emulador, sin desinstalar: versión 1.3.0/code 7, sesión conservada y pantallas accesibles. No se introdujeron cuentas/pagos usando la cuenta real del propietario.
- `/ready`, `/health` y web 200; smoke privado/CORS/JSON/páginas legales correcto. Chrome/WebKit por HTTPS: login/logout de la cuenta QA existente, seis anchos, grupo y preparación de correo; sin nuevos correos.
- Referencia USD→PEN obtenida por HTTPS para el grupo QA existente, con fecha/fuente y tasa válida; avisos internos accesibles. Ningún nuevo gasto/pago ni contacto a amigos.
- QA local: 79 pruebas de dominio y todos los pasos unitarios/de integración del workflow; reporte/confirmación entre dos sesiones en Chrome/WebKit, 390/1440 px. Restauración, concurrencia, privacidad, cumpleaños/invitados y OCR real con imágenes ficticias.

## Reversión y pendientes

**No revertir a `20261011-nombres` tras crear grupos extranjeros**: interpreta PEN y carece de protección multimoneda. La copia anterior es evidencia de configuración, no autorización para activarla a ciegas. Corregir hacia adelante o mantener una API compatible con monedas; conservar dump e imágenes. Si se restaura todo el libro, requiere revisión y consentimiento para la pérdida de operaciones posteriores.

Google físico en esta APK, WhatsApp real, TalkBack/letra grande, comprobantes reales y FCM/Expo con app cerrada siguen pendientes. Avisos dentro de JUNTO y recepción push no son equivalentes. No es publicación en Play Store ni TestFlight.
