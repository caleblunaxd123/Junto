// Ephemeral container test: database deliberately unreachable, no ports or external network.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const child = spawn(process.execPath,['dist/index.js'],{
  cwd:'/app/apps/api',stdio:'ignore',env:{...process.env,NODE_ENV:'production',PORT:'3000',
    JWT_SECRET:crypto.randomBytes(48).toString('hex'),FRONTEND_URL:'https://junto.lunalav.pe',
    DATABASE_URL:'postgresql://unreachable:unreachable@127.0.0.1:9/unreachable?connect_timeout=1&pool_timeout=1'},
});
(async()=>{
  let live;
  for (let attempt=0;attempt<30;attempt++) {
    live = await fetch('http://127.0.0.1:3000/health',{signal:AbortSignal.timeout(1000)}).catch(()=>undefined);
    if (live) break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(live?.status,200,'Liveness should start independently of the DB');
  const ready = await fetch('http://127.0.0.1:3000/ready',{signal:AbortSignal.timeout(5000)});
  assert.equal(ready.status,503);
  assert.deepEqual(await ready.json(),{status:'not_ready'});
  console.log('PASS: unavailable database returns readiness 503, not a false healthy response. No details leaked.');
})().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>child.kill('SIGTERM'));
