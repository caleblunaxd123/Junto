// Run after successful SMTP preflight on the VPS. Preserve a private rollback of runtime.env.
const fs = require('node:fs');
const dotenv = require('dotenv');
const {smtpTransferConfig} = require('./stage-smtp.cjs');
const dir = '/opt/junto';
try {
  const original = fs.readFileSync(`${dir}/runtime.env`,'utf8');
  const env = dotenv.parse(original);
  if (env.NODE_ENV !== 'production' || env.PUBLIC_WEB_URL !== 'https://junto.lunalav.pe' || env.RESEND_API_KEY) throw new Error('Unexpected deployment/provider; refusing to overwrite');
  const smtp = smtpTransferConfig(dotenv.parse(fs.readFileSync(`${dir}/smtp.env.staged`,'utf8')));
  // Never enable OTP or credential logging in production.
  const remove = new Set([...Object.keys(smtp),'EMAIL_DEV_LOG','SMTP_ALLOW_INSECURE_LOCAL']);
  const updated = original.split(/\r?\n/).filter(line=>!remove.has(line.split('=')[0])).join('\n').trimEnd()+'\n'+Object.entries(smtp).map(([k,v])=>`${k}=${v}`).join('\n')+'\n';
  const backup = `${dir}/runtime.env.before-smtp-${Date.now()}`;
  fs.writeFileSync(backup,original,{flag:'wx',mode:0o600});
  fs.writeFileSync(`${dir}/runtime.env`,updated,{mode:0o600});
  fs.chmodSync(`${dir}/runtime.env`,0o600);
  console.log('SMTP configuration applied; private rollback preserved. Restart only the JUNTO API.');
} catch {
  console.error('SMTP configuration was not completed. Inspect state without printing credentials; do not blindly retry.');
  process.exitCode=1;
}
