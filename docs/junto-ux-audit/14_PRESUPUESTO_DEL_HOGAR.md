# 14 · Presupuesto del hogar (15 oct 2026)

«Presupuesto del mes» en el menú del grupo (y como chip en el chat de grupos de depa y pareja).

- **Mes a mes** (‹ ›): lo gastado por el grupo con fecha en ese mes, en hora de Lima. Los pagos entre
  personas no son gasto. Meses pasados no tienen «por venir».
- **Por venir:** lo que los gastos que se repiten todavía agregarán antes de fin de mes (p. ej. Internet
  el día 20), sumado al proyectado. Así un alquiler pendiente ya cuenta contra el límite.
- **Límites** opcionales: total del grupo y por categoría (Vivienda, Comida, Compras, Transporte, Diversión,
  Servicios y otros). Estados: verde (< 80 %), ámbar «cerca» (80–100 %), rojo «te pasas» (> 100 %).
  Sin límite, la barra muestra la parte de esa categoría en el mes y dice «sin límite».
- Cualquier integrante puede poner o quitar un límite; queda en el historial del grupo.
- El presupuesto nunca guarda gastos: se calcula siempre desde el libro del grupo (no puede desfasarse).

Implementación: `PresupuestoGrupo` (migración `20261020000000_group_budget`, aditiva), dominio puro
`domain/budget.ts` (3 pruebas), `services/presupuesto.service.ts`, `GET/PUT /grupos/:id/presupuesto`,
pantalla `grupos/presupuesto.tsx`. Integración: `ops/test-household-budget.cjs`.
Validado en el emulador (`screens/native/50–51`) con el depa de Sofía: total S/ 2,178 de S/ 2,200
(«Quedan S/ 22», ámbar), Compras S/ 285 de S/ 300, Internet «por venir» el 20.
