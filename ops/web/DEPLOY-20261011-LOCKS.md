# API 1.1.1 — validación adicional de concurrencia (11/oct/2026)

Base Git: `fb31544`. Imagen API: `junto-api:20261011-locks`.
Web: `junto-web:20261011-polish`; APK 1.1.1/code 3 sin cambios.

## Activación

Respaldo validado antes de migrar: `/opt/junto/backups/junto-20261011T142356Z.dump`.
Migración aditiva `20261013000000_reminder_deadline_identity`: columna nullable y clave única
de recordatorios por etapa/fecha/personas. Once migraciones presentes, ninguna pendiente.
Los registros anteriores se conservan; referencia histórica nula, sin backfill inventado.

Compilación en Contabo desde una lista explícita de fuentes, sin archivos privados ni artefactos
de QA. Solo se recreó `junto-api-1`; base de datos y web no recreadas. Contenedores ajenos,
Cloudflare DNS/MX/TLS y Caddy sin modificar. `compose.env` selecciona la imagen nueva.

`/health` y `/ready`: 200; `/app/register`: 200; chat sin sesión: 401. Contenedor API saludable.
Ninguna cuenta ni transacción financiera ficticia creada en producción en esta ronda.
Chromium y WebKit sobre HTTPS: login/logout de la cuenta QA autorizada ya existente, seis
anchos, entrada al grupo y preparación del correo; sin pulsar enviar ni crear otra cuenta.
Se actualizó el selector del test de invitación al botón actual «Invitar personas».

## Validación

PostgreSQL local real: carrera reportar/confirmar, pérdida de permisos al esperar, integrantes
que salen durante guardar/editar/eliminar, recordatorios con deuda que desaparece, fechas
movidas, cron desactivado, dos trabajadores concurrentes, intervalo de protección y acceso
de ex-integrantes. Eliminación de cuenta concurrente con unión y cambio de credenciales.
Mismos controles pasan desde una base vacía con migraciones versionadas; diff vacío.

Integración local: sesiones/OTP, eliminación, seguridad, cuentas puntuales, gastos idempotentes,
comprobantes/comentarios, reparto, avisos de unión y SMTP loopback. Navegadores Chromium y
WebKit: registro/verificación/login/recuperación, invitaciones, S/ 500 y seis anchos.
75 pruebas de dominio; 15 UX móvil; 3 distribución; TypeScript/lint móvil y build API.

No se validó una nueva entrega externa Gmail/Outlook, push real, Google OAuth Android real,
UI nativa ni teléfonos físicos. Continúa siendo beta; ver `RELEASE_CHECKLIST.md`.

## Rollback

`/opt/junto/compose.env.20261011-locks.bak` conserva la selección anterior.
`junto-api:20261011-polish` sigue disponible: seleccionar explícitamente esa imagen al
recrear solo `api`, y restablecer la selección persistida. La migración es compatible con
la API anterior: no retirar columna/índice ni restaurar una base antigua para revertir código.
Restaurar el respaldo perdería actividad posterior y requiere decisión independiente.

La referencia exacta de fecha evita deduplicar contra una fecha anterior. Avisos históricos
sin referencia pueden volver a emitirse después de la protección mínima de 12 horas; no
afirmar que se recuperó la fecha original. SMTP/push son best effort después del commit:
persistir un aviso no acredita recepción del proveedor ni del dispositivo.
