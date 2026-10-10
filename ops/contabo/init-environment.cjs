// Run on the server in /opt/junto. Never print secrets, never overwrite existing credentials.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const dir = path.resolve(process.argv[2] || '.');
if (dir !== '/opt/junto') throw new Error('This initializer is restricted to /opt/junto');
const files = ['runtime.env', 'compose.env', 'migration.env'];
if (files.some(file => fs.existsSync(path.join(dir, file)))) throw new Error('Existing credentials preserved; refusing to overwrite');
const dbPassword = crypto.randomBytes(32).toString('hex');
const runtime = {
  NODE_ENV: 'production', PORT: '3000',
  DATABASE_URL: `postgresql://junto:${dbPassword}@db:5432/junto?connection_limit=10&connect_timeout=3&pool_timeout=5`,
  JWT_SECRET: crypto.randomBytes(48).toString('hex'),
  EMAIL_HASH_SECRET: crypto.randomBytes(48).toString('hex'),
  PUBLIC_WEB_URL: 'https://junto.lunalav.pe', FRONTEND_URL: 'https://junto.lunalav.pe',
  SUPPORT_EMAIL: 'calebluna41@gmail.com', ANDROID_PACKAGE: 'com.junto.app',
  GOOGLE_CLIENT_IDS: '253075267195-330gge6bekhdpaigel7ouv4livbpqcvj.apps.googleusercontent.com',
};
// Only reuse the existing gateway key locally on the VPS; it never enters Git or this output.
const aiFile = '/opt/junto-ai/.env';
if (fs.existsSync(aiFile)) {
  const value = fs.readFileSync(aiFile, 'utf8').match(/^JUNTO_AI_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  if (value && !/[\r\n]/.test(value)) {
    runtime.JUNTO_AI_BASE_URL = 'http://junto-ai-gateway:8080';
    runtime.JUNTO_AI_API_KEY = value;
  }
}
fs.writeFileSync(path.join(dir, 'runtime.env'), Object.entries(runtime).map(([k,v])=>`${k}=${v}`).join('\n')+'\n', {flag:'wx', mode:0o600});
fs.writeFileSync(path.join(dir, 'migration.env'), `DATABASE_URL=${runtime.DATABASE_URL}\n`, {flag:'wx', mode:0o600});
fs.writeFileSync(path.join(dir, 'compose.env'), `DB_PASSWORD=${dbPassword}\nJUNTO_IMAGE=junto-api:20261008\n`, {flag:'wx', mode:0o600});
console.info('Private server environment created. SMTP is intentionally NOT configured until authentication succeeds.');
