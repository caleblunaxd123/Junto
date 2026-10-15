// Real Axios interceptors, in-memory credentials and adapters only: no network or native modules.
const test = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const axios = require('axios');
const credentials = new Map();
const storagePath = require.resolve('../apps/mobile/src/lib/tokenStorage.ts');
require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: {
  getItemAsync: async key => credentials.get(key) ?? null,
  setItemAsync: async (key, value) => { credentials.set(key, value); },
  deleteItemAsync: async key => { credentials.delete(key); },
} };
const { api, onSessionExpired } = require('../apps/mobile/src/lib/api.ts');
const { beginSession } = require('../apps/mobile/src/lib/sessionGeneration.ts');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const ok = (config, data) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const unauthorized = config => new axios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null, { config, status: 401, data: {}, headers: {} });
function initialize() { beginSession(); credentials.clear(); credentials.set('accessToken', 'old-access'); credentials.set('refreshToken', 'old-refresh'); }

test('an old 401 cannot retry a profile edit with the newly signed-in account', async () => {
  initialize(); const response = deferred(); let requests = 0, refreshes = 0;
  api.defaults.adapter = async config => { requests++; await response.promise; throw unauthorized(config); };
  axios.defaults.adapter = async config => { refreshes++; return ok(config, { accessToken: 'unexpected', refreshToken: 'unexpected' }); };
  const pending = api.patch('/auth/me', { nombre: 'Old account name' });
  await new Promise(resolve => setImmediate(resolve));
  beginSession(); credentials.set('accessToken', 'new-access'); credentials.set('refreshToken', 'new-refresh');
  const rejected = assert.rejects(pending, error => axios.isCancel(error));
  response.resolve(); await rejected;
  assert.equal(requests, 1); assert.equal(refreshes, 0);
  assert.equal(credentials.get('accessToken'), 'new-access');
});

test('a refresh finishing after logout cannot restore the old credentials', async () => {
  initialize(); const started = deferred(), response = deferred(); let expired = 0;
  onSessionExpired(() => expired++);
  api.defaults.adapter = async config => { throw unauthorized(config); };
  axios.defaults.adapter = async config => { started.resolve(); await response.promise; return ok(config, { accessToken: 'rotated-old', refreshToken: 'rotated-old-refresh' }); };
  const pending = api.get('/auth/me'); await started.promise;
  beginSession(); credentials.clear();
  const rejected = assert.rejects(pending, error => axios.isCancel(error));
  response.resolve(); await rejected;
  assert.equal(credentials.size, 0); assert.equal(expired, 0);
});

test('concurrent requests in the same session still rotate once and both retry successfully', async () => {
  initialize(); const started = deferred(), response = deferred(); let refreshes = 0;
  api.defaults.adapter = async config => {
    if (config.headers.Authorization === 'Bearer old-access') throw unauthorized(config);
    assert.equal(config.headers.Authorization, 'Bearer rotated-access');
    return ok(config, { safe: true });
  };
  axios.defaults.adapter = async config => { refreshes++; started.resolve(); await response.promise; return ok(config, { accessToken: 'rotated-access', refreshToken: 'rotated-refresh' }); };
  const first = api.get('/grupos'), second = api.get('/actividad');
  await started.promise; await new Promise(resolve => setImmediate(resolve)); response.resolve();
  const results = await Promise.all([first, second]);
  assert.equal(refreshes, 1); assert.ok(results.every(result => result.data.safe));
  assert.equal(credentials.get('refreshToken'), 'rotated-refresh');
});

test('a successful response from the old account is discarded after switching accounts', async () => {
  initialize(); const response = deferred();
  api.defaults.adapter = async config => { await response.promise; return ok(config, { nombre: 'Private old profile' }); };
  const pending = api.get('/auth/me'); await new Promise(resolve => setImmediate(resolve)); beginSession();
  const rejected = assert.rejects(pending, error => axios.isCancel(error));
  response.resolve(); await rejected;
});

test('a new account can refresh independently while the old account refresh is still pending', async () => {
  initialize(); const oldStarted = deferred(), oldResponse = deferred(); let refreshes = 0;
  api.defaults.adapter = async config => {
    if (config.headers.Authorization !== 'Bearer fresh-new-access') throw unauthorized(config);
    return ok(config, { safe: true });
  };
  axios.defaults.adapter = async config => {
    refreshes++;
    if (JSON.parse(config.data).refreshToken === 'old-refresh') {
      oldStarted.resolve(); await oldResponse.promise;
      return ok(config, { accessToken: 'stale-old-access', refreshToken: 'stale-old-refresh' });
    }
    return ok(config, { accessToken: 'fresh-new-access', refreshToken: 'fresh-new-refresh' });
  };
  const old = api.get('/grupos'); await oldStarted.promise;
  const rejected = assert.rejects(old, error => axios.isCancel(error));
  beginSession(); credentials.set('accessToken', 'new-expired'); credentials.set('refreshToken', 'new-refresh');
  assert.equal((await api.get('/actividad')).data.safe, true);
  oldResponse.resolve(); await rejected;
  assert.equal(refreshes, 2);
  assert.equal(credentials.get('accessToken'), 'fresh-new-access');
  assert.equal(credentials.get('refreshToken'), 'fresh-new-refresh');
});
