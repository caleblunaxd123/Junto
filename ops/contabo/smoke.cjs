// Read-only deployment probes: no account creation, delivery, or money movement.
const assert = require('node:assert/strict');
const base = process.env.JUNTO_SMOKE_URL || 'http://127.0.0.1:3000';
async function request(path, options = {}) {
  return fetch(base + path, {...options, signal:AbortSignal.timeout(8000)});
}
(async () => {
  let response = await request('/ready');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(), {status:'ready'});
  response = await request('/api/auth/me');
  assert.equal(response.status,401,'Private accounts must require authentication');
  response = await request('/api/grupos');
  assert.equal(response.status,401,'Groups must require authentication');
  response = await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"email":'});
  assert.equal(response.status,400,'Malformed JSON must not crash the API');
  response = await request('/health',{headers:{Origin:'https://untrusted.example.invalid'}});
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  response = await request('/health',{headers:{Origin:'https://junto.lunalav.pe'}});
  assert.equal(response.headers.get('access-control-allow-origin'),'https://junto.lunalav.pe');
  for (const route of ['/privacidad','/eliminar-cuenta']) {
    response = await request(route);
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/text\/html/);
  }
  console.log('PASS: database readiness, private routes, malformed JSON, CORS, privacy and deletion pages. No external messages sent.');
})().catch(error=>{console.error(error.message);process.exitCode=1});
