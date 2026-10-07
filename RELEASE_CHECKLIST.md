# JUNTO — controles previos a publicación

## Resuelto en código (verificable en este repositorio)

| Tema | Qué hay ahora | Cómo comprobarlo |
| --- | --- | --- |
| Invitaciones fuera de la app | Se comparte `https://<dominio>/unirse/CODE`. La API sirve esa página: abre la app si está instalada y si no lleva a Google Play. `app.config.js` declara App Links (`autoVerify`) para ese dominio y la API publica `/.well-known/assetlinks.json`. En la app, «+» → «Unirme con un enlace» acepta el enlace o el código pegado. | `node ops/test-release-config.cjs`, `node ops/test-mobile-ux.cjs` |
| Correo | Resend (`RESEND_API_KEY`) o SMTP con TLS obligatorio. Sin proveedor en desarrollo, los códigos salen en consola pero `emailDelivery` es falso y reenviar muestra error; en producción la entrega falla. `/health` informa la configuración, no acredita recepción. | `node --test ops/test-email.cjs`; `npm run build && npm run email:test -- tu@correo.com` (en `apps/api`) |
| Compartir cuentas | Vista previa con nombres reales y céntimos exactos, WhatsApp, Gmail/Outlook, menú nativo y copiar texto. Los pagos pendientes no descuentan la deuda. No se afirma entrega ni se envía automáticamente. | `node --test ops/test-sharing.cjs`; probar entrega real en dos teléfonos |
| Eliminar cuenta | `DELETE /api/auth/me` con contraseña: anonimiza a la persona, borra datos personales, cuentas de un día, recordatorios y sesiones; pasa la administración del grupo; cancela pagos que esperaban su confirmación. Los gastos compartidos quedan como «Usuario eliminado» y los saldos de los demás no cambian. Flujo en Perfil → Eliminar mi cuenta, con resumen previo. Página web `/eliminar-cuenta` para Play Store. | `ops/test-account-deletion.cjs` (corre en CI con Postgres) |
| Migraciones | `prisma/migrations` versionado, `prisma migrate deploy` en CI y verificación de que el schema no se desfase. | Job `database` de CI; `apps/api/prisma/MIGRATIONS.md` |
| Errores | Sentry opcional en la API (`SENTRY_DSN`, sin cuerpos ni cabeceras). La app muestra una pantalla «Algo salió mal» con Reintentar en lugar de quedar en blanco. | — |
| Privacidad | Página `/privacidad` con los datos que realmente se usan. | Revisar el texto con quien sea responsable legal |
| UX | Inicio con «Pendientes» (confirmar pagos, pagar, recordar), un solo botón «+», «Tú» siempre visible y primero, nombres repetidos distinguidos, avatares de iniciales con color por persona, detalle de grupo con frase de estado, formulario de gasto con el monto primero, actividad en segunda persona, texto legal en «¿Cómo funciona?», nombre opcional en cuentas de un día, aviso sin conexión. La pestaña Asistente sale de la barra (sigue en Perfil → Ayuda y en «Agregar gasto»). | `node ops/test-mobile-ux.cjs` |

| Continuar con Google | Botón en la bienvenida, el login y el registro (`@react-native-google-signin/google-signin`). La API verifica el token con `google-auth-library` (firma, vencimiento, emisor y audiencia), crea la cuenta o la vincula por correo. Si el correo existía pero nunca se verificó, la contraseña anterior se anula: Google demostró quién es el dueño del correo. Un correo ya vinculado a otra cuenta de Google no se puede tomar. Las cuentas solo-Google se eliminan escribiendo ELIMINAR. | `ops/test-google-sign-in.cjs` (corre en CI), `src/domain/googleAccount.test.ts` |
| Primer contacto | Ficha de Play Store lista para pegar (`store/google-play.md`: nombre con palabras clave, descripciones, orden de capturas, Data Safety). Bienvenida con los botones siempre visibles y «Probar sin cuenta»: una calculadora que divide la cuenta al instante sin registrarse ni guardar nada. Registro sin «confirmar contraseña», verificación que entra sola al escribir los 6 dígitos. | Recorrido automatizado en navegador (ver abajo) |

| Correo desde la API | «Enviar desde JUNTO»: contenido armado en el servidor con autorización por recurso, huella de lo revisado, idempotencia, límites en base de datos, estados aceptado/fallido/incierto, Reply-To de quien comparte, sin imágenes remotas ni seguimiento. Sin proveedor: 503 y la app ofrece Gmail/Outlook. | `ops/test-share-email-api.cjs` (receptor SMTP local, en CI) |
| Precisión | Escenarios A–E automatizados; gastos idempotentes (`solicitud_id`); aportes «recibí ahora» con acumulado calculado y corrección separada; el resumen del grupo cuenta todos sus pagos por confirmar. | `ops/test-money-scenarios.cjs`, `ops/test-expense-idempotency.cjs` |
| Logs | Errores registrados por tipo/código/estado; nunca el objeto de Axios (con la API key y el OTP). Sin proveedor no se imprime el correo salvo `EMAIL_DEV_LOG=true`. | `apps/api/src/domain/logSafe.test.ts` |
| Pagos heredados | Retirados el webhook y el cobro con Culqi, que no estaban habilitados. | — |
| Comprobantes de pago | Captura de Yape/Plin/transferencia leída por OCR local; propone monto, app, operación, destinatario, fecha y código de seguridad; bloquea comprobantes ya usados; imagen visible solo para pagador, receptor y administradores que aprueban; borradores borrados a las 24 h e imágenes a los 180 días. | `apps/api/src/domain/voucher.test.ts`, `ops/test-vouchers-comments.cjs` (en CI) |
| Aprobación por administrador | Ajuste por grupo: aprueba solo quien recibe o también la administración; nunca quien pagó; «No me llegó» para quien recibe. Grupos existentes quedan en «solo quien recibe». | `ops/test-vouchers-comments.cjs`, `ops/e2e-vouchers.cjs` |
| Comentarios | En gastos y pagos, solo para integrantes activos, 500 caracteres, límite de 30 cada 10 minutos, sin duplicados por doble toque, eliminar (autor o administración) y reportar. | `ops/test-vouchers-comments.cjs` |
| Compartir a JUNTO (Android) | `expo-share-intent` 5.1.1 (SDK 54) solo para imágenes; iOS desactivado. `expo prebuild` genera el filtro `SEND image/*` junto a los App Links. | Prebuild local; falta probar en una build EAS |

## Necesita al propietario (no se puede hacer desde el código)

1. **Dominio**: apuntar `junto.pe` (o el que elijas) a la API y configurar `PUBLIC_WEB_URL` en la API y `EXPO_PUBLIC_WEB_URL` en EAS. Sin dominio, se usa la URL https de la API.
2. **Firma Android**: copiar la huella SHA-256 del certificado de firma de Play Console (Integridad de la app) a `ANDROID_SHA256_CERT_FINGERPRINTS`. Comprobar con `https://<dominio>/.well-known/assetlinks.json` y, tras instalar, `adb shell pm get-app-links com.junto.app`.
3. **Correo**: crear la cuenta en Resend o SES, verificar el dominio (SPF, DKIM, DMARC), poner `RESEND_API_KEY`/`EMAIL_FROM` y enviar `email:test` a Gmail y Outlook revisando spam.
4. **Base de producción**: respaldo y línea base única según `apps/api/prisma/MIGRATIONS.md`; luego `npm run start:migrate` como comando de inicio.
5. **EAS y notificaciones**: `eas init` (da `EAS_PROJECT_ID`), proyecto Firebase con app Android `com.junto.app`, subir `google-services.json` como secreto de archivo `GOOGLE_SERVICES_JSON` y las credenciales FCM v1 en expo.dev.
6. **Sentry**: crear proyecto y poner `SENTRY_DSN` en la API. (Para la app se puede añadir `@sentry/react-native` cuando haya una build EAS donde probarlo.)
7. **Legal y soporte**: `LEGAL_OWNER` (responsable del tratamiento), `SUPPORT_EMAIL`/`EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_PRIVACY_URL=https://<dominio>/privacidad` y `EXPO_PUBLIC_DELETE_ACCOUNT_URL=https://<dominio>/eliminar-cuenta`. Completar Data Safety en Play Console según `/privacidad`.
8. **Continuar con Google** (en Google Cloud Console, con la cuenta del proyecto):
   1. *Google Auth Platform*: tipo Externo, nombre «JUNTO», correo de soporte, dominio y `https://<dominio>/privacidad`. Revisar los requisitos que muestre Google antes de publicar; el acceso solicitado es solo nombre, correo y foto, no Gmail. En modo Prueba, agregar únicamente los testers autorizados.
   2. *Credenciales → Crear ID de cliente → Aplicación web*. Ese ID va en `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (variables de EAS) y en `GOOGLE_CLIENT_IDS` (API).
   3. *Crear ID de cliente → Android*, paquete `com.junto.app`, uno por cada certificado: la huella SHA-1 de «Firma de apps de Google Play» (Play Console → Integridad de la app) y la de las builds de prueba (`eas credentials`). No hay que copiar estos IDs a ningún lado, pero sin ellos Google responde DEVELOPER_ERROR.
   4. Probar en una build EAS (en Expo Go el botón avisa que funciona en la app instalada).
9. **Comentarios y comprobantes (políticas de Play)**: los comentarios son contenido generado por usuarios. Antes de publicar: reglas de uso que digan qué no se permite (y que se acepten), un responsable que revise la tabla `reportes_comentarios` (la API solo registra el id en el log) y un plazo de respuesta. En Data Safety declarar «Fotos» (comprobantes, para la funcionalidad de la app, no compartidas) y «Otro contenido generado por usuarios» (comentarios). Si se pide bloquear a una persona, hoy se resuelve sacándola del grupo; no hay bloqueo individual.
10. **Asistente IA**: configurar `JUNTO_AI_BASE_URL`/`JUNTO_AI_API_KEY` en producción antes de volver a mostrarlo como pestaña. Sin él, las frases simples («Pagué 120 por la cena con Ana») siguen funcionando con reglas locales.

## Pruebas pendientes en dispositivos y servicios reales

Estos recorridos no quedan acreditados por las pruebas cloud ni por el arranque local en emulador. Ver `ops/QA-2026-10-07-sync.md` para la validación posterior. Cada punto indica qué confirmar en dispositivos y servicios reales:

1. **Correo desde la API con proveedor real** (Resend o SES con dominio verificado): enviar un resumen de cuenta de un día, uno de grupo y uno de gasto a Gmail y a Outlook. Confirmar bandeja/spam, que tablas y colores se ven bien en web y en las apps móviles de Gmail/Outlook, que «Responder» va a quien compartió y que el texto alternativo se lee completo. Revisar el panel del proveedor: el estado «aceptado» de JUNTO debe coincidir con «sent/delivered» del proveedor.
2. **Correo abierto en la app del teléfono (Android)**: la imagen adjunta del resumen sigue disponible si se guarda el borrador, se cierra JUNTO y se vuelve a abrir Gmail más tarde. Probar con un reparto de 30 personas (captura larga) en un teléfono de gama baja.
3. **Continuar con Google** en una build EAS con la huella registrada: primer ingreso, cuenta existente con el mismo correo, cancelar el selector y cerrar sesión.
4. **WhatsApp**: abrir con el texto, elegir chat, cancelar; teléfono sin WhatsApp.
5. **Teclado y navegación Android**: formulario de gasto y de correo con teclado abierto, botón atrás del sistema en el asistente de cuenta de un día (debe retroceder un paso, no salir) y en los modales.
6. **Lector de boletas** con 10 boletas reales (térmicas, arrugadas, con propina incluida) y una foto que no sea boleta: siempre debe pedir revisión y nunca perder el total escrito a mano.
7. **TalkBack y letra grande** en Inicio, «+», probar sin cuenta (interruptor «Paga/Invitado»), aporte de una persona y correo.
8. **Sin conexión**: guardar un gasto en modo avión y al volver la señal tocar Guardar de nuevo (debe quedar uno solo, como en la prueba web).
9. **Notificaciones** con FCM: pago reportado, confirmado y recordatorio; comentario nuevo; pago por revisar (administración) y «aprobaron un pago para ti». Tocar cada una debe abrir el pago o el gasto exacto.
10. **Comprobantes reales**: capturas de Yape (con y sin modo oscuro), Plin desde BCP, Interbank, BBVA y Scotiabank, y una transferencia. Anotar qué campos lee bien y cuáles no; nunca debe registrar sin revisión ni bloquear si no lee nada (se escribe el monto a mano).
11. **«Compartir → JUNTO»** en una build EAS: desde WhatsApp (imagen recibida), desde la app de Yape (botón compartir del comprobante) y desde la galería; con la app cerrada y abierta; sin sesión iniciada (debe pedir login y luego seguir). Una captura de más de 3 MB debe pedir elegirla desde la galería.
12. **Cámara y galería**: «Tomar foto» de un comprobante impreso, permiso denegado, y captura larga de un teléfono de gama baja (compresión a JPEG).
13. **Aprobación en dos o tres teléfonos**: administrador que no es parte del pago aprueba; quien recibe marca «No me llegó»; dos personas aprueban a la vez (solo una decisión queda).
14. **Dependencias y seguridad**: revisar los avisos de `npm audit`, distinguir herramientas de desarrollo de código distribuido y corregir o documentar el alcance de cada aviso antes de publicar. No actualizar Expo/React Native ni forzar cambios incompatibles sin volver a compilar y probar los flujos nativos.

## Probar en dispositivos antes de la prueba cerrada

El recorrido de usuario nuevo (bienvenida → probar sin cuenta → registro → verificación → crear grupo → invitar → gasto → pendientes → pagar → cuenta de un día → perfil) se revisó con capturas en un navegador del tamaño de un teléfono. Eso no reemplaza un teléfono real:

- Dos teléfonos reales: invitación por WhatsApp (con y sin la app instalada), registro con correo real, gasto, pago parcial, confirmación desde Inicio, eliminación de cuenta.
- TalkBack: recorrer Inicio, «+», detalle de grupo, agregar gasto y confirmar un pago solo con gestos.
- Letra grande (Ajustes → Tamaño de fuente al máximo): ningún texto cortado en Inicio, grupo y formulario.
- Modo avión: aparece el aviso «Sin conexión», los datos cargados siguen visibles y guardar muestra error sin perder lo escrito.
- Prueba cerrada en Play Console con los testers que exija la cuenta.

Guías oficiales: https://support.google.com/googleplay/android-developer/answer/13327111 (eliminar cuenta), https://support.google.com/googleplay/android-developer/answer/10787469 (Data Safety), https://developer.android.com/training/app-links/verify-android-applinks (App Links).
