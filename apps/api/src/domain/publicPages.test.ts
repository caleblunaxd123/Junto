import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import router from '../routes/public.routes';

test('beta public pages never advertise an unpublished store listing', async () => {
  const previous = { PLAY_STORE_URL: process.env.PLAY_STORE_URL, PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL };
  process.env.PLAY_STORE_URL = '';
  process.env.PUBLIC_WEB_URL = 'https://junto.lunalav.pe';
  const app = express();
  app.use(router);
  const server = createServer(app);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    let html = await (await fetch(base+'/')).text();
    assert.match(html,/fase de pruebas/);
    assert.doesNotMatch(html,/href="https:\/\/play.google.com/);
    html = await (await fetch(base+'/unirse/qa-code-12345')).text();
    assert.match(html,/fase de pruebas/);
    assert.match(html,/browser_fallback_url=https%3A%2F%2Fjunto.lunalav.pe%2F/);
    process.env.PLAY_STORE_URL = 'javascript:alert(1)';
    html = await (await fetch(base+'/')).text();
    assert.doesNotMatch(html,/javascript:|Descargar en Google Play/);
    process.env.PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.junto.app';
    html = await (await fetch(base+'/')).text();
    assert.match(html,/Descargar en Google Play/);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error ? reject(error) : resolve()));
    for (const key of ['PLAY_STORE_URL','PUBLIC_WEB_URL'] as const) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
