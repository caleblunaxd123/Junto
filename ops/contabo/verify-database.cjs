const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async()=>{
  const [role] = await db.$queryRaw`SELECT current_user AS name, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`;
  assert.equal(role.name,'junto_app');
  assert.equal(role.rolsuper,false);
  assert.equal(role.rolcreatedb,false);
  assert.equal(role.rolcreaterole,false);
  const [permissions] = await db.$queryRaw`SELECT has_schema_privilege(current_user,'public','CREATE') AS create_schema, has_table_privilege(current_user,'public._prisma_migrations','UPDATE') AS update_migrations`;
  assert.equal(permissions.create_schema,false);
  assert.equal(permissions.update_migrations,false);
  assert.equal(await db.usuario.count(),0,'Do not silently import local QA users into production');
  console.log('PASS: API role is non-owner, cannot create schema or alter migration history; new production database contains no QA accounts.');
})().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>db.$disconnect());
