# JUNTO — estado real

Actualizado el 8 de octubre de 2026 contrastando el código de `main` + esta rama, no el plan original por semanas (que estaba desactualizado: marcaba como pendiente casi todo lo que ya existe). Comprobantes, aprobación y comentarios se añadieron en la ronda siguiente.

Leyenda: **Hecho** = implementado y con pruebas automáticas · **Parcial** = funciona con límites conocidos · **Pendiente** = no existe o necesita algo externo.

## Producto

| Área | Estado | Evidencia |
| --- | --- | --- |
| Registro, verificación por código, login, recuperación, cerrar sesión | Hecho | `ops/test-redesign.cjs`, `ops/test-security-ux.cjs` (OTP de un solo uso, rotación de sesiones, límite de intentos) |
| Continuar con Google | Parcial | Backend probado con claims (`ops/test-google-sign-in.cjs`); falta el inicio de sesión real en Android con la cuenta del propietario |
| Probar sin cuenta (sin servidor) | Hecho | Nombres opcionales, invitados por persona, propina; conservar el cálculo con consentimiento (`ops/test-mobile-ux.cjs`) |
| Grupos, invitaciones por enlace/correo/celular | Hecho | `ops/test-redesign.cjs`; App Links necesita dominio y huella de Play |
| Gastos por partes iguales, montos y porcentajes, en céntimos | Hecho | `apps/api/src/domain/money.test.ts`, escenarios A–E (`ops/test-money-scenarios.cjs`) |
| Gastos sin duplicados por doble toque o reintento | Hecho | `ops/test-expense-idempotency.cjs`, recorrido web con corte de red (`ops/e2e-web.cjs`) |
| Saldos simplificados, pagos externos reportados y confirmados por quien recibe | Hecho | Un pago reportado no reduce la deuda hasta confirmarse (escenario E) |
| Cuentas de un día: total, personas, invitados, consumos, extras, aportes parciales, historial, archivo | Hecho | `ops/test-quick-bills.cjs`, `ops/test-bill-validation.cjs` |
| Lector de boletas (OCR local en la API) | Parcial | Propone el total y exige revisión; probado con boleta ficticia. Falta probar boletas reales variadas |
| Compartir por WhatsApp, menú del teléfono, copiar | Hecho | `ops/test-sharing.cjs`; envío real depende del teléfono |
| Correo abierto en Gmail/Outlook | Parcial | Android adjunta imagen; iOS HTML; web texto. Falta prueba en teléfonos con cuentas reales |
| Correo HTML enviado desde la API | Hecho en código | `ops/test-share-email-api.cjs` con SMTP local. Falta proveedor real (Resend/SES) y prueba de recepción |
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
| Despliegue HTTPS con dominio | Pendiente externo |

## Lo que todavía no está demostrado

Ver «Pruebas pendientes en dispositivos y servicios reales» en `RELEASE_CHECKLIST.md`. Pasar lint, TypeScript y las pruebas locales no equivale a estar listo para Play Store.
