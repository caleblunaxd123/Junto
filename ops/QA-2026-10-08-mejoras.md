# JUNTO — revisión completa y mejoras (8 de octubre de 2026)

## Alcance

Rama `claude/dreamy-mayer-84huac` reiniciada desde `main` en `d06e697` (PR #2 fusionado + «harden concurrent sharing payments and comments»). Tres revisiones independientes, solo lectura: API, app y dependencias. Cada hallazgo se verificó leyendo el código antes de corregirlo. Bases de prueba locales (`junto_db` recreada, `junto_fresh_qa`, `junto_upgrade_qa`). Datos ficticios; no se tocó ninguna base real ni se publicó nada.

## Corregido

**API**
- **Invitaciones sin consentimiento (alto).**
  - Antes, cualquier integrante podía agregar a cualquier persona registrada con solo su correo o celular. Luego veía su celular y su correo, y la respuesta revelaba su nombre.
  - Ahora se crea una invitación que la persona acepta o rechaza desde su Inicio. La respuesta es la misma tenga o no cuenta.
  - Un celular que figura en dos cuentas no invita a nadie.
  - Tras un rechazo no se insiste durante 7 días.
  - Se retiró `/auth/verificar-celulares`, que decía qué números tienen cuenta (200 por llamada, sin límite).
- **Tope de un pago.**
  - Antes era la sugerencia simplificada, que cambia si alguien agrega un gasto después de que pagaste.
  - Ahora es lo que aún debes y lo que la otra persona tiene por recibir, descontando los pagos por aprobar.
  - El libro se lee dentro de la transacción; antes pedía una segunda conexión del pool.
- **Salir del grupo.**
  - No se puede salir con un pago esperando respuesta.
  - La comprobación se hace bajo bloqueo.
  - El último en salir cierra el grupo y su enlace.
  - Quien vuelve entra como miembro, no como administrador.
- **Gastos con alguien que ya salió.** No se puede eliminar ni cambiar el monto o quién pagó: dejaría deudas que nadie puede saldar.
- **Recordatorios.**
  - Responden 409 en vez de 500.
  - Pausa de 12 h entre recordatorios a la misma persona.
  - No se envían si ya reportó el pago.
  - La configuración automática no funcionaba nunca (upsert con id vacío) y ahora funciona.
  - El cron solo recuerda deudas de quien lo configuró y no duplica envíos entre instancias.
- **Comprobantes.**
  - El OCR atiende en cola: antes, de tres subidas simultáneas, dos quedaban sin leer.
  - El límite de subidas se comprueba bajo bloqueo.
- **Notificaciones.**
  - Timeout de 5 s y sin retener la respuesta.
  - `DELETE /auth/push-token` para cerrar sesión.
- **Rendimiento y límites.**
  - Cuerpos JSON de 256 KB, salvo en las dos rutas de imagen (6 MB).
  - Índices en `pagos(grupo_id)` y `pagos(receptor_id)`.
  - El historial devuelve todos los pagos pendientes y los últimos 200 resueltos.
  - Los comentarios muestran los 200 más recientes.

**App**
- **Navegación.** Las pantallas de detalle eran pestañas ocultas que nunca se desmontaban, con tres efectos:
  - el segundo «Nuevo grupo» conservaba el primero y ofrecía «Reintentar invitaciones»;
  - Pagar mostraba el pago anterior y no reabría la galería;
  - «Volver» llevaba siempre a Inicio.
  
  Ahora `(app)` es un Stack con las pestañas en `(tabs)`, y al regresar se usa `dismissTo` para no apilar copias.
- **Notificaciones.**
  - Al cerrar sesión, el teléfono deja de recibir los avisos de esa cuenta, y la siguiente cuenta vuelve a registrar el token.
  - El último aviso tocado se abre una sola vez.
  - Un aviso que llega con la app abierta refresca los datos.
- **Datos actualizados.**
  - Tras aprobar o rechazar se refresca aunque haya error, y se muestra el mensaje del servidor («ya fue resuelto»).
  - El detalle del pago se actualiza solo mientras espera.
  - Después de un error al pagar se refresca el historial.
- **Invitaciones en Inicio**, con «Unirme» y «No, gracias».
- **Pagar** usa el mismo tope que la API (`packages/shared/payable.js`).
- **Privacidad local.**
  - El cálculo de prueba se borra al cerrar sesión.
  - Los borradores, al eliminar la cuenta.
- **Accesibilidad y textos.**
  - Áreas táctiles de 44 dp y etiquetas descriptivas.
  - El comprobante se ve a ancho completo en Android.
  - Se corrigieron «Tú confirmó» y «Nada pendiente» con error.

**Dependencias.** express 4.22.3 (qs, path-to-regexp, body-parser), @fastify/busboy 3.2.2, nanoid 3.3.20, `uuid` 11 dentro de gaxios (override) y Sentry 10, más herramientas dentro de sus rangos. `npm audit`:
- **Antes:** 82 entradas.
- **Ahora:** 53, ninguna en la API en producción. Las de la app no tocan código que se use. El resto son herramientas de compilación.

## Comprobado

| Comando | Resultado |
| --- | --- |
| `npm run test --workspace=apps/api` | 58 pruebas, 0 fallos (nuevas: cola del OCR, tope de pago) |
| `test-mobile-ux` · release-config · dialogs · bill-validation · sharing · share-email · email · money-scenarios · ui-patterns · payment-ux · local-qa | 15 · 2 · 5 · 7 · 9 · 7 · 1 · 5 · 3 · 8 · 2, 0 fallos |
| `build:api` · typecheck (con y sin rutas tipadas) · lint | sin errores |
| `expo export --platform android` | bundle generado |
| 10 integraciones sobre `junto_db` (incluida la nueva `test-groups-ledger` y las existentes adaptadas a la aceptación) | PASS |
| Reproducción previa: 3 comprobantes a la vez contra la API anterior | 2 sin leer; con la cola, los 3 leídos |
| `prisma migrate deploy` desde cero (7 migraciones) y actualización de `junto_upgrade_qa` con datos previos | sin diferencias con el schema; datos intactos |
| `e2e-web` (6 recorridos, 2 nuevos: «Volver» y segundo grupo; invitación aceptada desde Inicio) y `e2e-vouchers` | ok |
| API con `SENTRY_DSN` ficticio (Sentry 10) | arranca y responde |

Captura: `ops/screenshots/mejoras/01-invitacion-pendiente.png` (web, datos ficticios).

## No comprobado aquí

Navegación y botón atrás en una build nativa, avisos push reales y verificación de celulares por SMS (necesita un proveedor). Ver `RELEASE_CHECKLIST.md`.
