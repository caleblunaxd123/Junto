# JUNTO: acceso, HTTPS y correo

## Estado comprobado el 8 de octubre de 2026

- VPS de Contabo: `217.216.82.43`. SSH funciona con **`deploy`** y la clave local `contabo_vps`; `root` está restringido por política. No se habilitaron contraseñas ni root SSH. No hizo falta cambiar la clave existente.
- Cloudflare: creado, con aprobación específica del propietario, el registro A `junto.lunalav.pe → 217.216.82.43`, Solo DNS. No se cambiaron MX, SPF ni el modo TLS de la zona.
- API publicada en `https://junto.lunalav.pe`: certificado validado sin omitir TLS, redirección HTTP 308, `/ready` 200, rutas privadas 401 y páginas públicas disponibles. Estas páginas **no son la aplicación web para iPhone**.
- Contenedores separados en `/opt/junto`, base privada sin puertos públicos, API como usuario `node`, disco de solo lectura y rol `junto_app` sin permisos de dueño. Ocho migraciones aplicadas. Respaldo comprobado mediante restauración real en una base de ensayo; esa base temporal se retiró después de comprobarla.
- LunaLav y AlcancIA siguieron respondiendo tras la recarga del proxy. Se conservó `/opt/stack/Caddyfile.before-junto-20261008` para rollback.
- Imagen desplegada `junto-api:20261008-release`: digest `sha256:f90782f38fdbf3ea3b2b0e9fdf576cda5da6d9f1956836944bcae05f6140099f`. Auditoría de dependencias de esta imagen: 0 vulnerabilidades; **no equivale** a certificar Expo, el sistema operativo o toda la app. OCR real sin red leyó la boleta sintética S/180.00 en 4.36 segundos.
- El gateway IA privado fue accesible desde la API: llamadas sin clave rechazadas, clave de la API aceptada. No se ejecutó inferencia en esta comprobación; no acredita una mejora en la latencia del modelo.
- SMTP de Gmail: conexión de comprobación sin envío; autenticación rechazada (`EAUTH`, `535`). No se acreditó recepción real ni se enviaron mensajes a terceros.
- La API está intencionalmente sin proveedor de correo hasta corregir la autenticación. El registro/verificación y recuperación no deben considerarse operativos todavía. El emulador sigue con su API local, no se recompiló una distribución para amigos.

## Desbloquear acceso sin reducir seguridad

Usar el usuario `deploy`, no `root`, con `C:\Users\Caleb\.ssh\contabo_vps`. No compartir claves privadas ni contraseñas en el chat. Mantener restringido root SSH, Fail2Ban activo y la verificación estricta del host. La contraseña publicada previamente en el chat debe mantenerse reemplazada mediante un canal privado.

La receta de producción y las comprobaciones están en [contabo/README.md](contabo/README.md). No usar `docker-compose.yml` local: contiene credenciales de desarrollo y expone PostgreSQL. No tocar `/opt/stack`, bases o volúmenes de otras apps salvo el bloque exclusivo de JUNTO en el Caddyfile, respaldado y validado antes de recargar.

## Comprobar SMTP sin enviar mensajes

Crear una contraseña de aplicación de Google en la **misma cuenta** que `SMTP_USER`, con verificación en dos pasos. El propietario realiza esa acción; no se puede recuperar una contraseña de aplicación desde la bandeja de Gmail. Guardar el valor solo en el archivo privado ignorado `apps/api/.env.smtp.local`.

Desde `apps/api`, después de compilar:

```powershell
node -r dotenv/config dist/scripts/check-email.js dotenv_config_path=.env.smtp.local
```

`email:check` valida conexión TLS y autenticación, **no manda correo**. `email:test` sí envía un mensaje: ejecutarlo solo con un destinatario de prueba autorizado y después revisar bandeja y spam. Nunca imprimir el archivo `.env` ni las credenciales al diagnosticar.

Para Gmail configurar `EMAIL_FROM` con la cuenta remitente o un alias autorizado; no usar un dominio arbitrario como remitente. Los registros MX/SPF de Cloudflare Email Routing no habilitan SMTP de salida ni necesitan cambiarse para usar Gmail.

## Pendientes antes de distribuir a amigos

1. Corregir SMTP, comprobar autenticación y después entrega real, registro/OTP y recuperación. Revisar bandeja y spam del destinatario autorizado.
2. Configurar el proyecto EAS, firma Android, cliente OAuth compatible, FCM y App Links. Ajustar la API pública a `https://junto.lunalav.pe` al compilar; no distribuir el build local con `10.0.2.2`.
3. Probar la APK en dispositivos externos reales con datos ficticios, incluyendo invitaciones, cuentas, confirmaciones y envío de resumen. El SMTP disponible no acredita recepción ni lectura.
4. Implementar y verificar una versión web si se elige esa vía para iPhone sin membresía Apple Developer. El host HTTPS existente sirve de base, pero aún no ofrece ese cliente.
5. Configurar responsable legal real, monitoreo y copias externas cifradas/automáticas con restauración periódica. No se instaló una tarea automática de backup en esta validación.

FCM v1 y el proyecto EAS siguen siendo necesarios para notificaciones reales en Android. La API comprueba tickets y recibos de Expo y elimina metadatos tras 24 horas; eso no prueba que alguien haya leído un aviso.
