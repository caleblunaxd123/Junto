// ─── Users ────────────────────────────────────────────────────────────────────

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  celular?: string | null;
  fotoUrl?: string | null;
  emailVerificado: boolean;
  fechaRegistro: string;
  expoPushToken?: string | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  usuario: Usuario;
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export type GrupoTipo = 'viaje' | 'roomies' | 'amigos' | 'trabajo' | 'otro';
export type MiembroRol = 'admin' | 'miembro';

export interface GrupoMiembro {
  id: string;
  grupoId: string;
  usuarioId: string;
  rol: MiembroRol;
  fechaUnion: string;
  activo: boolean;
  usuario: Pick<Usuario, 'id' | 'nombre' | 'email' | 'fotoUrl'>;
}

export interface Grupo {
  id: string;
  nombre: string;
  descripcion?: string | null;
  tipo: GrupoTipo;
  creadoPor: string;
  linkInvitacion?: string | null;
  fechaCreacion: string;
  activo: boolean;
  miembros: GrupoMiembro[];
}

export interface GrupoConBalance extends Grupo {
  balanceUsuario: {
    teDeben: number; // en centavos
    debes: number;   // en centavos
    neto: number;    // en centavos, positivo = te deben
  };
  rolUsuario: MiembroRol;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export type GastoCategoria =
  | 'comida'
  | 'transporte'
  | 'entretenimiento'
  | 'alojamiento'
  | 'compras'
  | 'otro';

export type TipoDivision = 'igual' | 'exacto' | 'porcentaje';

export interface GastoParticipante {
  id: string;
  gastoId: string;
  usuarioId: string;
  montoAsignado: number; // en centavos
  pagado: boolean;
  fechaPago?: string | null;
  usuario: Pick<Usuario, 'id' | 'nombre' | 'fotoUrl'>;
}

export interface Gasto {
  id: string;
  grupoId: string;
  descripcion: string;
  montoTotal: number; // en centavos
  pagadoPor: string;
  categoria: GastoCategoria;
  fecha: string;
  creadoPor: string;
  fotoUrl?: string | null;
  notas?: string | null;
  activo: boolean;
  participantes: GastoParticipante[];
  pagador: Pick<Usuario, 'id' | 'nombre' | 'fotoUrl'>;
  creador: Pick<Usuario, 'id' | 'nombre'>;
}

// ─── Balances ─────────────────────────────────────────────────────────────────

export interface Saldo {
  deudorId: string;
  deudorNombre: string;
  acreedorId: string;
  acreedorNombre: string;
  monto: number; // en centavos
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export type MetodoPago = 'yape' | 'plin' | 'tarjeta';
export type EstadoPago = 'pendiente' | 'exitoso' | 'fallido';

export interface Pago {
  id: string;
  grupoId: string;
  pagadorId: string;
  receptorId: string;
  monto: number; // en centavos
  feejunto?: number | null; // en centavos
  metodo?: MetodoPago | null;
  culqiChargeId?: string | null;
  estado: EstadoPago;
  fechaPago: string;
  pagador: Pick<Usuario, 'id' | 'nombre' | 'fotoUrl'>;
  receptor: Pick<Usuario, 'id' | 'nombre' | 'fotoUrl'>;
  grupo: Pick<Grupo, 'id' | 'nombre'>;
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export type TonoRecordatorio = 'suave' | 'directo' | 'urgente';
export type TipoRecordatorio = 'manual' | 'automatico';

export interface Recordatorio {
  id: string;
  enviadoPor: string;
  enviadoA: string;
  grupoId: string;
  monto?: number | null; // en centavos
  tipo: TipoRecordatorio;
  tono: TonoRecordatorio;
  mensaje?: string | null;
  leido: boolean;
  fechaEnvio: string;
  fechaLectura?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts centavos integer to display string: 8550 → "85.50" */
export function centavosASoles(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/** Converts soles string/number to centavos integer: 85.50 → 8550 */
export function solesACentavos(soles: number): number {
  return Math.round(soles * 100);
}
