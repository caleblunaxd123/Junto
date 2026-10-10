// Export only the authorized Gmail SMTP fields, never JWT/database/local development settings.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dotenv = require('dotenv');
function smtpTransferConfig(input) {
  const host = (input.SMTP_HOST || '').trim().toLowerCase();
  const user = (input.SMTP_USER || '').trim().toLowerCase();
  const port = Number(input.SMTP_PORT || 587);
  const pass = (input.SMTP_PASS || '').replace(/\s/g,'');
  if (host !== 'smtp.gmail.com' || ![465,587].includes(port)) throw new Error('Use Gmail SMTP with TLS on port 465 or 587');
  if (!['calebluna41@gmail.com','lunalav2026@gmail.com'].includes(user)) throw new Error('SMTP sender is not one of the owner-authorized accounts');
  if (!/^[A-Za-z0-9]{16}$/.test(pass)) throw new Error('Expected a Google application password; no credential values logged');
  return {SMTP_HOST:host,SMTP_PORT:String(port),SMTP_USER:user,SMTP_PASS:pass,EMAIL_FROM:`JUNTO <${user}>`};
}
module.exports = {smtpTransferConfig};
if (require.main === module) {
  try {
    const config = smtpTransferConfig(dotenv.parse(fs.readFileSync(process.argv[2])));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'junto-smtp-'));
    const file = path.join(dir,'smtp.env');
    fs.writeFileSync(file,Object.entries(config).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
    console.log(file); // Only the generated path, never the credential.
  } catch {
    console.error('SMTP staging failed. Check host, authorized sender, TLS port and application-password format. No secrets logged.');
    process.exitCode=1;
  }
}
