# Despliegue aislado de JUNTO en Contabo

Usar SSH con `deploy` y la clave local existente; no habilitar login root ni contraseñas SSH.
El directorio es `/opt/junto`, separado de `/opt/stack` y `/opt/junto-ai`.

## Imagen

Construir desde la raíz del repositorio:

```sh
docker build -f ops/contabo/Dockerfile -t junto-api:20261008 .
```

La imagen instala solo API/shared, no Expo. El helper de compilación recalcula la pertenencia
de dependencias al grafo API y comprueba que sus versiones no cambian respecto al lockfile.
El lockfile original del repositorio no se modifica. No incluir `.env`, claves ni proyectos
Android/iOS en el contexto; `Dockerfile.dockerignore` es una lista explícita de permitidos.

## Primer arranque (solo base nueva)

1. Crear `/opt/junto` privado, copiar fuente y `compose.yml`, y construir la imagen.
2. Ejecutar `init-environment.cjs` allí con Node, con acceso de lectura al `.env` del gateway
   existente si se reutiliza IA. Genera archivos `600`; nunca imprime ni reemplaza secretos.
   El script está restringido a `/opt/junto`. No llevar bases ni usuarios locales a producción.
3. `docker compose --env-file compose.env up -d --wait db`.
4. `docker compose --env-file compose.env run --rm --no-deps migrate`.
5. Ejecutar `restrict-database.cjs` **una vez**, en la imagen, con `runtime.env`, conectado a
   `junto_data`, y el directorio `/opt/junto` montado. Separa `junto_app` (solo CRUD) del dueño
   `junto` (migraciones). No publicar la API antes de completar esto.
6. `docker compose --env-file compose.env up -d --wait api`.
7. Ejecutar `verify-database.cjs` y `smoke.cjs` dentro de la API (enviar scripts por stdin o
   montarlos en `/app/apps/api/` para resolver Prisma). Son comprobaciones sin correos ni cobros.

Nunca imprimir `docker compose config` completo, `docker inspect` con el entorno, ni los `.env`.
`config -q` valida sin mostrar credenciales. Los archivos privados pertenecen a `deploy`, modo 600.

## Actualizaciones

Respaldar con `sh /opt/junto/backup.sh`. Probar la restauración en una base **nueva de ensayo**,
nunca encima de `junto`. Mantener una copia externa cifrada y un plan de recuperación.
Construir/auditar una imagen con etiqueta nueva, conservar la anterior para rollback.
Con la imagen elegida en `compose.env`, aplicar `run --rm --no-deps migrate`, después `up -d --wait api`.
No usar `db push`, `migrate dev`, `down -v` ni modificar bases de otras apps.

La API ejecuta como `node`, disco de solo lectura y `/tmp` limitado para OCR. No tiene puertos
publicados; solo Caddy accede a `junto-api:3000` por `stack_web`. PostgreSQL solo existe en
`junto_data`, red interna. `/ready` comprueba la conexión a la base; `/health` es liveness y muestra
el proveedor de correo **configurado**, no una prueba de entrega SMTP.

## Dominio y correo

El DNS A `junto.lunalav.pe` apunta a `217.216.82.43`, inicialmente Solo DNS. Caddy emite el
certificado público y redirige HTTP a HTTPS. Respaldar y validar cualquier candidato al Caddyfile,
añadir solo el host JUNTO y recargar Caddy sin reiniciar las otras apps. Mantener el archivo original
y su hash para evitar pisar cambios concurrentes. Si después se activa proxy de Cloudflare,
configurar Full (strict) solo para JUNTO y verificar IP del cliente/rate limits; no usar Flexible
ni modificar SSL de toda la zona.

SMTP no se configura hasta pasar `email:check`. La contraseña de aplicación la crea el dueño en
Google y la guarda en el archivo local privado. Nunca enviarla por chat o Git. El proyecto OAuth
de Google Cloud sirve para login, **no** para SMTP. Probar entrega real únicamente al correo
autorizado. Gmail/Outlook por compositor y WhatsApp no equivalen a envío confirmado por servidor.

Antes de distribuir: SMTP/OTP real, EAS y firma Android, OAuth compatible con esa firma,
App Links, FCM, legal responsable, pruebas en dispositivos. Para iPhone sin membresía Apple
se necesita implementar y verificar una versión web; las páginas públicas de esta API no son esa app.
