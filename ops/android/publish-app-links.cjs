// On the VPS: add only the verified APK's public certificate. Never print private env.
const fs = require('node:fs');
const fingerprint = (process.argv[2] || '').toUpperCase();
if (!/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint)) throw new Error('Expected SHA-256 certificate fingerprint');
const file = '/opt/junto/runtime.env';
const original = fs.readFileSync(file, 'utf8');
if (!/^NODE_ENV=production\s*$/m.test(original) || !/^PUBLIC_WEB_URL=https:\/\/junto\.lunalav\.pe\s*$/m.test(original)) throw new Error('Unexpected deployment');
const existing = (original.match(/^ANDROID_SHA256_CERT_FINGERPRINTS=(.*)$/m)?.[1] || '').trim().split(',').filter(Boolean);
if (existing.some(value => !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(value))) throw new Error('Unexpected certificate configuration');
const fingerprints = [...new Set([...existing.map(value => value.toUpperCase()), fingerprint])];
if (existing.includes(fingerprint)) { console.log('Public certificate already configured'); process.exit(0); }
const updated = original.split(/\r?\n/).filter(line => !line.startsWith('ANDROID_SHA256_CERT_FINGERPRINTS=')).join('\n').trimEnd() + '\nANDROID_SHA256_CERT_FINGERPRINTS=' + fingerprints.join(',') + '\n';
fs.writeFileSync(file + '.before-app-links-' + Date.now(), original, { flag: 'wx', mode: 0o600 });
fs.writeFileSync(file + '.app-links-staged', updated, { flag: 'wx', mode: 0o600 });
fs.renameSync(file + '.app-links-staged', file);
console.log('Only public App Links certificate updated; private rollback preserved');
