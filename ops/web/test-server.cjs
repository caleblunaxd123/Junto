const {test}=require('node:test');const assert=require('node:assert/strict');
const {createServer}=require('./server.cjs');
const fs=require('node:fs');const path=require('node:path');
const os=require('node:os');
test('beta SPA is isolated, safely reloadable and never masks missing JS with HTML',async()=>{
 // The server contract must work in a clean checkout, without an ignored local beta export.
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'junto-web-qa-'));
 fs.writeFileSync(path.join(fixture,'index.html'),'<html lang="es"><link rel="manifest" href="/app/manifest.webmanifest"><body>JUNTO QA</body></html>');
 fs.writeFileSync(path.join(fixture,'manifest.webmanifest'),JSON.stringify({start_url:'/app/'}));
 fs.mkdirSync(path.join(fixture,'descargas'));
 const sample=Buffer.from('fictional download fixture, not an Android build');
 fs.writeFileSync(path.join(fixture,'descargas','sample.apk'),sample);
 const server=createServer(fixture);await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const url of ['/app/','/app/login','/app/unirse/AbCd1234']){const r=await fetch(origin+url);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-frame-options'),'DENY');}
  for(const url of ['/api/auth/me','/app/.env','/app/%2e%2e%2f.env','/app/_expo/missing.js','/app/assets/missing.png','/app/descargas/missing.apk'])assert.equal((await fetch(origin+url)).status,404,url);
  assert.equal((await fetch(origin+'/app/',{method:'POST'})).status,405);
  const manifest=await(await fetch(origin+'/app/manifest.webmanifest')).json();assert.equal(manifest.start_url,'/app/');
  const htmlResponse=await fetch(origin+'/app/');
  assert.equal(htmlResponse.headers.get('cross-origin-opener-policy'),'same-origin-allow-popups');
  assert.equal(htmlResponse.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
  const csp=htmlResponse.headers.get('content-security-policy');
  assert.match(csp,/script-src 'self' https:\/\/accounts.google.com\/gsi\/client;/);
  assert.match(csp,/frame-src https:\/\/accounts.google.com\/gsi\//);
  assert.ok(!csp.includes('unsafe-eval') && !csp.includes('script-src *'));
  const html=await htmlResponse.text();assert.match(html,/lang="es"/);assert.match(html,/manifest.webmanifest/);
  const download=await fetch(origin+'/app/descargas/sample.apk',{method:'HEAD'});
  assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/vnd.android.package-archive');
  assert.equal(download.headers.get('content-disposition'),'attachment; filename="sample.apk"');
  assert.equal(Number(download.headers.get('content-length')),sample.length);
  assert.equal(download.headers.get('cache-control'),'no-store');
 }finally{
  await new Promise(r=>server.close(r));
  for(const file of ['index.html','manifest.webmanifest','descargas/sample.apk'])fs.unlinkSync(path.join(fixture,file));
  fs.rmdirSync(path.join(fixture,'descargas'));fs.rmdirSync(fixture);
 }
});
const apk=path.resolve(__dirname,'../../apps/mobile/dist-beta/descargas/JUNTO-beta-20261010.apk');
test('published beta APK has Android MIME, attachment disposition and exact length',{skip:!fs.existsSync(apk)},async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/app/descargas/JUNTO-beta-20261010.apk`,{method:'HEAD'});
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/vnd.android.package-archive');
  assert.equal(response.headers.get('content-disposition'),'attachment; filename="JUNTO-beta-20261010.apk"');
  assert.equal(Number(response.headers.get('content-length')),fs.statSync(apk).size);
  assert.equal(response.headers.get('cache-control'),'no-store');
 }finally{await new Promise(r=>server.close(r));}
});
