# Beta HTTPS JUNTO — 10 de octubre de 2026

Disponible: https://junto.lunalav.pe/app/ (iPhone y Android en navegador).
Fuente funcional desplegada: `f5e7a7d`, imágenes `junto-api:20261010-beta2` y
`junto-web:20261010-beta2`. Base privada y otros servicios sin recrear.
Respaldo PostgreSQL verificado antes de actualizar; imágenes y configuración
anteriores conservadas. Caddy validado y recargado, sin cambio de DNS/MX/TLS global.

## Comprobado

- API build, typecheck y lint móvil pasan.
- SMTP capturado localmente: registro, vencimiento/uso único de códigos,
  recuperación y sesiones; invitaciones, permisos, HTML escapado, límites,
  deduplicación y entrega incierta. No se envió a terceros desde las pruebas locales.
- Bundle de producción probado contra API local en Chromium/WebKit, viewport móvil:
  registro, código, login/logout/recarga, crear grupo, email precargado, confirmación,
  invitación SMTP y borrador WhatsApp capturado sin petición externa.
- Regresión de invitación inmediata: se retrasó cinco segundos la consulta del
  grupo. El nombre del enlace viene ahora de su respuesta autorizada, no del caché.
- Prueba real autorizada, un único alias del buzón del propietario:
  registro desde web; código recibido en Inbox; verificación por API; bienvenida
  recibida; login/logout/recarga; recuperación solicitada desde web y recibida;
  contraseña actualizada por API; refresh anterior rechazado; login con la nueva.
- Invitación desde el campo de contacto y confirmación web: SMTP aceptada y mensaje
  comprobado en Inbox, con HTML visual y alternativa de texto. Ningún amigo contactado.
- Enlace del correo → página pública → beta → login → revisión explícita → grupo,
  en Chromium y WebKit. Prueba con la cuenta QA ya integrante: no demuestra aún
  adhesión de una segunda persona física; la adhesión/consentimiento tiene pruebas API locales.
- Caso original de S/ 500: S/ 380 asignados muestra S/ 120 faltantes y bloquea avance;
  corregir a S/ 500 permite guardar y recargar una cuenta ficticia.
- `/ready`, autenticación de rutas privadas, JSON inválido, CORS y páginas legales.
- Auditoría de dependencias físicamente incluidas en la imagen API: cero avisos.
  No equivale a auditoría de Expo, Android, sistema operativo ni prueba de penetración.
- Contenedores API/web saludables; sin puertos publicados de API, web ni PostgreSQL;
  archivos privados de entorno modo 600. Secretos fuera de Git y export web.

## Límites explícitos

- Es beta web, no una app TestFlight ni un AAB listo para Play Store.
- Pendiente prueba en iPhone y Android físicos, particularmente teclado, cámara,
  lectura de boletas reales y retorno desde WhatsApp.
- WhatsApp abre un borrador; el usuario pulsa enviar. No confirma entrega ni manda SMS.
- «Avisar solo dentro de JUNTO» no manda correo. «Preparar» con correo abre el email
  precargado; «Enviar desde JUNTO» pide confirmación y lo envía por SMTP.
- Gmail recibido no demuestra recepción en Outlook ni ausencia de filtros de spam.
- Requiere internet; sin push nativo, Google login ni caché financiero offline en web.
- El acceso anónimo con alias no existe. Acceso ligero con correo verificado y sin
  contraseña requiere diseñar e implementar su propia autorización/recuperación.
- DeepSeek no activado en producción; no nuevas llamadas ni coste recurrente.
  Gateway local antiguo no acepta contrato v2: la API lo detecta y ofrece flujo manual.

Las credenciales y capturas QA viven solo en `ops/artifacts/` ignorado; los scripts
de producción requieren activación explícita y bloquean repetir envíos ya registrados.
