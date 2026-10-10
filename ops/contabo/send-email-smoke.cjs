// Explicitly authorized technical test only; do not accept arbitrary recipient arguments.
const {deliverWithReceipt} = require('./dist/lib/email');
const {renderAccountEmail} = require('./dist/domain/accountEmail');
const {describeError} = require('./dist/lib/logSafe');
(async()=>{
  const recipient='calebluna41@gmail.com';
  const message=renderAccountEmail({kind:'welcome',nombre:'Prueba de JUNTO',publicUrl:process.env.PUBLIC_WEB_URL});
  const receipt=await deliverWithReceipt({to:recipient,...message,
    subject:`JUNTO · Prueba SMTP desde Contabo · ${Date.now()}`,
    text:'Prueba técnica autorizada. No crea cuentas, gastos ni pagos reales.\n\n'+message.text,
    html:message.html.replace('</body>','<p style="text-align:center;color:#64748b;font-size:12px">Prueba técnica autorizada. No crea cuentas, gastos ni pagos reales.</p></body>'),
  });
  console.log(JSON.stringify({recipient,...receipt,delivery:'Acceptance is not proof of inbox delivery; check Gmail using providerId.'}));
})().catch(error=>{console.error(describeError(error));process.exitCode=1});
