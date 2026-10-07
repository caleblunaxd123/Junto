# JUNTO — controles previos a publicación

## Resuelto en código (verificable en este repositorio)

| Tema | Qué hay ahora | Cómo comprobarlo |
| --- | --- | --- |
| Invitaciones fuera de la app | Se comparte `https://<dominio>/unirse/CODE`. La API sirve esa página: abre la app si está instalada y si no lleva a Google Play. `app.config.js` declara App Links (`autoVerify`) para ese dominio y la API publica `/.well-known/assetlinks.json`. En la app, «+» → «Unirme con un enlace» acepta el enlace o el código pegado. | `node ops/test-release-config.cjs`, `node ops/test-mobile-ux.cjs` |
| Correo | Resend (`RESEND_API_KEY`) o SMTP (Amazon SES u otro). Sin proveedor en desarrollo, los códigos salen en la consola; en producción la API avisa al arrancar y `/health` muestra `email`. | `npm run build && npm run email:test -- tu@correo.com` (en `apps/api`) |
| Eliminar cuenta | `DELETE /api/auth/me` con contraseña: anonimiza a la persona, borra datos personales, cuentas de un día, recordatorios y sesiones; pasa la administración del grupo; cancela pagos que esperaban su confirmación. Los gastos compartidos quedan como «Usuario eliminado» y los saldos de los demás no cambian. Flujo en Perfil → Eliminar mi cuenta, con resumen previo. Página web `/eliminar-cuenta` para Play Store. | `ops/test-account-deletion.cjs` (corre en CI con Postgres) |
| Migraciones | `prisma/migrations` versionado, `prisma migrate deploy` en CI y verificación de que el schema no se desfase. | Job `database` de CI; `apps/api/prisma/MIGRATIONS.md` |
| Errores | Sentry opcional en la API (`SENTRY_DSN`, sin cuerpos ni cabeceras). La app muestra una pantalla «Algo salió mal» con Reintentar en lugar de quedar en blanco. | — |
| Privacidad | Página `/privacidad` con los datos que realmente se usan. | Revisar el texto con quien sea responsable legal |
| UX | Inicio con «Pendientes» (confirmar pagos, pagar, recordar), un solo botón «+», «Tú» siempre visible y primero, nombres repetidos distinguidos, avatares de iniciales con color por persona, detalle de grupo con frase de estado, formulario de gasto con el monto primero, actividad en segunda persona, texto legal en «¿Cómo funciona?», nombre opcional en cuentas de un día, aviso sin conexión. La pestaña Asistente sale de la barra (sigue en Perfil → Ayuda y en «Agregar gasto»). | `node ops/test-mobile-ux.cjs` |

| Continuar con Google | Botón en la bienvenida, el login y el registro (`@react-native-google-signin/google-signin`). La API verifica el token con `google-auth-library` (firma, vencimiento, emisor y audiencia), crea la cuenta o la vincula por correo. Si el correo existía pero nunca se verificó, la contraseña anterior se anula: Google demostró quién es el dueño del correo. Un correo ya vinculado a otra cuenta de Google no se puede tomar. Las cuentas solo-Google se eliminan escribiendo ELIMINAR. | `ops/test-google-sign-in.cjs` (corre en CI), `src/domain/googleAccount.test.ts` |
| Primer contacto | Ficha de Play Store lista para pegar (`store/google-play.md`: nombre con palabras clave, descripciones, orden de capturas, Data Safety). Bienvenida con los botones siempre visibles y «Probar sin cuenta»: una calculadora que divide la cuenta al instante sin registrarse ni guardar nada. Registro sin «confirmar contraseña», verificación que entra sola al escribir los 6 dígitos. | Recorrido automatizado en navegador (ver abajo) |

## Necesita al propietario (no se puede hacer desde el código)

1. **Dominio**: apuntar `junto.pe` (o el que elijas) a la API y configurar `PUBLIC_WEB_URL` en la API y `EXPO_PUBLIC_WEB_URL` en EAS. Sin dominio, se usa la URL https de la API.
2. **Firma Android**: copiar la huella SHA-256 del certificado de firma de Play Console (Integridad de la app) a `ANDROID_SHA256_CERT_FINGERPRINTS`. Comprobar con `https://<dominio>/.well-known/assetlinks.json` y, tras instalar, `adb shell pm get-app-links com.junto.app`.
3. **Correo**: crear la cuenta en Resend o SES, verificar el dominio (SPF, DKIM, DMARC), poner `RESEND_API_KEY`/`EMAIL_FROM` y enviar `email:test` a Gmail y Outlook revisando spam.
4. **Base de producción**: respaldo y línea base única según `apps/api/prisma/MIGRATIONS.md`; luego `npm run start:migrate` como comando de inicio.
5. **EAS y notificaciones**: `eas init` (da `EAS_PROJECT_ID`), proyecto Firebase con app Android `com.junto.app`, subir `google-services.json` como secreto de archivo `GOOGLE_SERVICES_JSON` y las credenciales FCM v1 en expo.dev.
6. **Sentry**: crear proyecto y poner `SENTRY_DSN` en la API. (Para la app se puede añadir `@sentry/react-native` cuando haya una build EAS donde probarlo.)
7. **Legal y soporte**: `LEGAL_OWNER` (responsable del tratamiento), `SUPPORT_EMAIL`/`EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_PRIVACY_URL=https://<dominio>/privacidad` y `EXPO_PUBLIC_DELETE_ACCOUNT_URL=https://<dominio>/eliminar-cuenta`. Completar Data Safety en Play Console según `/privacidad`.
8. **Continuar con Google** (en Google Cloud Console, con la cuenta del proyecto):
   1. *APIs y servicios → Pantalla de consentimiento OAuth*: tipo Externo, nombre «JUNTO», logo, correo de soporte, dominio y `https://<dominio>/privacidad`. Publicarla (sin verificación extra: solo se piden nombre, correo y foto).
   2. *Credenciales → Crear ID de cliente → Aplicación web*. Ese ID va en `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (variables de EAS) y en `GOOGLE_CLIENT_IDS` (API).
   3. *Crear ID de cliente → Android*, paquete `com.junto.app`, uno por cada certificado: la huella SHA-1 de «Firma de apps de Google Play» (Play Console → Integridad de la app) y la de las builds de prueba (`eas credentials`). No hay que copiar estos IDs a ningún lado, pero sin ellos Google responde DEVELOPER_ERROR.
   4. Probar en una build EAS (en Expo Go el botón avisa que funciona en la app instalada).
9. **Asistente IA**: configurar `JUNTO_AI_BASE_URL`/`JUNTO_AI_API_KEY` en producción antes de volver a mostrarlo como pestaña. Sin él, las frases simples («Pagué 120 por la cena con Ana») siguen funcionando con reglas locales.

## Probar en dispositivos antes de la prueba cerrada

El recorrido de usuario nuevo (bienvenida → probar sin cuenta → registro → verificación → crear grupo → invitar → gasto → pendientes → pagar → cuenta de un día → perfil) se revisó con capturas en un navegador del tamaño de un teléfono. Eso no reemplaza un teléfono real:

- Dos teléfonos reales: invitación por WhatsApp (con y sin la app instalada), registro con correo real, gasto, pago parcial, confirmación desde Inicio, eliminación de cuenta.
- TalkBack: recorrer Inicio, «+», detalle de grupo, agregar gasto y confirmar un pago solo con gestos.
- Letra grande (Ajustes → Tamaño de fuente al máximo): ningún texto cortado en Inicio, grupo y formulario.
- Modo avión: aparece el aviso «Sin conexión», los datos cargados siguen visibles y guardar muestra error sin perder lo escrito.
- Prueba cerrada en Play Console con los testers que exija la cuenta.

Guías oficiales: https://support.google.com/googleplay/android-developer/answer/13327111 (eliminar cuenta), https://support.google.com/googleplay/android-developer/answer/10787469 (Data Safety), https://developer.android.com/training/app-links/verify-android-applinks (App Links).
