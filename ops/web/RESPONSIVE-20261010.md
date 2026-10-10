# JUNTO web — escritorio y responsive, 10 de octubre de 2026

## Cambios

- Bienvenida de PC en dos columnas, ilustración existente y tres pasos visuales.
- Login/registro con formulario de ancho acotado y presentación lateral.
- Nombre → correo → contraseña con teclado; Enter envía login/registro y recuperación.
- El primer campo inválido de acceso recibe el foco; privacidad visible antes de crear cuenta.
- Navegación lateral web desde 1024 px, enlaces reales y acceso a cuentas/grupos/perfil.
- Navegador de rutas estable: redimensionar no desmonta la sesión ni los formularios.
- Inicio de PC separa grupos y cuentas de un día; adapta los mensajes a sus botones reales.
- Pantallas/formularios y botones inferiores acotados; detalle del grupo de ancho máximo.
- Correo, compartir, aportes, menú del grupo y selector de gastos centrados en pantallas grandes.
- Foco de teclado visible. La navegación nativa y la barra inferior móvil se conservan.

## Pruebas locales

`ops/test-web-beta.cjs` usa el export de producción y API/PostgreSQL QA local con
SMTP loopback. Bloquea cualquier origen externo salvo borrador WhatsApp interceptado.
No se usan correos, claves SMTP ni cuentas de amigos reales.

Recorrido Chromium a 1440 px y WebKit a 390 px; cada uno también redimensiona a
360, 390, 768, 1024, 1440 y 1920. Comprueba ancho de campos, ausencia de overflow
de documento, cambio de navegación y conservación de sesión. Incluye registro
inválido/válido, OTP, crear grupo, invitación SMTP con contacto precargado, teléfono
WhatsApp, logout/login con Enter, recarga, recuperación con confirmación incorrecta
y correcta, login con nueva contraseña y grupo/menú. S/ 500 frente a S/ 380 muestra
S/ 120 faltantes y bloquea el reparto; corregir a S/ 500 lo habilita.

Typecheck y lint móvil, 35 pruebas de UI/cálculos/compartir y prueba del servidor
SPA pasan. Las capturas locales quedan en `ops/artifacts/`, ignorado por Git.

## Publicación y límites

Esta ronda no requiere migraciones ni cambios de API, SMTP, DNS o TLS. Conservar
la imagen web anterior para rollback. `ops/test-production-responsive.cjs` usa
exclusivamente la cuenta QA ficticia ya autorizada, no envía correos y no crea
grupos/cuentas/repartos reales.

No es prueba física en iPhone/Android ni auditoría completa de accesibilidad o
seguridad. Las limitaciones documentadas de beta siguen vigentes: internet,
registro/correo verificado para grupos, sin invitado anónimo, sin Google login/push
nativo en web. Publicar en tiendas no sustituye este hosting ni desactiva la web;
API y base comunes mantienen los mismos datos en todos los clientes.
