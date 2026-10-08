# JUNTO: acceso, HTTPS y correo

## Estado comprobado el 7 de octubre de 2026

- VPS de Contabo: `217.216.82.43`, usuario `root`. El servidor SSH ofrece únicamente autenticación por clave pública. La clave local `contabo_vps` fue rechazada. Una contraseña no sirve mientras el servidor solo acepte claves.
- Cloudflare: zona `lunalav.pe`, sin registro JUNTO al inspeccionarla. No se cambiaron DNS, MX, SPF, modo TLS ni servicios de otros proyectos.
- SMTP de Gmail: conexión de comprobación sin envío; autenticación rechazada (`EAUTH`, `535`). No se acreditó recepción real ni se enviaron mensajes a terceros.
- El panel nuevo confirma el VPS en ejecución y ofrece `Más → Restablecer credenciales → Clave SSH`. Se dejó esta opción abierta sin introducir ni aplicar ninguna credencial. El propietario debe completar la restauración; no hace falta cambiar la contraseña para resolver la autenticación solo por clave.

## Desbloquear acceso sin reducir seguridad

El propietario debe proporcionar la ruta de una clave privada ya autorizada para ese servidor, o autorizar desde la consola del VPS la clave **pública** existente en `C:\Users\Caleb\.ssh\contabo_vps.pub` para `root`. No compartir claves privadas ni contraseñas en el chat. No habilitar autenticación por contraseña ni reinstalar/reiniciar el servidor para resolver esto. Cambiar la contraseña compartida en el chat desde un canal privado cuando se recupere el acceso.

Antes de desplegar: identificar el reverse proxy y las apps existentes, la carpeta de JUNTO, el gestor de procesos, la base de producción y los respaldos. No usar `docker-compose.yml` local como receta de producción: contiene credenciales de desarrollo y expone PostgreSQL.

## Comprobar SMTP sin enviar mensajes

Crear una contraseña de aplicación de Google en la **misma cuenta** que `SMTP_USER`, con verificación en dos pasos. El propietario realiza esa acción; no se puede recuperar una contraseña de aplicación desde la bandeja de Gmail. Guardar el valor solo en el archivo privado ignorado `apps/api/.env.smtp.local`.

Desde `apps/api`, después de compilar:

```powershell
node -r dotenv/config dist/scripts/check-email.js dotenv_config_path=.env.smtp.local
```

`email:check` valida conexión TLS y autenticación, **no manda correo**. `email:test` sí envía un mensaje: ejecutarlo solo con un destinatario de prueba autorizado y después revisar bandeja y spam. Nunca imprimir el archivo `.env` ni las credenciales al diagnosticar.

Para Gmail configurar `EMAIL_FROM` con la cuenta remitente o un alias autorizado; no usar un dominio arbitrario como remitente. Los registros MX/SPF de Cloudflare Email Routing no habilitan SMTP de salida ni necesitan cambiarse para usar Gmail.

## Aplicación en producción, cuando haya acceso

1. Respaldar la base y comprobar su estado de migraciones; seguir `apps/api/prisma/MIGRATIONS.md`. No ejecutar `migrate dev`, `db push` ni reinicializar datos.
2. Instalar el lockfile, generar Prisma y compilar con Node 22. Instalar OpenSSL antes de generar Prisma si se usa una imagen Linux mínima. Aplicar las migraciones versionadas con `prisma migrate deploy`; la nueva tabla `recibos_push` es aditiva.
3. Configurar secretos en el servidor, nunca en variables públicas de Expo. Mantener `EMAIL_DEV_LOG` desactivado y un proveedor real en producción.
4. Preparar un host exclusivo de JUNTO en el proxy existente, certificado válido y renovación. Confirmar el host antes de agregar DNS. No apuntar a un virtual host por defecto ni cambiar el modo TLS de toda la zona.
5. Verificar HTTPS en `/health`, registro/verificación y recuperación de una cuenta ficticia, resumen de gastos recibido en Gmail y Outlook y estado de aceptación honesto. Revisar el correo recibido, no solo la respuesta del proveedor.
6. Ajustar las URLs públicas de API, privacidad, eliminación e invitaciones y recompilar la app distribuida. Comprobar App Links y OAuth para el certificado de firma.

FCM v1 y el proyecto EAS siguen siendo necesarios para notificaciones reales en Android. La API comprueba tickets y recibos de Expo y elimina metadatos tras 24 horas; eso no prueba que alguien haya leído un aviso.
