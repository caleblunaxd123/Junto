import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { formatMoney } from '@junto/shared/currency';
import type { groupStatement } from './statement.service';
const methodName = (metodo: string | null) => ({ yape: 'Yape', plin: 'Plin', transferencia: 'Transferencia', efectivo: 'Efectivo' } as Record<string, string>)[metodo ?? ''] ?? metodo ?? 'Pago';

export type Statement = Awaited<ReturnType<typeof groupStatement>>;
const categories: Record<string, string> = { comida: 'Comida', transporte: 'Transporte', alojamiento: 'Alojamiento', entretenimiento: 'Entretenimiento', compras: 'Compras', otro: 'Otros' };
const category = (key: string) => categories[key] ?? key;
const day = (value: string, timeZone: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const state = (value: string) => value === 'exitoso' ? 'Confirmado' : value === 'reportado' || value === 'pendiente' ? 'Por confirmar (no cuenta)' : value === 'rechazado' ? 'Rechazado (no cuenta)' : 'No confirmado (no cuenta)';
const groupState = (s: Statement, timeZone: string) => `Grupo ${s.grupo.estado === 'cerrado' ? 'cerrado' : s.grupo.estado === 'por_liquidar' ? 'por liquidar' : 'abierto'}${s.grupo.cerradoEn ? ` / Cierre: ${new Intl.DateTimeFormat('es-PE', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(s.grupo.cerradoEn))}` : ''}`;
function concept(e: Statement['movimientos'][number]) {
  return e.tipo === 'gasto' ? e.descripcion : e.sentido === 'enviado' ? `Pago a ${e.contraparteNombre}` : `Pago de ${e.contraparteNombre}`;
}
function settlements(s: Statement) {
  return s.saldos.map(d => ({ nombre: d.acreedorId === s.titular.id ? `${d.deudorNombre} te debe` : `Le debes a ${d.acreedorNombre}`, monto: d.monto }));
}

/** Portable production exporter; all strings are literal cell values, never user-authored formulas. */
export async function statementXlsx(s: Statement, timeZone = 'America/Lima') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'JUNTO'; wb.created = new Date(); wb.calcProperties.fullCalcOnLoad = true;
  const summary = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  const rows = wb.addWorksheet('Movimientos', { views: [{ state: 'frozen', ySplit: 1 }] });
  const fmt = `"${s.grupo.moneda}" #,##0.00;[Red]-"${s.grupo.moneda}" #,##0.00;"${s.grupo.moneda}" 0.00`;
  summary.columns = [{ width: 47 }, { width: 22 }, { width: 3 }, { width: 30 }];
  for (const [address, text] of [['A1', 'JUNTO / Sacar cuentas'], ['A2', s.grupo.nombre], ['A3', `Cuenta de ${s.titular.nombre}`]] as const) {
    summary.mergeCells(`${address}:D${address.slice(1)}`); summary.getCell(address).value = text;
  }
  summary.getRow(1).height = 32; summary.getCell('A1').font = { name: 'Calibri', size: 21, bold: true, color: { argb: 'FF007F68' } };
  summary.getRow(2).height = 36; summary.getCell('A2').alignment = { wrapText: true, vertical: 'middle' };
  summary.getRow(3).height = 30;
  summary.mergeCells('A4:D4'); summary.getCell('A4').value = groupState(s, timeZone); summary.getCell('A4').font = { size: 10, color: { argb: 'FF687775' } }; summary.getCell('A4').alignment = { wrapText: true }; summary.getRow(4).height = 30;
  const end = s.movimientos.length + 1;
  const sum = (col: string) => s.movimientos.length ? `SUM('Movimientos'!${col}2:${col}${end})` : '0';
  const totals: Array<[number, string, number, string?]> = [
    [5, 'Te deben', s.balance.teDeben], [6, 'Debes', s.balance.debes], [7, 'Saldo neto (a favor + / en contra -)', s.totales.saldo, 'ROUND(B5-B6,2)'],
    [9, 'Tu parte de los gastos', s.totales.tuParte, sum('F')], [10, 'Pusiste en gastos', s.totales.pagasteEnGastos, sum('G')],
    [11, 'Pagaste a otros (confirmado)', s.totales.pagosEnviados, sum('H')], [12, 'Te pagaron (confirmado)', s.totales.pagosRecibidos, sum('I')],
  ];
  for (const [row, label, amount, formula] of totals) {
    summary.getCell(`A${row}`).value = label;
    summary.getCell(`B${row}`).value = formula ? { formula, result: amount / 100 } : amount / 100;
    summary.getCell(`B${row}`).numFmt = fmt;
    summary.getRow(row).height = 26;
    if (row <= 7) summary.getRow(row).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0A6' } }; c.font = { bold: true, size: 13 }; });
  }
  let at = 15;
  for (const [title, items] of [['En qué gastaste (tu parte)', s.porCategoria.map(c => ({ nombre: category(c.categoria), monto: c.monto }))], ['Quién le paga a quién', settlements(s)]] as const) {
    summary.getCell(`A${at}`).value = title; summary.getRow(at++).font = { bold: true, color: { argb: 'FF007F68' } };
    for (const item of items) { summary.getCell(`A${at}`).value = item.nombre; summary.getCell(`B${at}`).value = item.monto / 100; summary.getCell(`B${at}`).numFmt = fmt; summary.getRow(at).height = Math.max(24, Math.ceil(item.nombre.length / 45) * 16); summary.getCell(`A${at++}`).alignment = { wrapText: true }; }
    at++;
  }
  const note = `Estado actual de los gastos vigentes, en orden de registro. Fechas del gasto/pago: ${timeZone}; registro: UTC. Solo los pagos confirmados cambian el saldo. Los comprobantes se consultan con permisos dentro de JUNTO.`;
  summary.mergeCells(`A${at}:D${at + 2}`); summary.getCell(`A${at}`).value = note; summary.getCell(`A${at}`).alignment = { wrapText: true, vertical: 'top' }; summary.getCell(`A${at}`).font = { size: 10, color: { argb: 'FF687775' } };
  rows.columns = ['Fecha', 'Registro (UTC)', 'Tipo', 'Concepto', 'Monto total', 'Tu parte', 'Pusiste', 'Pagaste confirmado', 'Recibiste confirmado', 'Efecto', 'Saldo neto', 'Estado', 'Comprobante', 'Categoría'].map((header, i) => ({ header, width: [14, 23, 12, 46, 18, 18, 18, 22, 22, 18, 18, 28, 18, 20][i] }));
  rows.getRow(1).height = 32; rows.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; rows.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF007F68' } };
  for (const e of s.movimientos) {
    const n = rows.rowCount + 1;
    const expense = e.tipo === 'gasto';
    const sent = !expense && e.sentido === 'enviado' && e.estado === 'exitoso' ? e.monto : 0;
    const received = !expense && e.sentido === 'recibido' && e.estado === 'exitoso' ? e.monto : 0;
    const row = rows.addRow([new Date(`${day(e.fecha, timeZone)}T00:00:00Z`), new Date(e.fechaRegistro), expense ? 'Gasto' : 'Pago', concept(e), e.monto / 100, expense ? e.tuParte / 100 : 0, expense ? e.pagaste / 100 : 0, sent / 100, received / 100, { formula: `ROUND(G${n}-F${n}+H${n}-I${n},2)`, result: e.efecto / 100 }, { formula: n === 2 ? `J${n}` : `ROUND(K${n - 1}+J${n},2)`, result: e.saldo / 100 }, expense ? 'Vigente' : state(e.estado), !expense && e.conComprobante ? 'Sí (en JUNTO)' : null, expense ? category(e.categoria) : null]);
    row.height = Math.max(32, Math.ceil(concept(e).length / 43) * 15);
    row.alignment = { vertical: 'middle', wrapText: true };
    row.getCell(1).numFmt = 'dd/mm/yyyy'; row.getCell(2).numFmt = 'dd/mm/yyyy hh:mm';
    for (let c = 5; c <= 11; c++) row.getCell(c).numFmt = fmt;
    row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e.efecto >= 0 ? 'FFDDF3E7' : 'FFFCE4DF' } };
  }
  rows.autoFilter = { from: 'A1', to: `N${Math.max(1, end)}` };
  rows.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' };
  summary.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return Buffer.from(await wb.xlsx.writeBuffer({ useSharedStrings: false }));
}

export function statementPdf(s: Statement, timeZone = 'America/Lima'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `Estado de cuenta - ${s.grupo.nombre}`, Author: 'JUNTO' } });
    const chunks: Buffer[] = []; doc.on('data', chunk => chunks.push(chunk)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(chunks)));
    const width = doc.page.width - 80;
    const money = (v: number) => formatMoney(v, s.grupo.moneda);
    const date = (value: string) => day(value, timeZone).split('-').reverse().join('/');
    const issued = new Intl.DateTimeFormat('es-PE', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    const col = [40, 98, 315, 393, 471];
    let y = 40;
    let inTable = false;
    const tableHeader = () => {
      doc.rect(40, y, width, 28).fill('#173D37');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      ['Fecha', 'Concepto', 'Cargo (-)', 'Abono (+)', 'Saldo neto'].forEach((label, i) => doc.text(label, col[i] + 7, y + 10, { width: [44, 203, 64, 64, 70][i], align: i > 1 ? 'right' : 'left', lineBreak: false }));
      y += 28;
    };
    const room = (height: number) => {
      if (y + height <= doc.page.height - 70) return;
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#173D37').text('JUNTO / Estado de cuenta', 40, 32, { width });
      doc.font('Helvetica').fontSize(9).fillColor('#687775').text(s.grupo.nombre, 40, 50, { width }); y = doc.y + 14;
      if (inTable) tableHeader();
    };
    const line = (label: string, amount: number, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      const h = Math.max(22, doc.heightOfString(label, { width: width - 160 }) + 8);
      room(h); doc.fillColor('#253B3B').text(label, 40, y, { width: width - 160 }); doc.text(money(amount), 40 + width - 150, y, { width: 150, align: 'right' }); y += h;
    };
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#007F68').text('JUNTO', 40, 36);
    doc.font('Helvetica').fontSize(8).fillColor('#687775').text(`Emitido: ${issued} (${timeZone})`, 310, 40, { width: width - 270, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(25).fillColor('#173D37').text('Estado de cuenta', 40, 68, { width });
    doc.font('Helvetica').fontSize(11).fillColor('#253B3B').text(s.grupo.nombre, 40, 103, { width }); y = doc.y + 11;
    doc.font('Helvetica-Bold').fontSize(9).text(`Titular: ${s.titular.nombre}`, 40, y, { width }); y = doc.y + 8;
    doc.font('Helvetica').fontSize(8).fillColor('#687775').text(groupState(s, timeZone), 40, y, { width }); y = doc.y + 8;
    doc.font('Helvetica').fontSize(8).fillColor('#687775').text(`Cuentas compartidas / Moneda: ${s.grupo.moneda} / ${s.movimientos.length} movimientos`, 40, y, { width }); y = doc.y + 14;
    const summaryY = y;
    doc.rect(40, summaryY, width, 66).fill('#EFF6F3');
    ([['Te deben', s.balance.teDeben], ['Debes', s.balance.debes], ['Saldo neto', s.totales.saldo]] as const).forEach(([label, value], i) => {
      const x = 52 + i * width / 3;
      doc.font('Helvetica').fontSize(9).fillColor('#687775').text(label, x, summaryY + 12, { width: width / 3 - 24 });
      doc.font('Helvetica-Bold').fontSize(19);
      if (doc.widthOfString(money(value)) > width / 3 - 24) doc.fontSize(13);
      doc.fillColor('#173D37').text(money(value), x, summaryY + 31, { width: width / 3 - 24, lineBreak: false });
    });
    y = summaryY + 82;
    doc.font('Helvetica').fontSize(8.5).fillColor('#687775').text('El saldo neto es lo que te deben menos lo que debes. No representa dinero en una cuenta bancaria. Solo los pagos confirmados cambian el saldo.', 40, y, { width }); y = doc.y + 17;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#173D37').text('Detalle de movimientos', 40, y); y += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#687775').text(`Gastos vigentes y pagos en orden de registro. Fecha del gasto o pago: ${timeZone}.`, 40, y, { width }); y = doc.y + 10;
    inTable = true; tableHeader();
    for (const [i, e] of s.movimientos.entries()) {
      const title = concept(e);
      const detail = e.tipo === 'gasto' ? `${money(e.monto)} - ${e.pagaste ? 'pagaste tú' : `pagó ${e.pagadorNombre}`} - tu parte ${money(e.tuParte)}` : `${money(e.monto)} - ${methodName(e.metodo)} - ${state(e.estado)}${e.conComprobante ? ' - comprobante en JUNTO' : ''}`;
      const registered = day(e.fecha, timeZone) !== day(e.fechaRegistro, timeZone) ? `Anotado el ${date(e.fechaRegistro)}` : '';
      doc.font('Helvetica-Bold').fontSize(9);
      const titleH = doc.heightOfString(title, { width: 201 });
      doc.font('Helvetica').fontSize(8);
      const detailH = doc.heightOfString(detail, { width: 201 });
      const h = Math.max(44, titleH + detailH + (registered ? 13 : 0) + 22);
      room(h);
      if (i % 2 === 0) doc.rect(40, y, width, h).fill('#F6F8F7');
      doc.font('Helvetica').fontSize(8).fillColor('#253B3B').text(date(e.fecha), col[0] + 6, y + 12, { width: 46 });
      doc.font('Helvetica-Bold').fontSize(9).text(title, col[1] + 7, y + 10, { width: 201 });
      doc.font('Helvetica').fontSize(8).fillColor('#687775').text(detail, col[1] + 7, y + 14 + titleH, { width: 201 });
      if (registered) doc.text(registered, col[1] + 7, y + 17 + titleH + detailH, { width: 201 });
      for (const [c, value] of [[2, e.efecto < 0 ? money(-e.efecto) : '-'], [3, e.efecto > 0 ? money(e.efecto) : '-'], [4, money(e.saldo)]] as const) doc.font(c === 4 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(c === 3 && e.efecto > 0 ? '#007F68' : '#253B3B').text(value, col[c] + 5, y + 12, { width: c === 4 ? width - (col[4] - 40) - 10 : 68, align: 'right', lineBreak: false });
      y += h; doc.moveTo(40, y).lineTo(40 + width, y).strokeColor('#DFE7E3').stroke();
    }
    inTable = false;
    if (!s.movimientos.length) { y += 12; doc.font('Helvetica').fontSize(10).text('Todavía no hay movimientos.', 40, y); y += 24; }
    y += 12;
    line('Saldo de cierre', s.totales.saldo, true);
    room(34); y += 10; doc.font('Helvetica-Bold').fontSize(11).fillColor('#173D37').text('Resumen de tus gastos y pagos', 40, y); y += 23;
    line('Tu parte de los gastos', s.totales.tuParte); line('Pusiste en gastos', s.totales.pagasteEnGastos); line('Pagaste a otros (confirmado)', s.totales.pagosEnviados); line('Te pagaron (confirmado)', s.totales.pagosRecibidos);
    const panels = [{ title: 'Pendientes entre personas', items: settlements(s) }, { title: 'En qué gastaste (tu parte)', items: s.porCategoria.map(c => ({ nombre: category(c.categoria), monto: c.monto })) }];
    if (Math.max(...panels.map(p => p.items.length)) <= 6) {
      const half = (width - 24) / 2;
      doc.font('Helvetica').fontSize(8.5);
      const heights = panels.map(p => p.items.map(item => Math.max(22, doc.heightOfString(item.nombre, { width: half - 88 }) + 7)));
      const height = Math.max(...heights.map(h => h.reduce((a, b) => a + b, 0))) + 30;
      room(height); y += 12;
      panels.forEach((panel, i) => {
        const x = 40 + i * (half + 24); let py = y;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#173D37').text(panel.title, x, py, { width: half }); py += 25;
        panel.items.forEach((item, j) => {
          doc.font('Helvetica').fontSize(8.5).fillColor('#253B3B').text(item.nombre, x, py, { width: half - 88 });
          doc.text(money(item.monto), x + half - 85, py, { width: 85, align: 'right', lineBreak: false }); py += heights[i][j];
        });
        if (!panel.items.length) doc.font('Helvetica').fontSize(9).fillColor('#687775').text(i === 0 ? 'Sin pendientes' : 'Sin gastos', x, py, { width: half });
      });
      y += height - 12;
    } else for (const panel of panels) { room(34); y += 12; doc.font('Helvetica-Bold').fontSize(11).text(panel.title, 40, y); y += 23; for (const item of panel.items) line(item.nombre, item.monto); }
    const pages = doc.bufferedPageRange();
    for (let p = 0; p < pages.count; p++) { doc.switchToPage(p); doc.font('Helvetica').fontSize(8).fillColor('#687775').text(`JUNTO - ${p + 1} / ${pages.count}`, 40, doc.page.height - 55, { width, align: 'right', lineBreak: false }); }
    doc.end();
  });
}
