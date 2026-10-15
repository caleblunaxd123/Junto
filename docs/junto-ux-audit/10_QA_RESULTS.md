# 10 · Resultados de QA (14 oct 2026)

Entorno: Windows, base PostgreSQL **local** en Docker (`junto_ux_qa_20261014`, creada para esta misión con
todas las migraciones), API local compilada, JWT ficticio, sin SMTP. Ninguna prueba tocó producción ni la base
de `apps/api/.env`. Las pruebas web interceptan toda petición y bloquean cualquier origen externo.

## Automáticas

| Suite | Resultado |
|---|---|
| API dominio (`npm test` en `apps/api`) | **90/90** (antes 85; +participaciones, +cadena Ana→Luis→Carla, +400 libros aleatorios, +persona reemplazada/categorías) |
| `ops/test-mobile-ux.cjs` | **17/17** (+paridad vista previa ↔ API de participaciones) |
| `ops/test-currency.cjs` | **6/6** (formato de miles, negativos, máximo) |
| `node --test ops/web/test-server.cjs` | **pasa** (CSP, rutas, recarga SPA) |
| Typecheck API y app, ESLint app | **sin errores ni advertencias** |
| `ops/test-shares-simplify.cjs` (nuevo, HTTP) | **pasa**: participaciones exactas al crear y editar, inválidas rechazadas (400), persona reemplazada oculta, netos de deudas directas = simplificadas = libro, categorías, confirmar dos veces → segundo intento 400 y el pago cuenta una vez, suma de netos = 0 |
| `test-bill-parts`, `test-members-by-name`, `test-currency-api` | **pasan** |
| `test-groups-ledger`, `test-expense-idempotency`, `test-money-scenarios` (5/5), `test-payment-flow`, `test-redesign` | **pasan** |
| `test-payment-flow-web` (Chromium) | **pasa** — en `main` fallaba por D3 (accesibilidad web); además fallaba entre 7 p. m. y medianoche porque fijaba la tasa en fecha UTC (corregido a fecha local, como la app) |
| `test-google-only-web`, `test-group-import-web`, `test-group-contribution-web` | **pasan** tras actualizar textos viejos («Deudas pagadas…», «Sin gastos», «Nuevo grupo» ya no existían), usar un usuario sin grupos por tamaño, y quitar el botón «Cerrar panel» duplicado del fondo de las hojas (defecto de accesibilidad: se anunciaba dos veces) |
| `test-shares-simplify` (nuevo, HTTP) | incluye el caso del dueño persona a persona: Ana le paga S/ 30 a Sofía, S/ 30.01 se rechaza, el modo no cambia con pagos pendientes, al cambiar a simplificado los netos no varían |
| `test-web-beta` | **sigue desactualizada** (busca «Crear grupo e invitar», que ya no existe); pendiente de reescribir |

Las pruebas web ahora aceptan `JUNTO_QA_WEB_PORT` (antes solo :8090, que estaba ocupado por otro servidor).

## Visuales

- **Renderizado y revisado:** Inicio, chat del grupo, «Cuentas explicadas» (completa), nuevo gasto (completo y
  por participaciones), resumen de cuentas, Actividad, Perfil, Registrar pago, Inicio en escritorio 1440 px.
  `screens/before/` (código anterior) y `screens/after/`. Generadas con `ops/ux-previews.cjs`.
- **Qué son:** export web del mismo código React Native en Chromium a 390×844 (2×). **No** son capturas
  nativas de Android/iOS.
- `before/01-home*.png` muestra encima la guía «Primeros pasos» (cuenta nueva); en `after/` se cerró antes de capturar.
- **No validado visualmente:** los skeletons (la carga local es demasiado rápida para capturarlos), tema
  nativo de Android/iOS, lectores de pantalla reales.

## Emulador (actualizado)

Se compiló la variante debug con sufijo `.qa` (`com.junto.app.qa`, nombre «JUNTO QA»), que convive con la beta
`com.junto.app` sin reemplazarla, servida por Metro y apuntando a la API local por `adb reverse`. «Continuar con
Google» no funciona en esa variante (paquete y firma no registrados en Google Cloud): es esperado y no afecta a
la beta. Recorridos validados en nativo y defectos solo-Android encontrados y corregidos: ver
`11_SPLITWISE_VS_JUNTO_PRUEBA.md` y `screens/native/`. Para repetirlo: `applicationIdSuffix ".qa"` en el
`buildTypes.debug` del `android/` generado (fuera de git), `gradlew :app:assembleDebug`, `adb reverse tcp:8081
tcp:8081` y `tcp:3005 tcp:3005`, `EXPO_PUBLIC_API_URL=http://localhost:3005 npx expo start`, y datos con
`ops/seed-emulator-qa.cjs`.

## APK de Splitwise

Firma verificada (certificado de Splitwise; `apksigner verify` correcto), manifiesto y nombres de archivo
leídos sin ejecutar ni descompilar. Ver `02_SPLITWISE_BENCHMARK.md`.

## Pendiente

Validación nativa en dispositivo, actualizar las dos pruebas web desactualizadas y retirar la dependencia sin
uso `lucide-react-native`.
