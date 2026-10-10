# Beta Android e invitaciones — 10 de octubre de 2026

## Cambios

- Abrir WhatsApp directamente, sin depender de `canOpenURL`/visibilidad de paquetes.
- Espera de apertura limitada a ocho segundos; error claro sin mensajes técnicos.
- Si WhatsApp falla, el enlace preparado sigue disponible para correo/copia.
- Preparación visible, compuertas compartidas y botones bloqueados durante solicitudes.
- Compartir/correo/imagen cambian contenido dentro de una única ventana nativa.
- Solo fallos de compartir deliberadamente seguros conservan su mensaje de recuperación.
- Compilación Windows release: raíz Metro móvil con dependencias hoisted visibles.
- APK de beta con Hermes/recursos incluidos; `BuildConfig.DEBUG=false`.

## Artefacto

- `https://junto.lunalav.pe/app/descargas/JUNTO-beta-20261010.apk`
- Local: `ops/artifacts/JUNTO-beta-20261010.apk` (ignorado por Git).
- 75,032,067 bytes; SHA-256:
  `0A51170A6E542F5A55E9FECE94EC979B6B4A8C46938AE89108D8AA565D7CE036`.
- Paquete `com.junto.app`, versión 1.0.0/código 1, Android 7+, ARM64/x86_64.
- Firma v2 válida, certificado **JUNTO Local QA**, no clave definitiva de Play Store.
- Bundle Hermes 3,671,364 bytes. Su mapa confirma que los tres archivos modificados
  de invitaciones/compartir coinciden con la fuente actual. No se publica el mapa.
- API/web/legales HTTPS; sin dotenv privado. Google login no se anuncia en este APK:
  usar registro/login/recuperación por correo. No necesita Metro ni Expo Go.

## Pruebas y publicación

Typecheck y lint pasan. 40 pruebas de compartir, fallos/límite de espera,
validaciones, cálculos, UI y configuración release; dos pruebas del servidor SPA/APK.
Recorridos locales Chromium móvil y WebKit PC: registro/OTP, login/logout,
recuperación, invitación SMTP loopback, borrador WhatsApp interceptado, seis anchos,
S/ 500 frente a S/ 380 y corrección del reparto. Sin correo real a amigos.

Web publicada `junto-web:20261010-beta4`; API conserva
`junto-api:20261010-beta2`. Solo se añadió el certificado público de esta beta a
`ANDROID_SHA256_CERT_FINGERPRINTS`; copia privada de rollback de runtime.env,
permisos 600 conservados. Se recrearon únicamente la API y la web de JUNTO.
DB, SMTP, otras aplicaciones, DNS y TLS sin cambios. Web beta3 retenida para rollback.

La descarga completa HTTPS responde 200, MIME Android y disposición attachment;
SHA-256 idéntico al APK local. `/ready` y `/.well-known/assetlinks.json` funcionan;
la huella pública coincide con el certificado verificado del APK. Registrar la huella
definitiva/revisar la de QA cuando se publique en Play Store.

Pruebas HTTPS reales Chromium/WebKit reutilizando exclusivamente la cuenta QA ya
autorizada: login/logout, seis anchos, grupo y preparación de correo pasan. No envían
correos ni crean nuevos registros financieros reales.

## Límites

No se completó la comprobación visual nativa: el usuario interrumpió Computer Use
con Escape. No se instaló ni se borraron datos del emulador después de ello.
El reporte del cuelgue se abordó simplificando ventanas y aislando fallos externos,
pero queda pendiente confirmar el recorrido en un celular físico con WhatsApp.
El envío SMTP local no equivale a entrega en el buzón del destinatario.
Es beta interna, no una certificación de ausencia de fallos ni publicación en tiendas.
