# Junto — Divide gastos, cobra sin incomodidad

App móvil de gestión financiera grupal para el mercado peruano y latinoamericano.

## Stack

- **Mobile**: React Native + Expo SDK 51+ (Expo Router, NativeWind, Zustand, React Query)
- **Backend**: Node.js + Express + TypeScript
- **DB**: PostgreSQL 16 (via Docker) + Prisma ORM
- **Auth**: JWT (access 15min + refresh 30d)
- **Pagos**: Culqi API (Yape, Plin, Tarjeta)
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
4. **Recordatorios** — Notificaciones automáticas de deudas con escalada de presión social
5. **Pagos Yape** — Liquidar deudas directamente por Yape vía Culqi
