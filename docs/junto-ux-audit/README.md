# JUNTO 2.0 — Auditoría UX/UI, benchmark y evolución

| Documento | Contenido |
|---|---|
| [01 Auditoría actual](01_CURRENT_APP_AUDIT.md) | Stack, funciones, 8 defectos encontrados (6 corregidos) |
| [02 Benchmark Splitwise](02_SPLITWISE_BENCHMARK.md) | Fuentes oficiales, APK verificada, flujos A–S |
| [03 Recorridos](03_USER_JOURNEYS.md) | Interacciones por tarea, antes y después |
| [04 Sistema de diseño](04_JUNTO_DESIGN_SYSTEM.md) | Tokens, tipografía, componentes, accesibilidad, tema oscuro |
| [05 Pantalla por pantalla](05_SCREEN_BY_SCREEN_REDESIGN.md) | Qué cambió en cada pantalla, con capturas |
| [06 Brechas](06_FEATURE_GAP_ANALYSIS.md) | JUNTO vs Splitwise, prioridades |
| [07 Diferenciadores](07_JUNTO_DIFFERENTIATORS.md) | SmartSplit, Scan, Simplifica… y freemium |
| [08 Arquitectura](08_TECHNICAL_ARCHITECTURE.md) | Reglas financieras, cambios de API, diseños propuestos |
| [09 Roadmap](09_IMPLEMENTATION_ROADMAP.md) | Hecho, siguientes etapas y criterios |
| [10 QA](10_QA_RESULTS.md) | Pruebas ejecutadas, resultados y límites |
| [11 Splitwise vs JUNTO](11_SPLITWISE_VS_JUNTO_PRUEBA.md) | Prueba lado a lado en el emulador y simplificación aplicada |
| [16 REA Yape y Splitwise](16_REA_YAPE_SPLITWISE_SIMPLICIDAD.md) | Evidencia actual, simplificación diaria, pagos y criterios de validación Android |
| [17 UX simple validada](17_UX_SIMPLE_VALIDACION.md) | Implementación 1.6.0, guardado nativo aislado y regresión de flujos |
| [18 REA + Voz y Escaneo en 1 toque](18_REA_SPLITWISE_YAPE_UX_MEJORAS.md) | Evidencia REA v6.5.0 (Splitwise APK, ADB y AST JS), barra de voz/boleta en 1 toque y mejoras UX |

Distribución solicitada por el dueño y aplicada localmente: [19 Cuentas y chat](19_DISTRIBUCION_CUENTAS_CHAT_20261017.md).

Capturas: [`screens/before`](screens/before) y [`screens/after`](screens/after) (render web del mismo código
React Native, API local, datos ficticios) y [`screens/native`](screens/native) (app nativa en el emulador Android). Regenerarlas: `ops/ux-export-web.sh <dir>`, servir con
`WEB_ROOT=<dir> PORT=8092 node ops/web/server.cjs` y `JUNTO_QA_WEB_PORT=8092 DATABASE_URL=<QA local> node ops/ux-previews.cjs after`.
