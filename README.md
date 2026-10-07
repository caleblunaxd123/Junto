# Junto — Divide gastos, cobra sin incomodidad

App móvil de gestión financiera grupal para el mercado peruano y latinoamericano.

## Stack

- **Mobile**: React Native + Expo SDK 54 (Expo Router, Zustand, React Query)
- **Backend**: Node.js + Express + TypeScript
- **DB**: PostgreSQL 16 (via Docker) + Prisma ORM
- **Auth**: JWT (access 15min + refresh 30d)
- **Pagos**: registro de pagos externos. JUNTO no cobra, custodia ni transfiere dinero; no detecta Yape/Plin automáticamente.
- **Notificaciones**: Firebase Cloud Messaging + Expo Notifications

## Inicio rápido

### Prerrequisitos
- Node.js >= 20
- Docker Desktop
- Expo Go app en tu celular

### Setup

```bash
# 1. Clonar el repo
git clone https://github.com/caleblunaxd123/Junto
cd Junto

# 2. Levantar PostgreSQL
docker compose up -d

# 3. Instalar dependencias
npm install

# 4. Configurar variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
# Editar los .env con tus credenciales

# 5. Correr migraciones
npm run db:migrate

# 6. Iniciar backend
npm run dev:api

# 7. Iniciar mobile (en otra terminal)
npm run dev:mobile
```

## Estructura

```
junto/
├── apps/
│   ├── mobile/          # React Native + Expo
│   └── api/             # Node.js + Express
├── packages/
│   └── shared/          # Tipos TypeScript compartidos
├── docker-compose.yml
└── PROGRESS.md
```

## Features MVP

1. **Auth** — Registro, login, OTP para recuperar contraseña
2. **Grupos** — Crear grupos, invitar miembros, calcular saldos
3. **Gastos** — Registrar gastos, dividir en partes iguales/exactas/porcentajes
4. **Cuentas puntuales** — Total manual o foto revisada, nombres sin registro, invitados, reparto exacto en céntimos, aportes parciales, historial, archivo y exportación de texto/imagen.
5. **Pagos externos** — Registra pagos realizados por Yape, Plin, efectivo o transferencia; el receptor confirma los pagos de grupo. No hay cobro automático ni conexión bancaria.

## Validación y estado de publicación

`npm run test --workspace=apps/api`, `node ops/test-mobile-ux.cjs`, `node ops/test-release-config.cjs`, `npm run build:api`, `npm run typecheck --workspace=apps/mobile` y `npm run lint --workspace=apps/mobile`.

La base local de QA usa localhost:5433. `ops/apply-quick-bills-local.cjs` aplica únicamente migraciones aditivas locales y conserva los registros existentes. Los scripts `ops/test-*.cjs` de integración crean datos ficticios; no envían pagos ni mensajes. Las migraciones de producción deben revisarse y aplicarse con copia de seguridad, no con un reset.

El borrador de cuenta puntual se conserva por usuario en almacenamiento privado de la app; no incluye fotos ni credenciales y no tiene cifrado adicional. El cálculo manual funciona sin red; guardar en servidor necesita conexión. Un guardado incierto conserva la solicitud inmutable y su identificador para reintentar sin duplicar. No se hacen envíos automáticos en segundo plano.

`apps/mobile/eas.json` prepara APK interno y AAB de producción. La configuración bloquea distribuciones sin API HTTPS, privacidad, canal de eliminación y correo de soporte. Tener esas variables no demuestra que sus páginas o procesos funcionen: deben verificarse antes de publicar.

Pendientes externos y de producto: entrega SMTP real, política de conservación/eliminación de registros compartidos y su implementación completa, canales públicos de soporte/privacidad, despliegue con las migraciones nuevas, revisión de vulnerabilidades, compilación firmada y pruebas fuera de Expo Go. Consulta `RELEASE_CHECKLIST.md`. Esta versión no se declara lista para Play Store.
