// Check gateway connectivity/authentication without invoking inference or printing credentials.
const assert = require('node:assert/strict');
(async()=>{
  assert.equal(process.env.JUNTO_AI_BASE_URL,'http://junto-ai-gateway:8080');
  assert.ok(process.env.JUNTO_AI_API_KEY,'Private gateway credential is not configured');
  const url = process.env.JUNTO_AI_BASE_URL;
  let result = await fetch(url+'/health',{signal:AbortSignal.timeout(5000)});
  assert.equal(result.status,200);
  const options = {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:''}),signal:AbortSignal.timeout(5000)};
  result = await fetch(url+'/v1/extract-expense',options);
  assert.equal(result.status,401);
  result = await fetch(url+'/v1/extract-expense',{...options,headers:{...options.headers,Authorization:'Bearer '+process.env.JUNTO_AI_API_KEY}});
  assert.equal(result.status,400,'Authenticated validation should reject empty text without inference');
  console.log('PASS: private AI gateway reachable, anonymous calls rejected, API credential accepted. No inference or messages.');
})().catch(()=>{console.error('AI connectivity/authentication check failed; no credentials logged.');process.exitCode=1});
