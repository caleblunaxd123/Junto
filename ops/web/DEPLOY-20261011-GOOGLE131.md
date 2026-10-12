# Candidata 1.3.1 — Google web y cambios recientes

Base GitHub `fea86c8`: respuestas, reacciones, presencia, mensaje fijado y foto de perfil.
Esta candidata todavía no acredita activación ni inicio real con Google.

- Google web: botón oficial GIS, nonce y validación de firma/audiencia/vencimiento; correo y contraseña alternativos conservan la invitación. Origen HTTPS de JUNTO guardado en el cliente existente con autorización del propietario, sin permisos Gmail ni secretos de cliente en la app.
- Corregida deduplicación del chat: respuestas iguales a mensajes distintos no se descartan. Corregidos tipos de hover incompatibles con React Native en CI.
- QA en base local nueva `junto_google_web_qa_20261011`: 22 migraciones, sin desfase; 84 pruebas de dominio, TypeScript y lint, suite de integración y Chrome/WebKit. SDK simulado para error/reintento, token rechazado, callback doble y sesión local: no equivale a un acceso real Google.
- Respaldo `/opt/junto/backups/junto-20261012T015152Z.dump`, restaurado con las 17 migraciones actuales en una base temporal nueva. Copia externa DPAPI verificada; requiere la cuenta Windows del propietario. Se retiró únicamente su copia temporal sin cifrar.
- El helper antiguo de restauración del VPS esperaba ocho migraciones y dejó su base de ensayo al fallar. Se utilizó el helper revisado en `restore-check-20261011.sh`, de nombre único y conteo explícito; producción no fue sobrescrita. La base de ensayo anterior no se eliminó.
- APK candidata 1.3.1/code 8, mismo certificado beta, Google habilitado. No activa recepción push FCM ni representa publicación de tienda.

Antes de activar: CI verde, imagen API auditada, readiness con DB inaccesible, migración aditiva a 22 tablas históricas, privilegios runtime y smoke HTTPS. Conservar API/web anteriores y descargas; no restaurar el libro sobre operaciones nuevas sin consentimiento. Para reversión coordinada, web `20261011-googleweb` y API `20261011-beta130` son la referencia anterior compatible con monedas; las migraciones aditivas no se deshacen.

Pendientes de esta candidata: activación, hash de APK publicado, Google web real, actualización en emulador, validación física Google/WhatsApp/TalkBack y entrega push con app cerrada.
