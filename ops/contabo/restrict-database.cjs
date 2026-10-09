// One-time setup after migrating a NEW JUNTO database, before public exposure.
// The API must not retain the database owner's credentials. Never log either password.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const dir = '/opt/junto';
if (!fs.existsSync(`${dir}/runtime.env`) || !fs.existsSync(`${dir}/migration.env`)) throw new Error('Initialize private server environments first');
const original = fs.readFileSync(`${dir}/runtime.env`,'utf8');
const ownerUrl = new URL(process.env.DATABASE_URL);
if (ownerUrl.hostname !== 'db' || ownerUrl.pathname !== '/junto' || ownerUrl.username !== 'junto') throw new Error('Only the new, isolated JUNTO database is allowed');
if (!fs.readFileSync(`${dir}/migration.env`,'utf8').split('\n').includes(`DATABASE_URL=${ownerUrl.href}`)) throw new Error('Migration owner configuration does not match; refusing to change database roles');
const db = new PrismaClient();
(async()=>{
  const password = crypto.randomBytes(32).toString('hex');
  await db.$transaction(async tx => {
    const found = await tx.$queryRaw`SELECT rolname FROM pg_roles WHERE rolname = 'junto_app'`;
    if (found.length) throw new Error('Existing role preserved; refusing to replace credentials');
    // Password is generated hex, not user-controlled SQL.
    await tx.$executeRawUnsafe(`CREATE ROLE junto_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    await tx.$executeRawUnsafe('GRANT CONNECT ON DATABASE junto TO junto_app');
    await tx.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO junto_app');
    await tx.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO junto_app');
    await tx.$executeRawUnsafe('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO junto_app');
    await tx.$executeRawUnsafe('REVOKE ALL ON TABLE public._prisma_migrations FROM junto_app');
    await tx.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES FOR ROLE junto IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO junto_app');
    await tx.$executeRawUnsafe('ALTER DEFAULT PRIVILEGES FOR ROLE junto IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO junto_app');
  });
  ownerUrl.username='junto_app'; ownerUrl.password=password;
  fs.writeFileSync(`${dir}/runtime.env`, original.replace(/^DATABASE_URL=.+$/m,`DATABASE_URL=${ownerUrl.href}`), {mode:0o600});
  console.log('API database role restricted; owner credentials isolated in migration.env.');
})().catch(()=>{console.error('Database restriction did not complete. Existing roles/credentials were not replaced; inspect state without printing secrets before retrying.');process.exitCode=1}).finally(()=>db.$disconnect());
