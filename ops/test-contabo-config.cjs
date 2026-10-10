const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = file => fs.readFileSync(file,'utf8');
test('production isolates the database and never publishes API/DB ports', () => {
  const config = read('ops/contabo/compose.yml');
  assert.doesNotMatch(config,/^\s*ports:/m);
  assert.match(config,/internal: true/);
  assert.match(config,/read_only: true/);
  assert.match(config,/no-new-privileges:true/);
  assert.match(config,/cap_drop: \[ALL\]/);
  assert.match(config,/tmpfs: \['\/tmp:rw,noexec,nosuid,size=256m,mode=1777'\]/);
  assert.match(config,/\/ready/);
});
test('private environments are excluded and runtime is non-root with API-only graph', () => {
  const docker = read('ops/contabo/Dockerfile');
  assert.match(docker,/USER node/);
  assert.match(docker,/prepare-runtime.cjs --verify/);
  assert.match(docker,/npm ci --omit=dev/);
  const ignore = read('ops/contabo/Dockerfile.dockerignore');
  assert.ok(ignore.startsWith('# Allow-list'));
  assert.match(ignore,/\*\*\/\.env\*/);
  const prepare = read('ops/contabo/prepare-runtime.cjs');
  assert.match(prepare,/manifest.workspaces = \['apps\/api','packages\/shared'\]/);
});
test('server initializer refuses overwrites, creates private credentials, and never enables fake email', () => {
  const script = read('ops/contabo/init-environment.cjs');
  assert.match(script,/dir !== '\/opt\/junto'/);
  assert.match(script,/refusing to overwrite/);
  assert.match(script,/mode:0o600/);
  assert.match(script,/randomBytes\(48\)/);
  assert.doesNotMatch(script,/SMTP_PASS\s*:|EMAIL_DEV_LOG\s*:/);
});
