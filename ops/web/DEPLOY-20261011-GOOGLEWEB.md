# Web — 11 de octubre de 2026: cuentas de Google en la web

Fuente: `b63956c` en `main`. Solo web: `junto-web:20261011-googleweb` en `/opt/junto-beta`.
API (`junto-api:20261011-beta130`), base de datos y APK sin cambios; no hubo migraciones.

Problema: una cuenta creada con Google (en el APK) que entraba a la web beta, que no tiene
«Continuar con Google», recibía «Esta cuenta entra con Google» sin salida posible.
Ahora la web explica la situación y ofrece «Crear una contraseña» (código por correo, correo
prellenado). La invitación pendiente se conserva y Google sigue vinculado para la app.

Comprobado: `ops/test-google-only-web.cjs` en Chromium y WebKit (local, sin peticiones externas);
web 200 con el bundle nuevo (`USA_GOOGLE` presente); las seis descargas APK siguen en 200;
`/ready` 200.

Rollback: `cd /opt/junto-beta` con `JUNTO_WEB_IMAGE=junto-web:20261011-monedas`.

Pendiente: «Continuar con Google» en la web requiere autorizar el origen
`https://junto.lunalav.pe` en el cliente OAuth web de Google Cloud, permitir los dominios de Google
en la CSP del servidor web e integrar Google Identity Services.
