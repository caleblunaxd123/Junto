// Disposable local containers only. No published ports, production credentials or existing databases.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const image = process.argv[2] || 'junto-api:ci';
const suffix = randomUUID().slice(0, 8);
const network = `junto-release-qa-${suffix}`;
const database = `${network}-db`;
const api = `${network}-api`;
const ownerUrl = `postgresql://postgres:fictional-container-only@${database}:5432/junto_qa_release`;
const runtimeUrl = `postgresql://junto_app:fictional-runtime-only@${database}:5432/junto_qa_release`;
function docker(args, options = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 180_000, ...options });
  if (result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout.trim();
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  try {
    docker(['network', 'create', '--internal', network]);
    docker(['run', '-d', '--name', database, '--network', network, '-e', 'POSTGRES_PASSWORD=fictional-container-only', '-e', 'POSTGRES_DB=junto_qa_release', 'postgres:16']);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (spawnSync('docker', ['exec', database, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
      await pause(500);
    }
    assert.ok(ready, 'disposable PostgreSQL starts');
    docker(['run', '--rm', '--network', network, '-e', `DATABASE_URL=${ownerUrl}`, '--entrypoint', 'npx', image, '--no-install', 'prisma', 'migrate', 'deploy']);
    const drift = docker(['run', '--rm', '--network', network, '-e', `DATABASE_URL=${ownerUrl}`, '--entrypoint', 'npx', image, '--no-install', 'prisma', 'migrate', 'diff', '--from-url', ownerUrl, '--to-schema-datamodel', 'prisma/schema.prisma', '--script']);
    assert.match(drift, /This is an empty migration/);
    docker(['exec', '-i', database, 'psql', '-U', 'postgres', '-d', 'junto_qa_release', '-v', 'ON_ERROR_STOP=1'], { input: `
      CREATE ROLE junto_app LOGIN PASSWORD 'fictional-runtime-only';
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      GRANT USAGE ON SCHEMA public TO junto_app;
      DO $$ DECLARE t record; BEGIN
        FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO junto_app', t.tablename);
        END LOOP;
      END $$;
    ` });
    docker(['run', '-d', '--name', api, '--network', network, '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m,mode=1777', '-e', `DATABASE_URL=${runtimeUrl}`, '-e', 'JWT_SECRET=release-container-test-key-0123456789abcdef', '-e', 'FRONTEND_URL=https://junto.example.org', image]);
    const probe = `const assert=require('node:assert/strict');(async()=>{const r=await fetch('http://127.0.0.1:3000/ready');assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ready'});assert.equal(process.getuid(),1000);})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
    ready = false;
    for (let i = 0; i < 30; i++) {
      if (spawnSync('docker', ['exec', api, 'node', '-e', probe], { stdio: 'ignore' }).status === 0) { ready = true; break; }
      await pause(500);
    }
    assert.ok(ready, 'production API starts read-only, non-root, with restricted runtime DB role');
    docker(['exec', '-i', api, 'node'], { input: fs.readFileSync('ops/contabo/verify-database.cjs', 'utf8') });
    docker(['stop', '--time', '10', database]);
    docker(['exec', api, 'node', '-e', `const assert=require('node:assert/strict');(async()=>{const live=await fetch('http://127.0.0.1:3000/health');assert.equal(live.status,200);const r=await fetch('http://127.0.0.1:3000/ready');assert.equal(r.status,503);assert.deepEqual(await r.json(),{status:'not_ready'});})().catch(e=>{console.error(e.message);process.exitCode=1;});`]);
    docker(['stop', '--time', '15', api]);
    assert.equal(docker(['inspect', '--format', '{{.State.ExitCode}}', api]), '0', 'SIGTERM drains and disconnects cleanly');
    console.log('PASS: production image — clean migrations, no schema drift, restricted DB CRUD, non-root/read-only runtime, readiness failure when DB stops, graceful SIGTERM. Disposable local containers only.');
  } finally {
    // Only this invocation's randomly named containers and network are removed; no volumes exist.
    for (const name of [api, database]) spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
    spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
