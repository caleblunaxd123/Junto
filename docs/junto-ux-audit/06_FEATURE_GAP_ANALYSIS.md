# 06 · Brechas de funcionalidad

Leyenda: ✅ tiene · 🟡 parcial · ❌ no tiene. Splitwise según fuentes oficiales (`02_SPLITWISE_BENCHMARK.md`).
Prioridad: P0 exactitud/confianza · P1 alto impacto · P2 diferencial · P3 después.

| Función | Splitwise | JUNTO antes | JUNTO ahora | Prioridad / nota |
|---|---|---|---|---|
| División igual / montos / % | ✅ | ✅ | ✅ | — |
| Por participaciones | ✅ | ❌ | ✅ | Hecho en esta iteración |
| Varios pagadores por gasto | ✅ | ❌ | ❌ | P1 · cambio de modelo (`GastoPagador`) |
| Itemizar boleta | Pro | 🟡 cuentas de un día | 🟡 productos por OCR (en curso) | P2 · gratis en JUNTO |
| Simplificar deudas | ✅ (por grupo) | ✅ opaco | ✅ explicado | Hecho: antes vs después |
| Balance general en inicio | ✅ | 🟡 en otra pantalla | ✅ | Hecho |
| Separador de miles | ✅ | ❌ | ✅ | Hecho |
| Gastos recurrentes | ✅ | ❌ | ❌ | **P1** · base de JUNTO Hogar |
| Archivo/restauración de grupos | ✅ | ❌ | ❌ | P1 |
| Búsqueda en historial | Pro | 🟡 solo nombre de grupo | 🟡 | P2 · gratis = diferencial |
| Gráficos por categoría | Pro | ❌ | ✅ por grupo | Hecho (v1); mensual/comparativo pendiente |
| Historial de ediciones | ✅ | ❌ | ❌ | P2 · auditoría visible |
| Comentarios en gastos | ✅ | ✅ (chat) | ✅ | — |
| Offline | ✅ | ❌ | 🟡 borradores | P1 · cola de sincronización |
| Multimoneda | ✅ (conversión Pro) | ✅ sin conversión automática | ✅ | Pagos con tasa acordada y fecha |
| Pagos locales (Yape/Plin) | ❌ | ✅ con confirmación | ✅ | Diferencial |
| Personas sin cuenta | ❌ (reseñas) | ✅ | ✅ | Diferencial |
| Recordatorios amables | — | ✅ | ✅ | Falta UI de frecuencia/consentimiento |
| Exportar CSV | ✅ | ❌ (compartir texto) | ❌ | P3 |
| Tema oscuro | — | ❌ | ❌ | P2 · diseñado en `04` |
| Háptica | — | ❌ | ❌ | P3 · requiere compilación nativa |
| Skeletons de carga | — | ❌ | 🟡 inicio y grupo | Extender a todas las listas |
| Accesibilidad web de estados | — | ❌ (D3) | ✅ | Hecho |
| Límite diario de gastos | Gratis: sí (terceros, 2023) | ❌ | ❌ | **Nunca** limitar lo esencial |
