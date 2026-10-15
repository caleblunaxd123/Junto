# 13 · Gastos que se repiten (15 oct 2026)

Para depas y parejas: alquiler, internet, luz. Se anotan una vez y JUNTO los agrega solos.

## Cómo se usa
- Al agregar un gasto, «¿Se repite?» con **No / Cada semana / Cada 15 días / Cada mes**. En grupos de
  tipo depa (roomies) o pareja aparece a la vista; en los demás, dentro de «＋ Hoy · Categoría y nota».
- La primera vez se anota **hoy**; luego en su fecha, con el mismo monto, pagador y reparto (cualquier
  forma de dividir, incluidas participaciones). El texto lo dice: «Se anota hoy y luego cada mes, el día 15…».
- Cada uno es un **gasto normal** (chat, cuentas, cuaderno, PDF) con la línea «🔁 Se repite cada mes, el
  día 15 · 15 nov.» para distinguir los meses.
- Menú del grupo → **«Gastos que se repiten»**: próxima fecha, cuántas veces se anotó, **Pausar/Reanudar**
  y **Dejar de repetir** (los ya anotados se quedan). Solo quien lo programó o un administrador.
- Cada cambio queda en el historial del grupo («Se programó «Alquiler» cada mes, el día 15»).

## Reglas y garantías
- Mensual recuerda el día: el 31 cae el último día de los meses cortos y vuelve al 31 (bisiestos incluidos).
- **Sin duplicados:** cada ocurrencia usa un identificador derivado de la regla y el día; repetir el
  trabajo, o correrlo dos veces a la vez, no agrega nada (probado con dos ejecuciones simultáneas).
- Si el servidor estuvo apagado, agrega cada fecha pendiente una sola vez (hasta 6 por pasada).
- Reanudar **no rellena** el periodo en pausa: sigue desde hoy.
- Si ya no se puede anotar (alguien del reparto salió, el grupo se cerró), **se pausa solo** y dice por qué.
- El reparto se valida al programarlo con las mismas reglas que un gasto manual.
- Trabajo: cada hora (`17 * * * *`), con la fecha del día en Lima; el gasto se fecha a mediodía de Lima.

## Implementación
`GastoRecurrente` + `Gasto.recurrenteId` (migración `20261019000000_recurring_expenses`, solo aditiva;
los permisos de producción se heredan por defecto). Dominio puro `domain/recurrence.ts` (4 pruebas),
servicio `services/recurrentes.service.ts`, rutas `/grupos/:id/recurrentes`, app: `gastos/agregar.tsx`,
`grupos/recurrentes.tsx`, `ChatBubble`. Prueba HTTP: `ops/test-recurring-expenses.cjs`.

## Validado en el emulador (`screens/native/40–44`)
Sofía creó «Depa Miraflores» con Diego y Valeria, anotó Alquiler S/ 1,500 «Cada mes»: se agregó hoy
(S/ 500 c/u) y quedó programado para el 15 de noviembre. Ejecutar el trabajo «como si fuera» 15 nov.
agregó el de noviembre una vez (una segunda pasada no agregó nada), los saldos subieron a S/ 1,000 c/u,
y pausar/reanudar funcionó sin rellenar meses.

## Pendiente
Presupuesto del hogar y calendario de vencimientos; avisar un día antes de anotar uno grande; editar
monto o reparto de una regla (hoy se deja de repetir y se crea otra).
