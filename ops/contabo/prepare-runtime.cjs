// Narrow npm's workspace graph in the IMAGE, without changing the repository or mobile lockfile.
const fs = require('node:fs');
if (process.cwd() !== '/app') throw new Error('This build helper only runs in /app');
const lock = JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const versions = {};
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location.includes('node_modules/') || !entry.version) continue;
  const name = location.split('node_modules/').pop();
  (versions[name] ||= []).push(entry.version);
}
if (process.argv.includes('--verify')) {
  const original = JSON.parse(fs.readFileSync('/tmp/junto-original-versions.json','utf8'));
  for (const [name, installed] of Object.entries(versions)) {
    if (installed.some(version=>!original[name]?.includes(version))) throw new Error(`Unexpected dependency version change: ${name}`);
  }
  console.log('API-only dependency graph preserves repository package versions.');
  process.exit(0);
}
fs.writeFileSync('/tmp/junto-original-versions.json', JSON.stringify(versions));
const manifest = JSON.parse(fs.readFileSync('package.json','utf8'));
manifest.workspaces = ['apps/api','packages/shared'];
fs.writeFileSync('package.json', JSON.stringify(manifest,null,2)+'\n');
