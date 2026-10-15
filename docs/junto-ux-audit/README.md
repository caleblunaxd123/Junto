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

Capturas: [`screens/before`](screens/before) y [`screens/after`](screens/after) (render web del mismo código
React Native, API local, datos ficticios) y [`screens/native`](screens/native) (app nativa en el emulador Android). Regenerarlas: `ops/ux-export-web.sh <dir>`, servir con
`WEB_ROOT=<dir> PORT=8092 node ops/web/server.cjs` y `JUNTO_QA_WEB_PORT=8092 DATABASE_URL=<QA local> node ops/ux-previews.cjs after`.
