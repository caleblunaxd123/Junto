const {test}=require('node:test');const assert=require('node:assert/strict');
const {createServer}=require('./server.cjs');
test('beta SPA is isolated, safely reloadable and never masks missing JS with HTML',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const url of ['/app/','/app/login','/app/unirse/AbCd1234']){const r=await fetch(origin+url);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-frame-options'),'DENY');}
  for(const url of ['/api/auth/me','/app/.env','/app/%2e%2e%2f.env','/app/_expo/missing.js','/app/assets/missing.png'])assert.equal((await fetch(origin+url)).status,404,url);
  assert.equal((await fetch(origin+'/app/',{method:'POST'})).status,405);
  const manifest=await(await fetch(origin+'/app/manifest.webmanifest')).json();assert.equal(manifest.start_url,'/app/');
  const html=await(await fetch(origin+'/app/')).text();assert.match(html,/lang="es"/);assert.match(html,/manifest.webmanifest/);
 }finally{await new Promise(r=>server.close(r));}
});
