# 02 · Benchmark de Splitwise

## Fuentes y límites

| Fuente | Qué aporta | Fecha |
|---|---|---|
| [splitwise.com](https://www.splitwise.com/) | Lista oficial de funciones Gratis/Pro | consultada 14 oct 2026 |
| [App Store · Splitwise](https://apps.apple.com/us/app/splitwise/id458023433) | Descripción oficial, beneficios Pro, valoración 4.0/5 (~29 mil), reseñas visibles | consultada 14 oct 2026 |
| APK `splitwise-26-9-1.apk` aportada por el dueño | Firma verificada (certificado «Splitwise», válida con `apksigner`), manifiesto, nombres de archivo | análisis estático limitado |
| Prensa y reseñas de terceros (itvoice.in, Trustpilot, 2023) | Límite diario de gastos en plan gratis | **reportado, no verificado oficialmente** |

**Límites honestos.** No se inició sesión en Splitwise ni se observaron sus pantallas. No se descompiló su
código (sin JADX), no se extrajeron iconos, textos ni recursos. Todo lo que sigue sobre la interfaz viene de
descripciones públicas; donde no hay evidencia se indica **«no observado»**. No se inventan pantallas.

## Lo verificable

**Gratis (web oficial):** grupos y amigos; dividir igual o desigual, por porcentaje o por participaciones
(*shares*); balances y «simplificar deudas»; gastos recurrentes; modo offline y sincronización; totales y
categorías; 100+ monedas; registro de pagos en efectivo u online.
**App Store añade:** varios pagadores por gasto, recurrencia semanal/quincenal/mensual/anual, comentarios
en gastos, historial de ediciones, restaurar grupos o gastos borrados, feed de actividad, push, exportar CSV,
integraciones de pago (Venmo/PayPal en EE. UU., Paytm en India).
**Pro:** escaneo OCR e itemización de boletas, almacenamiento de boletas en alta resolución, conversión de
moneda (Open Exchange Rates), gráficos «gasto por categoría», búsqueda en todo el historial, copias JSON.
**Plan gratis (terceros, 2023):** límite de 3–4 gastos por día y espera de ~10 s entre gastos. Una reseña
visible en App Store lo menciona («features moved behind the paywall»). Es la principal fricción comercial.

**APK (estático, sin ejecutar):** Kotlin + Jetpack Compose nativo; OCR **en el dispositivo** (ML Kit,
`libmlkit_google_ocr_pipeline.so`); gráficos con Highcharts dentro de WebView; SQLite local (offline);
permisos de cámara, contactos, biometría, Google Play Billing y notificaciones.

## Flujos A–S

Columnas: lo que se puede afirmar de Splitwise · fricción reportada · oportunidad para JUNTO.
«Interacciones» solo se miden para JUNTO (`03_USER_JOURNEYS.md`); para Splitwise no se observaron.

| Flujo | Splitwise (evidencia) | Fricción reportada | Oportunidad JUNTO |
|---|---|---|---|
| A. Registro/login | Cuentas propias; no observado en detalle | Reseña 2018: exige que todos se registren | JUNTO ya admite personas por nombre sin cuenta |
| B. Onboarding | No observado | — | Guía «Primeros pasos» y «Probar sin cuenta» ya existen |
| C. Inicio | Balances totales (oficial) | — | **Hecho:** balance Te deben / Debes / Neto por moneda |
| D. Crear grupo | Grupos con foto de portada (oficial) | — | Tipos de grupo con ilustraciones propias |
| E. Invitaciones | No observado | Exige registro | Enlace personal por nombre, unirse «como» |
| F. Registrar gasto | «Quick expense entry» (oficial) | **Límite diario en gratis (terceros)** | Sin límites; borradores offline; texto/dictado |
| G. Pagador | Varios pagadores (oficial) | — | JUNTO: uno por gasto → brecha (roadmap) |
| H. División | Igual, montos, %, participaciones, ajustes | Itemizar solo con Pro | **Hecho:** participaciones; productos de boleta gratis |
| I/J. Balances | Amigos y grupos (oficial) | — | JUNTO no mezcla grupos ni monedas, y lo explica |
| K. Pagos | Efectivo + integraciones país | Sin Zelle (reseña) | Yape/Plin/transferencia con confirmación del receptor |
| L. Simplificar | Por grupo; según guías, se activa por grupo | Opaco para el usuario | **Hecho:** «JUNTO Simplifica» muestra antes/después |
| M. Recurrentes | Semanal → anual (oficial) | — | Brecha (roadmap, prioridad alta para Hogar) |
| N. Actividad | Feed + historial de ediciones | — | Actividad existe; historial de ediciones: brecha |
| O. Notificaciones | Push (oficial) | — | Push + avisos durables + recordatorios amables |
| P. Búsqueda | Solo Pro | De pago | Brecha; ofrecerla gratis es diferencial |
| Q. Perfil | Avatares (oficial) | — | Foto de perfil existe |
| R. Config. grupo | Divisiones por defecto (Pro) | — | Editar grupo y aprobación de pagos existen |
| S. Vacíos/errores | Offline + sync (oficial) | — | JUNTO nunca muestra «cero» ante un fallo de red |

## Conclusiones

1. La paridad funcional importante ya existe; las brechas reales son **recurrentes, varios pagadores,
   búsqueda y archivo de grupos**.
2. El hueco comercial de Splitwise (límites del plan gratis, OCR/búsqueda/gráficos de pago) es la apertura
   de JUNTO: gastos, división, balances, pagos y simplificación siempre gratis.
3. JUNTO ya supera en el contexto peruano: personas sin cuenta, Yape/Plin con confirmación del receptor,
   cuentas de un día, multimoneda sin conversiones ocultas.
