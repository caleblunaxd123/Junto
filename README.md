# Junto — Divide gastos, cobra sin incomodidad

App móvil de gestión financiera grupal para el mercado peruano y latinoamericano.

## Stack

- **Mobile**: React Native + Expo SDK 54 (Expo Router, Zustand, React Query)
- **Backend**: Node.js + Express + TypeScript
- **DB**: PostgreSQL 16 (via Docker) + Prisma ORM
- **Auth**: JWT (access 15min + refresh 30d)
- **Pagos**: registro de pagos externos. JUNTO no cobra, custodia ni transfiere dinero; no detecta Yape/Plin automáticamente.
- **Notificaciones**: Firebase Cloud Messaging + Expo Notifications

## Inicio rápido

### Prerrequisitos
- Node.js >= 20
- Docker Desktop
- Expo Go app en tu celular

### Setup

```bash
# 1. Clonar el repo
git clone https://github.com/caleblunaxd123/Junto
cd Junto

# 2. Levantar PostgreSQL
docker compose up -d

# 3. Instalar dependencias
npm install

# 4. Configurar variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
# Editar los .env con tus credenciales

# 5. Aplicar migraciones (versionadas en apps/api/prisma/migrations)
npm run db:deploy        # para crear una nueva: npm run db:migrate

# 6. Iniciar backend
npm run dev:api

# 7. Iniciar mobile (en otra terminal)
npm run dev:mobile
```

## Estructura

```
junto/
├── apps/
│   ├── mobile/          # React Native + Expo
│   └── api/             # Node.js + Express
├── packages/
│   └── shared/          # Tipos TypeScript compartidos
├── docker-compose.yml
└── PROGRESS.md
```

## Features MVP

1. **Auth** — Registro, login, OTP para recuperar contraseña
2. **Grupos** — Crear grupos, invitar por enlace o por correo/celular, calcular saldos. Invitar por correo o celular no agrega a nadie: la persona ve la invitación en su Inicio y decide; la respuesta al invitar es la misma tenga o no cuenta, y nunca revela su nombre.
3. **Gastos** — Registrar gastos, dividir en partes iguales/exactas/porcentajes
4. **Cuentas puntuales** — Total manual o foto revisada, nombres sin registro, invitados, reparto exacto en céntimos, aportes parciales, historial, archivo y exportación de texto/imagen.
5. **Pagos con comprobante** — Cada integrante sube la captura de su Yape, Plin o transferencia; JUNTO la lee (monto, app, operación, destinatario, fecha) y la registra como su pago. Lo aprueba quien recibe o, si el grupo lo permite, la administración. No hay cobro automático ni conexión bancaria.
6. **Comentarios** — En cada gasto y pago, visibles para el grupo, con eliminar y reportar.

## Validación y estado de publicación

`npm run test --workspace=apps/api`, `node ops/test-mobile-ux.cjs`, `node ops/test-hardening.cjs` (con la API local en 3005), `node ops/test-release-config.cjs`, `npm run build:api`, `npm run typecheck --workspace=apps/mobile` y `npm run lint --workspace=apps/mobile`.

La base local de QA usa localhost:5433. `ops/apply-quick-bills-local.cjs` aplica únicamente migraciones aditivas locales y conserva los registros existentes. Los scripts `ops/test-*.cjs` de integración crean datos ficticios; no envían pagos ni mensajes. Las migraciones de producción deben revisarse y aplicarse con copia de seguridad, no con un reset.

El borrador de cuenta puntual se conserva por usuario en almacenamiento privado de la app; no incluye fotos ni credenciales y no tiene cifrado adicional. El cálculo manual funciona sin red; guardar en servidor necesita conexión. Un guardado incierto conserva la solicitud inmutable y su identificador para reintentar sin duplicar. No se hacen envíos automáticos en segundo plano.

`apps/mobile/eas.json` prepara APK interno y AAB de producción. La configuración bloquea distribuciones sin API HTTPS, privacidad, canal de eliminación y correo de soporte. Tener esas variables no demuestra que sus páginas o procesos funcionen: deben verificarse antes de publicar.

La API también sirve la web pública: `/unirse/:code` (invitaciones con App Links y Google Play), `/privacidad`, `/eliminar-cuenta` y `/.well-known/assetlinks.json`. Las migraciones y su línea base para la base existente están explicadas en `apps/api/prisma/MIGRATIONS.md`.

Lo que falta depende de cuentas y datos del propietario (dominio, correo, EAS/Firebase, Play Console). Consulta `RELEASE_CHECKLIST.md`.

## Compartir cuentas por WhatsApp y correo

Los gastos, cuentas explicadas, cuentas puntuales e invitaciones muestran primero una vista previa. Desde ella se puede abrir WhatsApp, preparar un correo en Gmail/Outlook, usar el menú de compartir del teléfono o copiar el texto. El destinatario y el envío los decide la persona: abrir otra app no demuestra que se haya enviado ni entregado el mensaje. JUNTO no lee el buzón ni manda mensajes automáticos a los contactos.

La vista previa presenta el total y las personas en tarjetas, con el texto completo desplegable. Correo abre su propio formulario con el destinatario arriba, fuera del área que tapa el teclado. En Android se adjunta una imagen del resumen, revisable antes de abrir el correo: el editor nativo convierte HTML a texto con formato y no conserva tarjetas/tablas CSS. En iOS se usa HTML con estilos inline, tablas, total, aportes, invitados e instrucciones. En web `mailto:` entrega texto. No se promete la misma apariencia de HTML en todos los clientes ni entrega por abrir un borrador. Las imágenes generadas se mantienen en la caché temporal mientras la app corre; comprobar borradores y recepción en clientes reales antes de publicar.

### Enviar desde JUNTO (correo HTML desde la API)

Con sesión iniciada, en grupos, gastos y cuentas de un día el formulario de correo ofrece «Enviar desde JUNTO»: el correo llega con el diseño completo (tablas y estilos inline), a nombre de quien lo comparte y con `Reply-To` a su correo. La app solo envía referencias (`POST /api/compartir/correo` con tipo e id del recurso, destinatario, clave de envío y una huella de lo revisado); el servidor arma el contenido desde la base de datos tras comprobar que la persona es dueña de la cuenta o miembro del grupo, y no acepta HTML, asunto ni montos del cliente. Si las cuentas cambiaron después de revisarlas, no se envía.

- Idempotente: la misma clave devuelve el mismo resultado; un doble toque espera al primero.
- Límites por persona (en base de datos): 5 cada 10 minutos, 30 al día, 10 direcciones distintas al día; no repite el mismo resumen a la misma dirección en 10 minutos.
- Estados: «aceptado» (el proveedor lo tomó; **no** significa entregado ni leído), «fallido» e «incierto» (timeout: no sabemos si salió y un reintento con la misma clave no lo reenvía).
- Sin `RESEND_API_KEY`/SMTP la API responde 503 y la app solo ofrece abrirlo en Gmail/Outlook (`GET /api/compartir/correo/estado`).
- El destinatario se guarda como hash con clave (`EMAIL_HASH_SECRET`, o `JWT_SECRET` si falta) y una máscara `a***@dominio`; se borra al eliminar la cuenta. Sin imágenes remotas ni seguimiento.

Prueba local sin enviar nada fuera del equipo (receptor SMTP propio, dos instancias de la API): `npm run build:api && DATABASE_URL=… JWT_SECRET=… node ops/test-share-email-api.cjs`.

Plantilla ficticia para revisión visual: `node ops/preview-share-email.cjs`, luego abrir `http://127.0.0.1:3006`. No envía correo. Tests de diseño, importes y escape de HTML: `node --test ops/test-share-email.cjs`.

El correo transaccional de registro y recuperación es independiente. Necesita Resend o SMTP en la API. Sin proveedor real, el registro devuelve `emailDelivery: false`; reenviar avisa del fallo en vez de afirmar que llegó. SMTP exige TLS (587 con STARTTLS o 465 con TLS desde el inicio), con tiempos de espera limitados. Nunca incluyas contraseñas de Gmail en la app móvil.

Para comprobar las plantillas y el protocolo SMTP sin enviar a nadie: `node --test ops/test-email.cjs`. Para los mensajes compartidos y la detección de WhatsApp: `node --test ops/test-sharing.cjs`.

Para una prueba real con Gmail, crea tú una contraseña de aplicación y configúrala en el archivo privado `apps/api/.env.smtp.local` (no en Git ni en el chat). Después de compilar, desde la raíz: `node --env-file=apps/api/.env.smtp.local apps/api/dist/scripts/send-test-email.js calebluna41@gmail.com`. Verifica la bandeja y spam: el servidor solo puede certificar que el proveedor aceptó el correo, no que el destinatario lo leyó.

## Comprobantes de pago y aprobación

**¿Por qué no se conecta a Yape o Plin?** Ninguno ofrece una API pública para que una app verifique transferencias entre personas. Lo que existe es para comercios: Yape tiene integraciones para negocios (QR y pasarelas) y una herramienta para que empresas *envíen* pagos a usuarios mediante socios como Kashio, Prontopaga o Monnet; Plin se integra a comercios a través de pasarelas (Niubiz, Izipay, Culqi, Mercado Pago, Bamboo Payment). Ninguna de esas vías sirve para confirmar que Luis le yapeó a Ana. Por eso JUNTO **lee** la captura y una persona la **aprueba**. Fuentes: [integrar Yape y Plin (comercios)](https://kom.pe/integrar-yape-plin-woocommerce/), [Yape: pagos de empresas a usuarios](https://www.peru-retail.com/yape-anuncia-nueva-solucion-para-que-empresas-realicen-pagos-directos-a-usuarios/), [dispersión de pagos de Yape](https://www.latamfintech.co/articles/neobanco-peruano-yape-lanza-una-nueva-herramienta-de-dispersion-de-pagos-para-empresas-que-necesitan-enviar-dinero-a-sus-usuarios), [Plin vía Bamboo Payment](https://docs.bamboopayment.com/docs/plin), [Prontopaga integrará Plin](https://www.descubre.vc/noticia/prontopaga-integrar-plin-y-busca-procesar-us-1-200-millones-en-per-2026-03-30), [código de seguridad de Yape](https://www.peru-retail.com/yape-lanza-codigo-de-seguridad-para-evitar-yapeos-falsos-como-funciona/).

Cómo funciona:

1. Quien debe toca **«Subir comprobante»** en el grupo (o comparte la captura a JUNTO desde WhatsApp/Yape en Android). La imagen se sube a la API (`POST /api/pagos/comprobantes`), el OCR local (Tesseract, sin enviarla a terceros) propone monto, app, número de operación, destinatario, fecha y el código de seguridad de Yape, y sugiere a quién se pagó si el nombre coincide con alguien del grupo.
2. La persona revisa y envía. Se avisa si el comprobante ya respalda otro pago (misma imagen o mismo número de operación), si supera lo que se debe o si parece ser para otra persona. El pago queda «por aprobar» y **no** baja la deuda.
3. Lo aprueba quien recibe el dinero o, si el grupo lo activó («Yo también apruebo los pagos» al crearlo, o Editar grupo), cualquier administrador. Nadie aprueba su propio pago. Si un administrador aprobó algo que no llegó, quien debía recibirlo puede marcar **«No me llegó»** (30 días) y la deuda vuelve.

Privacidad: la imagen solo la ven quien pagó, quien recibe y los administradores que pueden aprobar (`GET /api/pagos/:id/comprobante`, sin caché). Los borradores no enviados se borran en 24 horas y la imagen de un pago resuelto a los 180 días (quedan monto y operación). Al eliminar la cuenta se borran sus capturas y el texto de sus comentarios. Una captura puede editarse: la aprobación humana es la garantía, no el OCR.

Los datos de idioma del OCR vienen en `@tesseract.js-data/spa` (dependencia de la API), así la lectura no depende de un CDN; `OCR_LANG_PATH` permite usar otra carpeta.

Pruebas: `node --test -r ts-node/register apps/api/src/domain/voucher.test.ts` (lector con textos ficticios de Yape, Plin y bancos), `node --test ops/test-payment-ux.cjs` (avisos y tarjetas de la app) y, con la API local, `node ops/test-vouchers-comments.cjs` (OCR real sobre `ops/qa-voucher.png`, duplicados, permisos, aprobación concurrente, «No me llegó», comentarios, purga y eliminación de cuenta). `python3 ops/create-voucher-fixture.py` regenera el comprobante ficticio.

## Navegación de la app

`app/(app)` es un Stack: las tres pestañas (Inicio, Actividad, Perfil) viven en `app/(app)/(tabs)` y cada pantalla de detalle se apila encima. Así cada pantalla empieza limpia al abrirse, se desmonta al salir y «Volver» regresa a donde estabas. Antes eran pestañas ocultas que nunca se desmontaban: el formulario de grupo conservaba el anterior, pagar mostraba el pago viejo y «Volver» iba a Inicio. Para regresar a una pantalla que ya está en la pila (por ejemplo, al grupo después de guardar un gasto) se usa `router.dismissTo`, no `replace`, para no apilar copias. `ops/test-ui-patterns.cjs` impide volver a montar detalles como pestañas.

## Dependencias y avisos de seguridad

`npm audit` se revisó por dónde corre cada paquete. Lo que corre en la API en producción quedó sin avisos: express 4.22.3 (qs, path-to-regexp, body-parser), @fastify/busboy 3.2.2, `uuid` 11 dentro de gaxios (override en `package.json`) y Sentry 10. En la app, nanoid 3.3.20; `decode-uri-component`/`query-string` siguen marcados, pero expo-router no usa la función afectada y su arreglo exige otra versión mayor de Expo. Los avisos restantes son de herramientas de compilación (Expo CLI, metro, tailwind, babel) que no se distribuyen. No uses `npm audit fix --force`: degrada nativewind y salta a Expo 57.

## Pruebas de interfaz en web

`ops/e2e-web.cjs` recorre en un navegador del tamaño de un teléfono: invitación pendiente tras iniciar sesión, sesión expirada, corte de red al guardar un gasto (debe quedar uno solo), volver atrás y reabrir un borrador, «Volver» dentro de un grupo, crear un segundo grupo con el formulario vacío y aceptar una invitación por correo desde Inicio. Necesita la API en `:3005` con una base de pruebas, Expo web en `:8081` y Chromium con `playwright-core`; esas dependencias web no forman parte del proyecto:

```bash
npm install --no-save react-native-web@~0.21.0 react-dom@19.1.0 @expo/metro-runtime@~6.1.2 playwright-core --workspace=apps/mobile
EXPO_PUBLIC_API_URL=http://localhost:3005 npx expo start --web --offline   # en apps/mobile
DATABASE_URL=postgresql://…localhost…/<base de pruebas> node ops/e2e-web.cjs
```

`ops/e2e-vouchers.cjs` recorre comprobantes: Luis sube la captura, Ana (administradora) la revisa y aprueba, Marta ve quién aprobó y todos comentan. Genera un comprobante ficticio único con `python3` + Pillow; `QA_SCREENSHOTS=<carpeta>` guarda capturas (las de `ops/screenshots/comprobantes/` salieron de ahí).

La beta web usa `tokenStorage.web.ts`: la sesión se conserva solo en `sessionStorage` de la pestaña, no en `localStorage`; Android/iOS siguen usando SecureStore nativo. Babel transforma `import.meta` para zustand. No modificar `node_modules` para habilitar web. La web no sustituye pruebas nativas de teclado, Google, adjuntos o navegación de Android/iOS. Véase `ops/web/README.md`.

## Google y Android local

Google requiere una app instalada, no Expo Go. `npm run android --workspace=apps/mobile` genera/instala la app nativa. Los proyectos `android/` e `ios/` se regeneran desde la configuración Expo y no se versionan.

El certificado opcional `JUNTO_QA_KEYSTORE_PATH` se admite **solo en desarrollo**: se copia durante el prebuild para conservar la huella de pruebas registrada en Google. Guárdalo fuera de Git (`apps/mobile/credentials/`); no lo uses como firma de producción. Play Store necesita su propia huella y la configuración pública de distribución.
