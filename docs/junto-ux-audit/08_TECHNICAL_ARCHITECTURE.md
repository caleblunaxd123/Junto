# 08 · Arquitectura técnica

## Vista general

```
apps/mobile (Expo/RN, también export web /app/) ──HTTPS──► apps/api (Express) ──Prisma──► PostgreSQL
        │  react-query (servidor) + zustand (sesión)            │  dominio puro en src/domain (probado)
        └── packages/shared: dinero, monedas, cuentas rápidas ◄──┘  (mismo cálculo en app y API)
```

## Reglas financieras (contrato)

1. Importes en **céntimos enteros** (`Int`), límite 999 999 999. Nada de flotantes para guardar.
2. **Redondeo explícito:** mayor resto; empates a favor del primero en el orden recibido. Igual, porcentajes y
   participaciones usan `allocateByWeights`; la suma siempre es exactamente el total.
3. **Vista previa = lo guardado:** `apps/mobile/src/lib/expensePreview.ts` replica el algoritmo; una prueba
   compara ambos al céntimo (`ops/test-mobile-ux.cjs`).
4. **Monedas separadas:** un grupo tiene una moneda inmutable; los balances personales se agrupan por moneda;
   un pago en otra moneda guarda tasa, origen y fecha como evidencia, y solo el importe en la moneda del grupo
   afecta el libro.
5. **Pagos:** `reportado` → `exitoso` | `rechazado`. La transición usa `updateMany({ where: { id, estado } })`,
   así que dos confirmaciones simultáneas o repetidas aplican una sola (probado).
6. **Idempotencia:** gastos con `solicitudId` del cliente (único por creador); reintentos devuelven el mismo gasto.
7. **Trazabilidad:** pagos guardan quién resolvió y cuándo; gastos se borran de forma lógica (`activo`).

## Cambios de esta iteración

| Área | Cambio | Compatibilidad |
|---|---|---|
| `domain/money.ts` | `allocateShares` (participaciones 0–1000, al menos una > 0) | Nuevo |
| `schemas/gastos.schema.ts` | `tipoDivision: "participaciones"`, `participantes[].participaciones` | Aditivo: clientes antiguos no cambian |
| `domain/accounts.ts` | `deudasDirectas` (por pareja, sin simplificar), `porCategoria`, `cuentas[].activo`; oculta integrantes inactivos sin movimientos | Aditivo; corrige D1 |
| `packages/shared/currency.js` | `formatMoney` con separador de miles | Solo visual; textos compartidos cambian a `S/ 1,080.00` |
| App | `aria-*` en lugar de `accessibilityState` (41 usos) | RN 0.81 nativo y RNW 0.21 |

`deudasDirectas`: cada participante debe su parte al pagador de cada gasto; cada pago confirmado reduce la
deuda de su pagador con su receptor; luego se compensa cada pareja. Por persona suma lo mismo que `neto`.

## Rendimiento

- `GET /grupos` calcula el libro de cada grupo con consultas separadas (N+1). Con decenas de grupos conviene
  una sola lectura agregada por grupo o caché por versión del libro.
- El chat sondea cada 4 s con el foco; a mayor escala, eventos (SSE/WebSocket) o sondeo adaptativo.

## Diseños propuestos (no implementados)

**Gastos recurrentes (Hogar).** Tabla `GastoRecurrente { id, grupoId, plantilla (JSON validado con el mismo
esquema de gasto), frecuencia: semanal|quincenal|mensual|anual, proximaFecha, activo, creadoPor }`. Un job
diario crea el gasto con `solicitudId = recurrente:<id>:<fecha>` (idempotente: nunca duplica si el job se
repite), avisa al grupo y permite saltar o editar una ocurrencia.

**Varios pagadores.** Nueva tabla `GastoPagador { gastoId, usuarioId, monto }` con suma = `montoTotal`;
`pagadoPor` queda como pagador principal para compatibilidad. `calculateAccounts` y `deudasDirectas` pasan a
sumar por pagador. Migración: cada gasto existente → un `GastoPagador` con el total.

**Offline con cola.** Cola local por usuario de operaciones con `solicitudId`; al reconectar se reenvían en
orden; si la API responde 409/422 la operación vuelve a borrador con el motivo. Nunca se descarta en silencio.

**Tema oscuro.** `ThemeProvider` con `palette` clara/oscura de mismos nombres (ver `04`).

**Háptica.** `expo-haptics` envuelto (no-op si falta el módulo) en confirmar pago, guardar gasto y errores;
requiere nueva compilación nativa.
