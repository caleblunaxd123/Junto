# JUNTO — estado real

Actualizado el 10 de octubre de 2026 (grupos de cobranza/división, chat y fecha límite); antes el 8 de octubre de 2026 contrastando el código de `main` + esta rama, no el plan original por semanas (que estaba desactualizado: marcaba como pendiente casi todo lo que ya existe). Comprobantes, aprobación y comentarios se añadieron en la ronda siguiente.

Leyenda: **Hecho** = implementado y con pruebas automáticas · **Parcial** = funciona con límites conocidos · **Pendiente** = no existe o necesita algo externo.

## Producto

| Área | Estado | Evidencia |
| --- | --- | --- |
| Registro, verificación por código, login, recuperación, cerrar sesión | Hecho | `ops/test-redesign.cjs`, `ops/test-security-ux.cjs` (OTP de un solo uso, rotación de sesiones, límite de intentos) |
| Continuar con Google | Parcial | Backend probado con claims (`ops/test-google-sign-in.cjs`); falta el inicio de sesión real en Android con la cuenta del propietario |
| Probar sin cuenta (sin servidor) | Hecho | Nombres opcionales, invitados por persona, propina; conservar el cálculo con consentimiento (`ops/test-mobile-ux.cjs`) |
| Dos tipos de grupo: cobranza y división de gastos | Hecho | Cobranza: alguien pagó todo y le devuelven su parte. División: entre todos juntan un monto meta. Dos mosaicos en Inicio y en «Nuevo grupo», con ejemplo (`ops/test-bill-parts.cjs`) |
| Cuenta en partes (S/ 500 en 5 partes de S/ 100) | Hecho | Se define al crear el grupo o después; las partes libres quedan con quien pagó y cada persona que se une ocupa una automáticamente (enlace o invitación, sin duplicar). Corregir total/partes; un reparto manual detiene la asignación automática (`apps/api/src/domain/billParts.test.ts`, `ops/test-bill-parts.cjs`) |
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
| Notificaciones push | Pendiente externo | Código listo; requiere proyecto EAS y Firebase del propietario |
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
| Despliegue HTTPS con dominio | Hecho: API y beta web en `https://junto.lunalav.pe/app/`, Contabo/Caddy, base privada |
| Beta iPhone/Android sin instalación | Hecho en navegadores de prueba: Chromium/WebKit. Falta validación física en Safari iPhone y Chrome Android |
| Web de escritorio y tamaños adaptativos | Publicado en web beta3 y probado localmente/HTTPS en Chromium y WebKit a seis anchos: bienvenida/auth, lateral, inicio en columnas, formularios y ventanas acotadas; ver `ops/web/RESPONSIVE-20261010.md`. Dispositivos y accesibilidad física pendientes |

## Lo que todavía no está demostrado

Ver «Pruebas pendientes en dispositivos y servicios reales» en `RELEASE_CHECKLIST.md`. Pasar lint, TypeScript y las pruebas locales no equivale a estar listo para Play Store.

La validación publicada del 10/oct/2026 está en `ops/web/VALIDATION-20261010.md`.
Acceso de invitado con alias y código por correo, sin contraseña, es una propuesta pendiente:
la beta actual exige cuenta con correo verificado, pero no exige instalar una app.
