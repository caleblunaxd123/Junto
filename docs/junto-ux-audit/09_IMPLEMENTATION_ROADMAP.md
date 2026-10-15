# 09 · Roadmap de implementación

Ordenado por impacto. Cada etapa tiene criterio de terminado verificable.

## Etapa 0 — Hecho en esta iteración

| Cambio | Verificación |
|---|---|
| D1 persona fantasma en cuentas | prueba de dominio + integración `test-shares-simplify.cjs` + captura |
| D2 separador de miles | `test-currency.cjs` (incluye 999,999,999.99 y negativos) |
| D3 accesibilidad web de estados (41 controles) | `test-payment-flow-web.cjs` pasa (fallaba en `main`) |
| D4 «Registrar pago» para quien cobra | captura `after/08` |
| D5 balance general en Inicio + accesos rápidos | captura `after/01` |
| D6 JUNTO Simplifica explicado | 400 libros aleatorios + captura `after/03` |
| División por participaciones (API + app + borradores) | dominio, paridad vista previa/API, integración HTTP |
| Insights por grupo v1 | integración (`porCategoria`) + captura |
| Skeletons en Inicio y grupo | captura (carga) — revisión visual pendiente en nativo |
| 7 componentes muertos eliminados | typecheck y lint |

## Etapa 1 — Confianza y paridad (1–2 semanas)

1. Validar en dispositivo (APK de QA con `applicationId` distinto para no reemplazar la beta) Inicio, cuentas y participaciones.
2. Actualizar `test-web-beta.cjs` y `test-group-contribution-web.cjs` a los textos actuales.
3. **Gastos recurrentes** (modelo en `08`). Terminado: job idempotente probado con reintentos.
4. **Archivo de grupos** con filtro Activos/Archivados en Inicio.
5. Extender skeletons a Actividad, cuentas y resumen.

## Etapa 2 — Diferenciales (2–4 semanas)

1. **Varios pagadores** (migración compatible). Terminado: netos idénticos antes/después de migrar.
2. Búsqueda de gastos gratis (texto, persona, categoría, rango).
3. Insights mensuales y comparación entre periodos.
4. Cola offline con reenvío automático.
5. Pantalla de recordatorios (frecuencia, consentimiento, silencio).

## Etapa 3 — Experiencia premium

1. Tema oscuro completo (tokens → `ThemeProvider`).
2. `expo-haptics` y confirmaciones animadas con «reducir movimiento».
3. Historial de ediciones visible por gasto.
4. JUNTO Hogar (presupuesto, vencimientos) y Viajes (presupuesto, gasto diario).

## Etapa 4 — Comercial

Revisar políticas de Play/App Store; implementar JUNTO Plus con su facturación; nunca poner detrás de pago lo
necesario para entender o saldar deudas (`07`).

## Fuera de alcance de esta iteración (y por qué)

- Navegación de 4 pestañas (Inicio, Grupos, Actividad, Perfil): la app actual concentra grupos en Inicio y el
  grupo es un chat; cambiarlo afecta todo el flujo y conviene validarlo con usuarios primero.
- Tema oscuro y háptica: ver `04` y `08`.
- Publicación: nada se desplegó a producción.
