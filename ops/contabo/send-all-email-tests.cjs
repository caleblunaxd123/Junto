// Bounded, explicitly authorized SMTP/template test. No database or real OTP state is created.
// Run from apps/api: node - --send --to=<authorized-address> < this-file
// Without --send this only validates the fixtures. Do not schedule or automatically retry it.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const notice = 'PRUEBA AUTORIZADA DE JUNTO. Todos los nombres, montos y códigos son ficticios. No has creado una cuenta, no debes pagar nada y el código 000000 no permite acceder ni cambiar una contraseña. No necesitas responder ni realizar ninguna acción.';

function parseRecipients(args, validEmail) {
  const recipients = args.filter(arg => arg.startsWith('--to=')).map(arg => arg.slice(5));
  assert.ok(recipients.length <= 2, 'Maximum two explicitly authorized recipients.');
  assert.equal(new Set(recipients).size, recipients.length, 'Duplicate recipients rejected.');
  for (const recipient of recipients) assert.ok(validEmail(recipient), 'Invalid recipient.');
  return recipients;
}

function buildExamples(renderAccountEmail, share, publicUrl, batch) {
  assert.match(batch, /^[0-9TZ-]+$/);
  const examples = ['verification', 'reset', 'welcome'].map(kind => ({
    kind, ...renderAccountEmail({kind, nombre: 'Participante de prueba', otp: '000000', publicUrl}),
  }));
  const names = ['Participante A', 'Participante B', 'Participante C'];
  const quick = share.quickBillShareMessage({
    nombre: 'Cuenta de ejemplo · división exacta', division: 'igual', totalCuenta: 10000, extras: 0,
    cobrarA: 'Organizadora de prueba', instrucciones: 'Ejemplo ficticio: no realizar ningún pago.',
    participantes: names.map((nombre, i) => ({id: `p${i}`, nombre, consumo: 0, invitado: false})),
  }, {});
  assert.deepEqual(quick.preview.rows.map(p => p.amount), [3334, 3333, 3333]);
  const group = share.groupShareMessage({
    nombre: 'Salida de ejemplo', resumen: {totalGastado: 18000, cantidadGastos: 2,
      cuentas: names.map((nombre, i) => ({nombre, tuParte: 6000, pagaste: [12000, 6000, 0][i], neto: [6000, 0, -6000][i]}))},
    saldos: [{deudorNombre: names[2], acreedorNombre: names[0], monto: 6000}],
  }, 1);
  const expense = share.expenseShareMessage({descripcion: 'Cena de ejemplo', montoTotal: 12000,
    pagador: {nombre: names[0]}, participantes: names.map(nombre => ({usuario: {nombre}, montoAsignado: 4000})),
  }, 'Salida de ejemplo');
  for (const [kind, message] of [['cuenta_rapida', quick], ['grupo', group], ['gasto', expense]]) {
    examples.push({kind, subject: message.subject,
      html: share.shareEmailHtml(message, {sentBy: 'Equipo JUNTO · prueba solicitada por Caleb'}),
      text: share.shareEmailText(message, {sentBy: 'Equipo JUNTO · prueba solicitada por Caleb'})});
  }
  return examples.map(message => {
    assert.match(message.html, /<body\b[^>]*>/i);
    assert.doesNotMatch(message.html, /<(?:script|iframe|img)\b/i);
    return {...message, subject: `PRUEBA JUNTO · ${message.kind} · ${batch}`,
      text: `${notice}\n\n${message.text}`,
      html: message.html.replace(/(<body\b[^>]*>)/i, `$1<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF3D6"><tr><td style="padding:18px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#704A00"><strong>${notice}</strong></td></tr></table>`)};
  });
}

async function main() {
  const runtime = createRequire(path.join(process.cwd(), 'package.json'));
  const {renderAccountEmail} = runtime('./dist/domain/accountEmail');
  const share = runtime('@junto/shared/share');
  const recipients = parseRecipients(process.argv, share.validShareEmail);
  const batch = new Date().toISOString().replace(/[:.]/g, '-');
  const examples = buildExamples(renderAccountEmail, share, process.env.PUBLIC_WEB_URL, batch);
  if (!process.argv.includes('--send')) {
    console.log(JSON.stringify({dryRun: true, batch, recipients, types: examples.map(e => e.kind), count: examples.length * recipients.length}));
    return;
  }
  assert.equal(process.env.NODE_ENV, 'production', 'Real tests must use the reviewed production deployment.');
  assert.equal(process.env.SMTP_HOST, 'smtp.gmail.com');
  assert.equal(process.env.SMTP_USER, 'calebluna41@gmail.com');
  assert.equal(process.env.PUBLIC_WEB_URL, 'https://junto.lunalav.pe');
  assert.ok(recipients.length, 'Specify explicitly authorized recipients with --to.');
  const {deliverWithReceipt} = runtime('./dist/lib/email');
  for (const to of recipients) {
    for (const {kind, ...message} of examples) {
      // Stop on the first failure/uncertain timeout. Repeating may create duplicate messages.
      const receipt = await deliverWithReceipt({to, ...message});
      assert.equal(receipt.accepted, true);
      console.log(JSON.stringify({batch, to, kind, subject: message.subject, ...receipt}));
    }
  }
}
module.exports = {buildExamples, parseRecipients, notice};
if (!module.parent) main().catch(() => {
  console.error('Email test stopped. Check accepted receipts before any manual retry; no credentials are logged.');
  process.exitCode = 1;
});
