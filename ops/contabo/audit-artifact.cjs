// npm audits the whole workspace lockfile, including packages NOT shipped in this image.
// Report only vulnerable paths physically installed in this API artifact; retain the raw
// advisory totals to make the scope distinction explicit. Run from /app in the runtime image.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const result = spawnSync('npm', ['audit', '--omit=dev', '--workspace=apps/api', '--json'], {encoding:'utf8', maxBuffer:8*1024*1024});
if (result.error) throw result.error;
let report;
try { report = JSON.parse(result.stdout); } catch { throw new Error('npm audit did not return a valid advisory report'); }
if (report.error || !report.vulnerabilities) throw new Error('Advisory service unavailable; audit is inconclusive');
const shipped = Object.entries(report.vulnerabilities).flatMap(([name, entry]) => {
  const installed = (entry.nodes || []).filter(node => fs.existsSync(path.join(node,'package.json')));
  return installed.length ? [{name, severity:entry.severity, paths:installed, advisories:entry.via.filter(item=>typeof item==='object').map(({title,url,range})=>({title,url,range}))}] : [];
});
console.log(JSON.stringify({scope:'physically installed API artifact; not Expo or host OS', lockfileTotals:report.metadata?.vulnerabilities, installedVulnerabilities:shipped}, null, 2));
process.exitCode = shipped.some(item=>['high','critical'].includes(item.severity)) ? 1 : 0;
