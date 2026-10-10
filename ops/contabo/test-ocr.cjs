// Synthetic QA receipt only; run in an ephemeral network-disabled runtime container.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { readReceipt } = require('./dist/services/receipt.service');
const started = Date.now();
readReceipt(fs.readFileSync('/tmp/qa-receipt.png').toString('base64')).then(result=>{
  assert.equal(result.totalPropuesto,18000);
  console.log(JSON.stringify({result:'PASS',syntheticReceiptCents:18000,elapsedMs:Date.now()-started,network:'disabled'}));
  process.exit(0);
}).catch(error=>{console.error(error.message);process.exit(1)});
