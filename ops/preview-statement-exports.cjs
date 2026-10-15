// Generates only fictional QA fixtures through the same production exporters.
const fs = require('node:fs/promises');
const { statementPdf, statementXlsx } = require('../apps/api/dist/services/statementExport.service.js');
async function main() {
  const s = JSON.parse(await fs.readFile('ops/artifacts/statement/fixture.json', 'utf8'));
  const long = { ...s, grupo: { ...s.grupo, nombre: 'Cuaderno de prueba largo: comidas y transportes del viaje compartido' }, movimientos: Array.from({ length: 120 }, (_, i) => ({ ...s.movimientos[i % 3], id: `long-${i}`, ...(i % 3 === 0 ? { descripcion: `Movimiento ${i + 1}: comida con descripción larga para verificar el ajuste de líneas, montos y saldo acumulado sin cortar el texto del cuaderno.` } : {}) })) };
  const adversarial = { ...s, movimientos: [{ ...s.movimientos[0], descripcion: '=HYPERLINK("https://example.invalid","texto literal")' }], grupo: { ...s.grupo, nombre: 'Ñandú & <cuentas> / prueba literal' } };
  await fs.writeFile('ops/artifacts/statement/cuaderno-largo.pdf', await statementPdf(long));
  await fs.writeFile('ops/artifacts/statement/cuaderno-literal.xlsx', await statementXlsx(adversarial));
  const ExcelJS = require('exceljs'); const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile('ops/artifacts/statement/cuaderno-literal.xlsx');
  require('node:assert/strict').equal(wb.getWorksheet('Movimientos').getCell('D2').type, ExcelJS.ValueType.String);
  const example = JSON.parse(JSON.stringify(s).replace(/ QA/g, ''));
  example.grupo.nombre = 'Paseo a Lunahuaná (ejemplo con datos ficticios)';
  await fs.mkdir('output/pdf', { recursive: true }); await fs.mkdir('output/spreadsheets', { recursive: true });
  await fs.writeFile('output/pdf/JUNTO-estado-cuenta-ejemplo.pdf', await statementPdf(example));
  await fs.writeFile('output/spreadsheets/JUNTO-cuentas-ejemplo.xlsx', await statementXlsx(example));
  console.log('PASS: long PDF fixture and literal Excel text (no user-injected formula).');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
