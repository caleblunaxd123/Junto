# JUNTO: acceso, HTTPS y correo

## Estado comprobado el 8 de octubre de 2026

- VPS de Contabo: `217.216.82.43`. SSH funciona con **`deploy`** y la clave local `contabo_vps`; `root` está restringido por política. No se habilitaron contraseñas ni root SSH. No hizo falta cambiar la clave existente.
- Cloudflare: creado, con aprobación específica del propietario, el registro A `junto.lunalav.pe → 217.216.82.43`, Solo DNS. No se cambiaron MX, SPF ni el modo TLS de la zona.
- API publicada en `https://junto.lunalav.pe`: certificado validado sin omitir TLS, redirección HTTP 308, `/ready` 200, rutas privadas 401 y páginas públicas disponibles. Estas páginas **no son la aplicación web para iPhone**.
- Contenedores separados en `/opt/junto`, base privada sin puertos públicos, API como usuario `node`, disco de solo lectura y rol `junto_app` sin permisos de dueño. Ocho migraciones aplicadas. Respaldo comprobado mediante restauración real en una base de ensayo; esa base temporal se retiró después de comprobarla.
- LunaLav y AlcancIA siguieron respondiendo tras la recarga del proxy. Se conservó `/opt/stack/Caddyfile.before-junto-20261008` para rollback.
- Imagen desplegada `junto-api:20261008-release`: digest `sha256:f90782f38fdbf3ea3b2b0e9fdf576cda5da6d9f1956836944bcae05f6140099f`. Auditoría de dependencias de esta imagen: 0 vulnerabilidades; **no equivale** a certificar Expo, el sistema operativo o toda la app. OCR real sin red leyó la boleta sintética S/180.00 en 4.36 segundos.
- El gateway IA privado fue accesible desde la API: llamadas sin clave rechazadas, clave de la API aceptada. No se ejecutó inferencia en esta comprobación; no acredita una mejora en la latencia del modelo.
- SMTP de Gmail: autenticación y TLS correctos tanto localmente como desde Contabo. Solo se transfirieron los campos SMTP necesarios, no el `.env` local completo. Se configuró el remitente JUNTO con la misma cuenta autenticada y se reinició exclusivamente la API de JUNTO.
- Entrega real comprobada: mensaje técnico ficticio enviado desde Contabo a `calebluna41@gmail.com`, encontrado por su Message-ID en Gmail con etiqueta `INBOX`, sin `SPAM`, el 8 de octubre aproximadamente a las 19:15 (Lima). No se crearon cuentas, gastos ni pagos. Esto acredita ese mensaje en Gmail, no entrega a Outlook ni todos los flujos OTP.
- `/health` muestra `email: smtp`, `/ready` sigue disponible y las comprobaciones HTTPS/CORS/rutas protegidas pasaron después de activar correo. Falta validar registro/verificación y recuperación de extremo a extremo en un cliente distribuido. El emulador sigue con su API local; no se recompiló una distribución para amigos.
- Segunda prueba autorizada, 8 de octubre a las 22:12 (Lima): seis plantillas por cada uno de los dos destinatarios autorizados, 12 aceptaciones SMTP. Lote `2026-10-09T03-12-13-059Z`. Las seis muestras al propietario se encontraron en `INBOX`, sin `SPAM`; las otras seis aparecen en `SENT`, **no se tuvo acceso a la bandeja de la otra persona**. Recepción allí pendiente de su confirmación. No se guardan direcciones privadas de terceros en el repositorio.
- Se comprobaron las plantillas de verificación, recuperación, bienvenida, cuenta puntual, grupo y gasto. Aviso PRUEBA visible en HTML/texto, códigos `000000` sin estado real, sin cuentas/gastos/pagos nuevos en producción. Ejemplo S/100 dividido en 33.34 + 33.33 + 33.33 y saldos que no descuentan pagos pendientes. El mensaje recibido tiene `multipart/alternative`, HTML y texto; transporte TLS 1.3. Esto no acredita el renderizado en la aplicación Outlook.
- QA local con SMTP capturado: registro, reenvío/cooldown, bienvenida, recuperación, expiración, uso único, cinco intentos, revocación de sesiones, inexistencia de cuenta y rechazo del proveedor pasaron. Integración de resúmenes: permisos, validación, idempotencia, concurrencia, límite de envíos, estado incierto y no reenvío automático pasaron. Nueve pruebas de plantillas/transporte local y compilación API correctas. Los códigos válidos solo se usaron en una base local ficticia, no en las cuentas de los destinatarios reales.
- Los 63 tests de dominio de API también pasaron. Se leyeron las seis muestras recibidas por el propietario: Message-ID coincide con la aceptación SMTP y las dos partes MIME incluyen el aviso de prueba. No se observó un rebote del lote en la comprobación puntual; eso no garantiza que no ocurra después ni acredita lectura del destinatario.

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

1. SMTP y seis plantillas comprobados en Gmail; controladores OTP/resúmenes probados con SMTP local capturado. Falta validar esos flujos desde la app distribuida contra producción y confirmar recepción por la segunda persona. Hace falta un destinatario Outlook autorizado para acreditar entrega/renderizado allí. No repetir mensajes de prueba automáticamente.
2. Configurar el proyecto EAS, firma Android, cliente OAuth compatible, FCM y App Links. Ajustar la API pública a `https://junto.lunalav.pe` al compilar; no distribuir el build local con `10.0.2.2`.
3. Probar la APK en dispositivos externos reales con datos ficticios, incluyendo invitaciones, cuentas, confirmaciones y envío de resumen. El SMTP disponible no acredita recepción ni lectura.
4. Implementar y verificar una versión web si se elige esa vía para iPhone sin membresía Apple Developer. El host HTTPS existente sirve de base, pero aún no ofrece ese cliente.
5. Configurar responsable legal real, monitoreo y copias externas cifradas/automáticas con restauración periódica. No se instaló una tarea automática de backup en esta validación.

FCM v1 y el proyecto EAS siguen siendo necesarios para notificaciones reales en Android. La API comprueba tickets y recibos de Expo y elimina metadatos tras 24 horas; eso no prueba que alguien haya leído un aviso.

## Pendientes específicos del correo

- Los envíos de cuenta (especialmente bienvenida y recuperación) no tienen una cola persistente
  de entrega/reintentos. Registrar fallos sin OTP y diseñar reintentos con caducidad e idempotencia
  antes de depender de ese canal a escala. La respuesta de recuperación sigue siendo genérica:
  no revela cuentas ni asegura recepción. No se cambiaron estas políticas al enviar las muestras.
- El botón de bienvenida apunta al sitio HTTPS público, que aún es una página beta, no un cliente
  web funcional. Resolver el destino de instalación/apertura antes de invitar usuarios finales.
- Confirmar maquetación en Outlook y pantallas móviles reales, y recepción por la segunda persona.
  Gmail SMTP sirve para la beta, pero requiere controlar sus cuotas y rebotes. Un remitente de
  dominio propio/proveedor transaccional necesita configuración separada; no inventar un From
  ni alterar MX/SPF del dominio como si eso habilitara Gmail.
