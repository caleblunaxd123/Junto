# JUNTO — estado real

## Monedas y pagos externos: beta 1.3.0 publicada (11/10/2026)

- País del plan explícito, sin GPS; su moneda es una sugerencia. Se puede elegir PEN, COP, USD, EUR, MXN o BRL independientemente del país. Los grupos existentes conservan PEN y país desconocido. Moneda y país quedan bloqueados para no reinterpretar el libro.
- Los pagos conservan moneda/monto original, fecha real y tasa aplicada. Se consulta una referencia diaria de Frankfurter por fecha del pago, con fuente/fecha y uso explícito. Referencia y cambio acordado quedan registrados por separado; no es una cotización bancaria en tiempo real. Si falla la consulta, se permite el cambio acordado manual. El servidor recalcula con enteros y rechaza discrepancias, excedentes y autoaprobación.
- «Ya pagué» reporta, no confirma ni reduce la deuda. Confirma quien recibe, no necesariamente el creador. La administración puede representar a un receptor añadido solo por nombre. Pagador/receptor reciben avisos internos persistentes aunque no haya token push; un pago pendiente se revisa en lugar de crear otro.
- Resúmenes por moneda: no se suman soles, pesos y dólares. Mensajes compartidos, chat, actividad y recordatorios muestran la moneda del grupo. APKs sin soporte reciben una indicación de actualización ante grupos o invitaciones de otras monedas.
- Validación local en base aislada `junto_payment_flow_qa_20261011`: 17 migraciones aplicadas, esquema sin desfase, API build y 79 pruebas de dominio; integraciones de moneda, cumpleaños con invitado excluido, receptor distinto del creador, receptor sin cuenta, pagos recibidos, concurrencia e importación. OCR real con imágenes ficticias y controles de privacidad/duplicados. No se enviaron correos ni push reales en esta ronda.
- Publicada tras CI verde de `79587a4`: API compatible y web 1.3.0, 17 migraciones, respaldo restaurado/validado y copia externa cifrada. APK versionCode 7 con Google, mismo firmante, bundle incluido y SHA-256 local/HTTPS idéntico; instalada sobre la anterior en el emulador, conserva sesión y arranca. Chromium/WebKit por HTTPS: acceso/salida QA, seis anchos, grupo y preparación de correo sin envío. Referencia de mercado autenticada consultada por HTTPS. Detalles/limitaciones de reversión: `ops/web/DEPLOY-20261011-MONEDAS.md`.
- «Subir comprobante» desde el grupo/chat abre el flujo privado del pago. OCR propone importes con moneda explícita PEN/COP/USD/EUR/MXN/BRL; `$` ambiguo o varias monedas/importes exige revisión. No lee automáticamente cualquier foto del chat ni confirma dinero por una captura.
- Alcance y pruebas: `ops/web/FLOW-PAYMENTS-20261011.md`. Google en la APK nueva, push con la app cerrada y validación física siguen pendientes; los avisos internos no acreditan recepción push.


Actualizado el 11 de octubre de 2026: código de la candidata 1.1.3 preparado para GitHub. La publicación del código no implica desplegar esta versión en Contabo ni habilitar la entrega push. Antes, el 10 de octubre se añadieron grupos de cobranza/división, chat y fecha límite.

## Candidata 1.1.3: inicio, guía y chat

- Inicio distingue los saldos de grupos de los importes pendientes en cuentas de un día. S/ 120 por cobrar no puede producir «Todo al día»; una consulta pendiente o fallida tampoco permite declarar que todo está resuelto.
- Guía de cuatro pasos opcional, guardada por cuenta y repetible desde Inicio. Explica cobranza, invitaciones, pagos externos y confirmación; no crea gastos ni envía mensajes.
- El permiso de notificaciones se solicita únicamente al elegir «Activar avisos». Se puede rechazar y seguir usando la app. Volver desde ajustes intenta registrar el dispositivo sin volver a pedir permiso automáticamente.
- Chat con selector de emojis y respuestas rápidas editables, sin envío automático ni frases que confirmen pagos. Conserva emojis unidos y controles contra texto bidireccional oculto.
- Google nativo probado por el propietario en la beta 1.1.2. La candidata 1.1.3 conserva el perfil público y el mismo firmante de beta; no sustituye una prueba física de esta versión. Accesos Google simultáneos protegidos con bloqueos y comprobaciones posteriores a la espera.
- Proyecto Expo/EAS vinculado. Firebase mostró una confirmación inicial, pero al volver a abrirlo aparecieron errores de permisos/condiciones: no se considera completado. Faltan configuración Android verificada, credencial FCM en EAS y prueba real de recepción. El APK construido sin `-EnablePush` declara esa limitación; no anuncia entrega activa.
- Validación local: 75 pruebas de dominio y 16 de inicio, notificaciones, chat, configuración y transporte; TypeScript, lint y build API. Chromium y WebKit recorrieron registro, verificación, recuperación, invitación, guía y reparto a seis anchos. SMTP de QA capturado localmente; no se contactó a amigos en esta ronda.
- APK release 1.1.3/versionCode 5 compilado. La prueba nativa visual de esta candidata y su publicación HTTPS siguen pendientes. Archivos privados, artefactos APK y salidas de compilación se mantienen excluidos de Git.

## Validación adicional: concurrencia del libro y cuentas

- Confirmar/rechazar pagos y crear/editar/eliminar gastos toman el mismo bloqueo del grupo que unirse/salir. Los permisos, integrantes y saldos se vuelven a consultar después de esperar: otra sesión no puede reabrir artificialmente un importe disponible ni asignar deudas a quien acaba de salir.
- La edición del grupo comprueba el rol después del bloqueo; una petición iniciada antes de perder la administración no puede modificar el nombre, la fecha ni las reglas de aprobación.
- Recordatorios manuales, diarios y por fecha recalculan lo pendiente dentro de la transacción; las configuraciones desactivadas y fechas movidas/canceladas dejan de producir avisos de candidatos antiguos. No se hacen llamadas SMTP/push mientras se retienen bloqueos de base de datos.
- Cada aviso de fecha identifica su fecha límite exacta, con restricción única por grupo/personas/etapa/fecha. Se mantiene un intervalo mínimo de 12 horas entre recordatorios de la misma pareja, también al mover la fecha. Los avisos históricos conservan referencia nula: no se reconstruye retrospectivamente su fecha original; podrían volver a avisar tras el intervalo de protección.
- Crear/unirse a grupos y eliminar la cuenta comparten un bloqueo por usuario. La eliminación bloquea sus grupos en orden estable antes de anonimizarlo; no se puede adquirir un grupo nuevo durante la eliminación ni usar una confirmación anterior a un cambio de credenciales. Los gastos compartidos siguen intactos.
- Nueva prueba PostgreSQL real `ops/test-ledger-concurrency.cjs`: reproduce carreras de permisos, saldos, salida de integrantes, dos cron simultáneos, fechas movidas, configuración desactivada y eliminación/unión/cambio de credenciales. Integrada en CI. Pasa tanto en la base QA existente como en una base vacía construida con las once migraciones; sin desfase de esquema.
- Pasaron 75 pruebas de dominio, 15 de UX móvil, 3 de distribución, TypeScript/lint móvil y build API. Integración local adicional: sesiones/OTP, eliminación, seguridad, cuentas puntuales, gastos idempotentes, comprobantes/comentarios, reparto, avisos de unión y SMTP. Chromium y WebKit: registro, verificación, recuperación, invitación, validación de S/ 500 y seis anchos; SMTP de QA en loopback, no correos a amigos.
- API publicada: `junto-api:20261011-locks`; web y APK continúan en 1.1.1. Chromium/WebKit por HTTPS: login/logout de la cuenta QA existente, seis anchos, grupo y preparación de correo; sin nuevos envíos. Respaldo, activación y rollback en `ops/web/DEPLOY-20261011-LOCKS.md`. No es una validación nativa ni de entrega push real; siguen pendientes las pruebas físicas y los requisitos de tiendas.

## Última validación: beta 1.1.1

- Partes libres exactas: S/ 100 entre tres conserva 33.34 + 33.33 + 33.33; la invitación muestra el importe de la siguiente parte, y la suma completa cuando hay varias cuentas automáticas. No expone participantes ni saldos a quien aún no pertenece.
- El chat actualiza también los saldos y «¿Quién pagó?» cuando llega un pago/confirmación desde otra sesión. Progreso calculado con todo el grupo y pagos netos, no solo la primera cuenta ni la suma bruta de transferencias.
- Se conserva el siguiente mensaje escrito mientras se envía el anterior. Mensajes nuevos no desplazan al lector si está revisando mensajes antiguos; hay botón de reintento explícito sin conexión.
- La confirmación/rechazo cuenta como novedad para quien pagó. El cursor de lectura no adelanta eventos llegados durante la petición ni retrocede por peticiones concurrentes.
- Pasaron 75 pruebas de dominio, 6 de contribución/progreso, 2 de cursor/chat, 15 de UX móvil, 3 de configuración de distribución y 56 de validaciones, correos, compartir y patrones UI; TypeScript, lint y build API. Integración local: reparto, avisos de unión, SMTP, seguridad/sesiones y libro de pagos.
- Chromium móvil/escritorio y WebKit: registro, verificación SMTP local, login, recuperación, invitación, borrador WhatsApp, revisión S/ 500 vs S/ 380 y seis anchos. Chat probado en cinco anchos con pago/confirmación remotos y preservación del texto durante el envío. Correos de QA capturados en loopback: no se contactó a amigos ni se comprobó la bandeja de Gmail en esta ronda.
- Web: https://junto.lunalav.pe/app/ · APK: https://junto.lunalav.pe/app/descargas/JUNTO-beta-20261011-polish.apk. APK release 1.1.1/versionCode 3, misma firma de beta, instalado sobre la versión anterior en el emulador. Esta ronda no acredita una prueba nativa visual completa ni una prueba en teléfonos físicos.
- API/web saludables tras desplegar; descarga HTTPS coincide con SHA-256 local. Sin nuevas migraciones pendientes. Detalles y rollback: `ops/web/DEPLOY-20261011-POLISH.md`.
- Sigue siendo beta: push con la app cerrada, Google OAuth nativo real, usuarios invitados sin cuenta, dos teléfonos físicos y requisitos de publicación en tiendas siguen pendientes. No se activaron SMS, cobros automáticos ni cambios de IA.

Leyenda: **Hecho** = implementado y con pruebas automáticas · **Parcial** = funciona con límites conocidos · **Pendiente** = no existe o necesita algo externo.

## Validación local: pasar cálculos y cuentas anteriores a grupos (11/oct/2026)

- «Probar sin cuenta» continúa en un grupo con el mismo reparto e integrantes por nombre; antes de crear se elige explícitamente el nombre propio y quién adelantó el dinero. No se deduce identidad por nombres coincidentes.
- «Cuentas anteriores» ofrece «Pasar a grupo» y conserva datos, aportes parciales, invitados e historial. Los pagos confirmados se copian una sola vez, sin pagos a sí mismo; la cuenta anterior queda como referencia de solo lectura y se excluye de pendientes para no duplicarlos.
- Migración aditiva `20261015000000_group_imports`; reconstrucción y desfase comprobados únicamente en PostgreSQL local QA. Reintentos simultáneos, versión antigua, permisos y errores dejan los datos intactos o devuelven el mismo grupo.
- Pasaron 75 pruebas de dominio, 15 de UX móvil, 5 de Inicio, TypeScript/lint y la integración de importaciones. Chromium y WebKit recorrieron el cálculo → grupo en 390 y 1440 px, con cumpleaños y saldo exacto. Sin correos externos ni cambios en producción.
- Monedas por grupo y sugerencia según país del viaje: en preparación, todavía no habilitadas. No se cambian monedas de cuentas existentes ni se mezclan/convierten saldos automáticamente.

### Pagos recibidos por integrantes sin cuenta

- La administración puede registrar un pago recibido por un integrante agregado por nombre. Solo sirve mientras el receptor no tenga cuenta; no permite aprobar el propio pago del administrador ni sustituir la confirmación de otra cuenta real.
- Queda registrado el receptor efectivo y el administrador que lo confirmó. La app explica quién pagó a quién y exige comprobar que el receptor recibió el dinero. El total de gastos no cambia; disminuye únicamente la deuda confirmada.
- `ops/test-admin-received.cjs`: importes parciales y completos, límite, solicitudes simultáneas, intrusos, miembros sin permisos y receptor que hereda su lugar con una cuenta real. Sin envíos externos. TypeScript, lint, build API y 75 pruebas de dominio aprobados.

### Inicio: «Dividir gastos» como acción principal

- Botón verde de ancho completo, altura mínima 116 px, texto grande, respuesta al toque y descripción del paso siguiente. Está visible también cuando todavía no hay grupos. Se evita otro botón «Nuevo grupo» compitiendo en escritorio o en el estado vacío.
- Guía rápida, menú «Agregar» y título del formulario usan el mismo término. El grupo sigue siendo el contenedor de gastos; no se introducen tipos de «cobranza» ni un segundo modelo.
- Chromium/WebKit verifican navegación, acción accesible y layout a 390/1440 px, además de registrar un pago parcial de Luis a Ana desde administración. Capturas QA locales; todavía no publicado ni validado en teléfono físico.
- Se corrigió la transición del panel «Cuentas» al formulario de pago: en web ya no compiten dos trampas de foco durante la animación. El campo se habilita cuando el diálogo está abierto; una edición rápida a S/ 25.00 guarda ese importe y deja S/ 75.00 pendientes, comprobado en WebKit.

## Producto

| Área | Estado | Evidencia |
| --- | --- | --- |
| Registro, verificación por código, login, recuperación, cerrar sesión | Hecho | `ops/test-redesign.cjs`, `ops/test-security-ux.cjs` (OTP de un solo uso, rotación de sesiones, límite de intentos) |
| Continuar con Google | Probado en beta Android 1.1.2 | Inicio real confirmado por el propietario; pruebas de concurrencia en `ops/test-google-sign-in.cjs`. Firmante Play diferente requiere cliente Android propio |
| Probar sin cuenta (sin servidor) | Hecho | Nombres opcionales, invitados por persona, propina; conservar el cálculo con consentimiento (`ops/test-mobile-ux.cjs`) |
| Modelo de producto: un solo concepto, el grupo de división de gastos | Hecho y publicado (beta 1.2.0, 11/oct/2026; `ops/web/DEPLOY-20261011-NOMBRES.md`) | Cada gasto: cuánto, quién pagó y entre quiénes (con exclusiones, p. ej. el cumpleañero). JUNTO calcula quién le debe a quién con saldos simplificados; el cobro (pagar, confirmar, recordar, fecha límite) es parte de la división, no otro tipo de grupo. Se retiraron los modos «cobranza/división» de la interfaz; los grupos antiguos siguen funcionando |
| Integrantes por nombre (sin app) | Hecho | Se agregan al crear el grupo o después; participan en gastos y saldos como cualquiera, sin login, correo, OTP ni recordatorios. Enlace personal por WhatsApp; al unirse heredan su lugar (con su enlace, o eligiendo su nombre con el enlace del grupo si solo deben). Un administrador puede vincularlos. «Ya me pagó» registra pagos recibidos confirmados al instante (`ops/test-members-by-name.cjs`) |
| Cuenta en partes (legado) | Solo grupos antiguos | Las partes libres siguen funcionando donde existen; ya no se crean desde la app |
| Grupo como chat (estilo WhatsApp) | Hecho en app y web | Mensaje fijado con la cuenta y el avance de cobro, burbujas de pagos (✓ esperando / ✓✓ confirmado, «Sí, lo recibí» en la burbuja), uniones con su parte, recordatorios y mensajes de texto. Se actualiza cada 4 s con el chat abierto; no requiere servidor adicional. Probado en emulador Android y Chromium a 5 anchos (`ops/test-group-contribution-web.cjs`) |
| Fecha límite y recordatorios automáticos | Hecho | Job cada hora: 3 días antes, últimas 24 h, el día que vence y cada 2 días de atraso (2 semanas). Uno por etapa y persona, nunca de 21:00 a 8:00 (Lima), solo a quien debe; push y correo (para usuarios web). Visible en el chat solo para deudor y acreedor (`apps/api/src/domain/deadline.test.ts`, `ops/test-bill-parts.cjs`) |
| Avisos de nuevos integrantes y no leídos | Hecho | Aviso en Inicio agrupado por grupo («Ana, Luis y Marta se unieron… le toca S/ 100») y burbuja de novedades sin leer por grupo. Push depende de Firebase/EAS |
| Grupos e invitaciones | Hecho en beta web | Enlace con aceptación; email HTML real por SMTP; celular prepara borrador WhatsApp, no SMS. Aviso interno separado. Recepción en Gmail autorizada, 10/oct/2026 (`ops/test-production-beta.cjs`) |
| Navegación (pantallas de detalle apiladas) | Hecho | «Volver» y formularios limpios (`ops/e2e-web.cjs`, guarda en `ops/test-ui-patterns.cjs`) |
| Tope de un pago, salida de grupo, gastos con ex-integrantes, recordatorios | Hecho | `ops/test-groups-ledger.cjs`, `apps/api/src/domain/payable.test.ts` |
| Dependencias de la API sin avisos de seguridad | Hecho | `npm audit`: quedan solo herramientas de compilación y una de expo-router que exige otra versión mayor de Expo |
| Gastos por partes iguales, montos y porcentajes, en céntimos | Hecho | `apps/api/src/domain/money.test.ts`, escenarios A–E (`ops/test-money-scenarios.cjs`) |
| Gastos sin duplicados por doble toque o reintento | Hecho | `ops/test-expense-idempotency.cjs`, recorrido web con corte de red (`ops/e2e-web.cjs`) |
| Saldos simplificados, pagos externos reportados y confirmados por quien recibe | Hecho | Un pago reportado no reduce la deuda hasta confirmarse (escenario E) |
| Cuentas de un día: total, personas, invitados, consumos, extras, aportes parciales, historial, archivo | Hecho | `ops/test-quick-bills.cjs`, `ops/test-bill-validation.cjs` |
| Lector de boletas (OCR local en la API) | Parcial | Propone el total y exige revisión; probado con boleta ficticia. Falta probar boletas reales variadas |
| Compartir por WhatsApp, menú del teléfono, copiar | Hecho | `ops/test-sharing.cjs`; envío real depende del teléfono |
| Correo abierto en Gmail/Outlook | Parcial | Android adjunta imagen; iOS HTML; web texto. Falta prueba en teléfonos con cuentas reales |
| Correo HTML enviado desde la API | Hecho y probado en Gmail | SMTP Gmail en Contabo; verificación, bienvenida, recuperación e invitación recibidas en el buzón autorizado. Límites/deduplicación con SMTP local. Outlook real pendiente |
| Recordatorios manuales y automáticos (cron diario) | Parcial | Rutas y job existen; notificaciones dependen de Firebase/EAS |
| Notificaciones push | Pendiente externo | EAS vinculado; falta completar/verificar Firebase, configuración Android y credencial FCM, además de recepción real |
| Eliminar cuenta (app y web) | Hecho | `ops/test-account-deletion.cjs` |
| Cobros integrados (Culqi/Yape) | Retirado | JUNTO no cobra. Se quitó el webhook y el cobro heredados, que no estaban habilitados |
| Comprobantes Yape/Plin leídos por OCR | Hecho en código | Lector probado con textos ficticios y con una captura ficticia vía API (`voucher.test.ts`, `ops/test-vouchers-comments.cjs`). Falta probar capturas reales de cada banco |
| Aprobación por quien recibe o por la administración | Hecho | Permisos, carrera de dos aprobadores, «No me llegó» y ajuste por grupo (`ops/test-vouchers-comments.cjs`, `ops/e2e-vouchers.cjs`) |
| Comentarios en gastos y pagos | Hecho | Límites, duplicados, eliminar y reportar; falta el proceso humano de revisión de reportes |
| Compartir una captura a JUNTO (Android) | Parcial | Configurado y verificado con `expo prebuild`; falta probarlo en una build EAS |
| Verificar pagos con Yape/Plin automáticamente | No disponible | No existe API pública de transferencias entre personas; solo integraciones para comercios |

## Plataforma

| Área | Estado |
| --- | --- |
| Migraciones Prisma versionadas, CI con Postgres y verificación de desfase | Hecho |
| Actualización no destructiva desde la base anterior | Probada en base aislada (gasto previo intacto) |
| Logs sin claves, OTP ni montos | Hecho (`apps/api/src/domain/logSafe.test.ts`) |
| Sentry en la API | Opcional, requiere DSN |
| Build Android (APK/AAB) firmada | Pendiente externo (EAS + Play Console) |
| Despliegue HTTPS con dominio | Hecho: API y beta web en `https://junto.lunalav.pe/app/`, Contabo/Caddy, base privada. Versión 1.1.0 (cobranza, chat, fecha límite) publicada el 11/oct/2026, APK `JUNTO-beta-20261011.apk`; ver `ops/web/DEPLOY-20261011.md` |
| Beta iPhone/Android sin instalación | Hecho en navegadores de prueba: Chromium/WebKit. Falta validación física en Safari iPhone y Chrome Android |
| Web de escritorio y tamaños adaptativos | Publicado en web beta3 y probado localmente/HTTPS en Chromium y WebKit a seis anchos: bienvenida/auth, lateral, inicio en columnas, formularios y ventanas acotadas; ver `ops/web/RESPONSIVE-20261010.md`. Dispositivos y accesibilidad física pendientes |

## Lo que todavía no está demostrado

Ver «Pruebas pendientes en dispositivos y servicios reales» en `RELEASE_CHECKLIST.md`. Pasar lint, TypeScript y las pruebas locales no equivale a estar listo para Play Store.

La validación publicada del 10/oct/2026 está en `ops/web/VALIDATION-20261010.md`.
Acceso de invitado con alias y código por correo, sin contraseña, es una propuesta pendiente:
la beta actual exige cuenta con correo verificado, pero no exige instalar una app.
