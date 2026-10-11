# Beta 1.2.0 — 11 de octubre de 2026 (división de gastos con integrantes por nombre)

Fuente: `14d89a4` en `main` (funcionalidad `8375408`). App 1.2.0, versionCode 6.

## Producción

- Respaldo PostgreSQL validado antes de migrar: `backups/junto-20261011T200459Z.dump`.
- Migración `20261014000000_members_by_name` aplicada (aditiva: `usuarios.sin_cuenta`,
  `grupo_miembros.codigo_personal` único). La API anterior siguió sana mientras tanto.
- API `junto-api:20261011-nombres`, compilada en el servidor desde la fuente exacta.
  `compose.env` actualizado; copia `compose.env.20261011-nombres.bak`.
- Web `junto-web:20261011-nombres` en `/opt/junto-beta`, configuración pública de producción
  sin `.env` local (0 referencias locales, sin Google en web, como antes).
- APK `https://junto.lunalav.pe/app/descargas/JUNTO-beta-20261011-nombres.apk`: Google habilitado
  (`-EnableGoogle`, sin push), mismo certificado que las betas anteriores, no depurable,
  arm64-v8a + x86_64. SHA-256 `d965af927a81d31200628dcc2a5795e812eb4bfdb1f3260cb3e56c2b4e8afd7c`,
  igual local y HTTPS. Se conservaron las cuatro descargas anteriores (20261010, 20261011,
  -polish, -google).

## Comprobado tras activar

`/ready` y `/health` 200; chat, `/grupos/:id/integrantes` y `/pagos/recibido` exigen sesión (401);
job horario de fechas límite programado; web 200 con el bundle nuevo; las cinco descargas APK 200;
instalado sobre la 1.1.3 en el emulador (actualizó a 1.2.0, conservó la sesión) y arranca.
No se crearon cuentas, grupos, integrantes ni pagos en producción y no se enviaron correos.
El flujo completo se probó en local: `ops/test-members-by-name.cjs`, regresiones API y web.

## Rollback

API: `compose.env.20261011-nombres.bak` (imagen `junto-api:20261011-google`).
Web: `cd /opt/junto-beta` con `JUNTO_WEB_IMAGE=junto-web:20261011-google`.
La migración es aditiva: la API anterior la tolera (los integrantes por nombre ya creados se
verían como integrantes normales sin cuenta).
