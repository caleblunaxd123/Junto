// A reproducible fictional scenario for the already signed-in local QA viewer. Never production.
require('./local-qa.cjs').localQa();
const fs = require('node:fs/promises');
const { prisma } = require('../apps/api/dist/lib/prisma.js');
const groups = require('../apps/api/dist/services/grupos.service.js');
const expenses = require('../apps/api/dist/services/gastos.service.js');
const { registrarRecibido } = require('../apps/api/dist/services/pagos.service.js');
const { groupStatement } = require('../apps/api/dist/services/statement.service.js');
const { statementPdf, statementXlsx } = require('../apps/api/dist/services/statementExport.service.js');
const folder = 'ops/artifacts/lifecycle';
async function main() {
  const mode = process.argv[2] ?? 'seed';
  await fs.mkdir(folder, { recursive: true });
  if (mode === 'seed') {
    const viewer = await prisma.usuario.findUniqueOrThrow({ where: { id: process.env.JUNTO_QA_USER_ID ?? '' } });
    if (!viewer.email.endsWith('@example.invalid')) throw new Error('Only the explicitly selected fictional QA viewer.');
    const group = await groups.crearGrupo({ nombre: 'Cierre de viaje QA', tipo: 'viaje', moneda: 'PEN', aprobacionPagos: 'receptor', simplificarDeudas: false, integrantes: ['Ana Cierre', 'Luis Cierre'] }, viewer.id);
    const detail = await groups.getGrupoDetalle(group.id, viewer.id);
    const ana = detail.miembros.find(m => m.usuario.nombre === 'Ana Cierre');
    const everyone = detail.miembros.map(m => ({ usuarioId: m.usuarioId }));
    const input = { descripcion: 'Cena del viaje', montoTotal: 30000, pagadoPor: viewer.id, categoria: 'comida', tipoDivision: 'igual', participantes: everyone };
    const dinner = await expenses.crearGasto(group.id, input, viewer.id);
    await expenses.editarGasto(dinner.gasto.id, { ...input, montoTotal: 36000, descripcion: 'Cena y propina' }, viewer.id);
    await expenses.crearGasto(group.id, { ...input, descripcion: 'Taxi de regreso', montoTotal: 6000, pagadoPor: ana.usuarioId, categoria: 'transporte' }, viewer.id);
    await fs.writeFile(`${folder}/scenario.json`, JSON.stringify({ grupoId: group.id, viewerId: viewer.id }));
    console.log('Fictional native scenario:', group.id);
  } else {
    const scenario = JSON.parse(await fs.readFile(`${folder}/scenario.json`, 'utf8'));
    if (mode === 'settle') {
      const detail = await groups.getGrupoDetalle(scenario.grupoId, scenario.viewerId);
      if (detail.estado !== 'por_liquidar') throw new Error('Close the group through the app first.');
      for (const debt of detail.resumen.saldos) await registrarRecibido({ grupoId: scenario.grupoId, pagadorId: debt.deudorId, receptorId: debt.acreedorId, monto: debt.monto, metodo: 'efectivo', fechaEfectiva: '2026-10-14' }, scenario.viewerId);
    }
    const s = await groupStatement(scenario.viewerId, scenario.grupoId);
    await fs.writeFile(`${folder}/${s.grupo.estado}.json`, JSON.stringify(s, null, 2));
    await fs.writeFile(`${folder}/${s.grupo.estado}.pdf`, await statementPdf(s));
    await fs.writeFile(`${folder}/${s.grupo.estado}.xlsx`, await statementXlsx(s));
    console.log(`Fictional group: ${s.grupo.estado}; owed ${s.balance.teDeben}; owes ${s.balance.debes}.`);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
