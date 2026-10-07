# JUNTO — comprobantes, aprobación y comentarios (7 de octubre de 2026)

## Alcance y entorno

Misma rama `claude/dreamy-mayer-84huac` (PR #2). Entorno cloud sin emulador ni teléfonos, sin cuentas reales de Yape, Plin, Google ni proveedor de correo. PostgreSQL 16 local con bases **de prueba** (`junto_db` recreada vacía, `junto_voucher_qa`, `junto_upgrade_qa`). Comprobantes y personas ficticios (`ops/qa-voucher.png` dice «PRUEBA QA - NO ES UN PAGO REAL»). No se tocó ninguna base real ni se publicó nada.

## Resultados

| Comando | Resultado |
| --- | --- |
| `npm run test --workspace=apps/api` (incluye lector de comprobantes y actividad) | 54 pruebas, 0 fallos |
| `node ops/test-mobile-ux.cjs` · `test-release-config` | 15 · 2, 0 fallos |
| `node --test` dialogs · bill-validation · sharing · share-email · email · money-scenarios · ui-patterns · **payment-ux** | 5 · 7 · 9 · 7 · 1 · 5 · 2 · 8, 0 fallos |
| `npm run build:api` · `typecheck` (con y sin rutas tipadas de Expo) · `lint` móvil | sin errores |
| `npx expo export --platform android` | bundle generado |
| `npx expo prebuild --platform android` (carpeta generada y borrada) | el manifiesto incluye `SEND image/*` junto a los App Links y la consulta de WhatsApp |

Integraciones contra `junto_db` recreada con `prisma migrate deploy` (sin diferencias con el schema):

| Script | Resultado |
| --- | --- |
| `test-redesign`, `test-security-ux`, `test-hardening`, `test-quick-bills` (con OCR de `qa-receipt.png`: S/ 180.00) | PASS |
| `test-account-deletion`, `test-google-sign-in`, `test-expense-idempotency`, `test-share-email-api` | PASS |
| `test-vouchers-comments`: OCR por la API (≈0,5 s), sugerencia de destinatario, borrador ajeno, comprobante repetido (imagen y operación), quién ve la imagen, aprobación por administración, «No me llegó», comprobante liberado tras rechazo, dos aprobadores a la vez, ajuste desactivado, comentarios (límites, doble toque, reportes, eliminar), purga de borradores, eliminación de cuenta | PASS |

Actualización no destructiva: `junto_upgrade_qa` (base con migraciones anteriores y un grupo y gasto previos) recibió `20261009010000_shared_emails` y `20261010000000_vouchers_comments`; el grupo quedó en `aprobacion_pagos = 'receptor'` (no cambia quién aprueba) y el gasto intacto. Sin diferencias con el schema.

Recorridos en navegador (Expo web 390×844, API local):

| Script | Resultado |
| --- | --- |
| `ops/e2e-vouchers.cjs`: subir comprobante desde el grupo, lectura, envío, tarjeta «¿Lo apruebas?» de la administradora, detalle con imagen, aprobar, comentar, vista de quien recibe con «No me llegó», comentarios en el gasto, contador en la lista, ajustes al crear y editar | ok |
| `ops/e2e-web.cjs` (invitación tras login, sesión expirada, corte de red al guardar, borrador) | 4/4 ok |

## Autocrítica aplicada tras ver las capturas

- «Subir comprobante» se partía en dos líneas en la barra inferior: ahora ocupa más ancho que «＋ Gasto».
- El contador de comentarios se cortaba dentro de la línea del pagador: ahora va en su propia línea con ícono.
- En el detalle del pago había que bajar después de la imagen para aprobar: los botones quedan fijos abajo.
- La confirmación repetía «tu deuda baja cuando lo aprueben»: una sola vez.
- Los comentarios del gasto estaban debajo de cuatro botones: ahora van después de las partes.

Capturas en `ops/screenshots/comprobantes/` (datos ficticios, web, no nativas). `12-comprobante-repetido-bloqueado` muestra el bloqueo real: esa imagen ya respaldaba un pago aprobado en la base de pruebas.

## No comprobado aquí

Capturas reales de Yape y Plin de distintos bancos, «Compartir → JUNTO» en una build EAS, cámara, notificaciones, TalkBack en las pantallas nuevas y la aprobación en varios teléfonos. Ver «Pruebas pendientes en dispositivos y servicios reales» en `RELEASE_CHECKLIST.md`.
