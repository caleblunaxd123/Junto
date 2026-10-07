# Migraciones de base de datos

Las migraciones viven en `prisma/migrations` y **se versionan en git**. Producción
se actualiza solo con `prisma migrate deploy`; nunca con parches manuales ni con
`prisma migrate dev`.

## Flujo diario

```bash
# 1. Cambia prisma/schema.prisma
# 2. Genera la migración contra tu base local
npm run prisma:migrate -- --name descripcion_corta
# 3. Revisa el SQL generado y súbelo junto con el cambio de schema
git add prisma/schema.prisma prisma/migrations
```

En el servidor (o en el paso de despliegue):

```bash
npm run prisma:deploy   # aplica solo las migraciones pendientes
npm run prisma:status   # muestra qué falta aplicar
```

`npm run start:migrate` aplica migraciones pendientes y luego arranca la API.
Úsalo como comando de inicio en Render **después** de hacer la línea base de abajo.

## Base de datos nueva

`npm run prisma:deploy` crea todo desde `0_init`.

## Base de datos existente (creada con schema.sql y parches) — una sola vez

La base actual de producción ya tiene las tablas, así que `0_init` no debe
ejecutarse allí. Pasos:

1. Haz un respaldo (`pg_dump`) y verifica que se puede restaurar.
2. Aplica los parches aditivos que aún falten (todos son idempotentes):
   `prisma/patches/*.sql` y `ops/sql/*.sql`.
3. Comprueba la diferencia con el baseline:
   ```bash
   npx prisma migrate diff --from-url "$DATABASE_URL" \
     --to-schema-datamodel prisma/schema.prisma --script
   ```
   Debe mostrar solo la columna `fecha_eliminacion` (u otras diferencias que
   entiendas y aceptes). Si aparece algo inesperado, detente y revísalo.
4. Marca la línea base como aplicada y aplica el resto:
   ```bash
   npx prisma migrate resolve --applied 0_init
   npm run prisma:deploy
   ```
5. Cambia el comando de inicio a `npm run start:migrate`.

`prisma/schema.sql` y `prisma/patches/` se conservan solo como historial.
