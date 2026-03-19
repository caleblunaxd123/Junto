-- Junto DB Schema
-- Paste this in Supabase SQL Editor and click Run

-- Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  celular VARCHAR(12),
  password_hash VARCHAR(255) NOT NULL,
  foto_url VARCHAR(500),
  email_verificado BOOLEAN DEFAULT false,
  otp_code VARCHAR(6),
  otp_expires TIMESTAMPTZ,
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  activo BOOLEAN DEFAULT true,
  expo_push_token VARCHAR(200)
);

-- Grupos
CREATE TABLE IF NOT EXISTS grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(20) DEFAULT 'amigos',
  creado_por UUID REFERENCES usuarios(id),
  link_invitacion VARCHAR(50) UNIQUE,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  activo BOOLEAN DEFAULT true
);

-- Miembros de grupos
CREATE TABLE IF NOT EXISTS grupo_miembros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID REFERENCES grupos(id),
  usuario_id UUID REFERENCES usuarios(id),
  rol VARCHAR(10) DEFAULT 'miembro',
  fecha_union TIMESTAMPTZ DEFAULT NOW(),
  activo BOOLEAN DEFAULT true,
  UNIQUE(grupo_id, usuario_id)
);

-- Gastos
CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID REFERENCES grupos(id),
  descripcion VARCHAR(200) NOT NULL,
  monto_total INTEGER NOT NULL,
  pagado_por UUID REFERENCES usuarios(id),
  categoria VARCHAR(30) DEFAULT 'otro',
  fecha TIMESTAMPTZ DEFAULT NOW(),
  creado_por UUID REFERENCES usuarios(id),
  foto_url VARCHAR(500),
  notas TEXT,
  activo BOOLEAN DEFAULT true
);

-- Participantes por gasto
CREATE TABLE IF NOT EXISTS gasto_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id UUID REFERENCES gastos(id),
  usuario_id UUID REFERENCES usuarios(id),
  monto_asignado INTEGER NOT NULL,
  pagado BOOLEAN DEFAULT false,
  fecha_pago TIMESTAMPTZ,
  UNIQUE(gasto_id, usuario_id)
);

-- Pagos procesados
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID REFERENCES grupos(id),
  pagador_id UUID REFERENCES usuarios(id),
  receptor_id UUID REFERENCES usuarios(id),
  monto INTEGER NOT NULL,
  fee_junto INTEGER,
  metodo VARCHAR(20),
  culqi_charge_id VARCHAR(100),
  estado VARCHAR(20) DEFAULT 'pendiente',
  fecha_pago TIMESTAMPTZ DEFAULT NOW()
);

-- Recordatorios
CREATE TABLE IF NOT EXISTS recordatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enviado_por UUID REFERENCES usuarios(id),
  enviado_a UUID REFERENCES usuarios(id),
  grupo_id UUID REFERENCES grupos(id),
  monto INTEGER,
  tipo VARCHAR(20),
  tono VARCHAR(20) DEFAULT 'suave',
  mensaje TEXT,
  leido BOOLEAN DEFAULT false,
  fecha_envio TIMESTAMPTZ DEFAULT NOW(),
  fecha_lectura TIMESTAMPTZ
);

-- Config recordatorios automáticos
CREATE TABLE IF NOT EXISTS config_recordatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID REFERENCES grupos(id),
  configurado_por UUID REFERENCES usuarios(id),
  activo BOOLEAN DEFAULT true,
  frecuencia_dias INTEGER DEFAULT 7,
  hora_envio VARCHAR(5) DEFAULT '09:00',
  fecha_inicio TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  token VARCHAR(500) NOT NULL,
  fecha_expiracion TIMESTAMPTZ NOT NULL,
  revocado BOOLEAN DEFAULT false,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_grupo_miembros_usuario ON grupo_miembros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gastos_grupo ON gastos(grupo_id);
CREATE INDEX IF NOT EXISTS idx_gasto_participantes_gasto ON gasto_participantes(gasto_id);
CREATE INDEX IF NOT EXISTS idx_gasto_participantes_usuario ON gasto_participantes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pagador ON pagos(pagador_id);
CREATE INDEX IF NOT EXISTS idx_recordatorios_receptor ON recordatorios(enviado_a);

-- Tabla de migraciones para Prisma (necesaria para que Prisma reconozca el schema)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  id VARCHAR(36) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  finished_at TIMESTAMPTZ,
  migration_name VARCHAR(255) NOT NULL,
  logs TEXT,
  rolled_back_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  applied_steps_count INTEGER DEFAULT 0
);
