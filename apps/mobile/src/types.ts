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
  /** false for accounts created with Google that never set a password. */
  tienePassword?: boolean;
  conGoogle?: boolean;
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

export type GrupoTipo =
  "viaje" | "roomies" | "pareja" | "amigos" | "trabajo" | "deporte" | "otro";
export type MiembroRol = "admin" | "miembro";

export interface GrupoMiembro {
  id: string;
  grupoId: string;
  usuarioId: string;
  rol: MiembroRol;
  fechaUnion: string;
  activo: boolean;
  usuario: Pick<Usuario, "id" | "nombre" | "email" | "fotoUrl"> & { celular?: string | null };
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
  resumen: {
    totalGastado: number;
    cantidadGastos: number;
    cuentas: {
      usuarioId: string;
      nombre: string;
      pagaste: number;
      tuParte: number;
      pagosEnviados: number;
      pagosRecibidos: number;
      neto: number;
    }[];
    saldos?: Saldo[];
  };
  balanceUsuario: {
    teDeben: number; // en centavos
    debes: number; // en centavos
    neto: number; // en centavos, positivo = te deben
  };
  rolUsuario: MiembroRol;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export type GastoCategoria =
  | "comida"
  | "transporte"
  | "entretenimiento"
  | "alojamiento"
  | "compras"
  | "otro";

export type TipoDivision = "igual" | "exacto" | "porcentaje";

export interface GastoParticipante {
  id: string;
  gastoId: string;
  usuarioId: string;
  montoAsignado: number; // en centavos
  pagado: boolean;
  fechaPago?: string | null;
  usuario: Pick<Usuario, "id" | "nombre" | "fotoUrl">;
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
  pagador: Pick<Usuario, "id" | "nombre" | "fotoUrl">;
  creador: Pick<Usuario, "id" | "nombre">;
}

export interface AiExpenseProposal {
  descripcion: string;
  montoTotal: number;
  pagadoPor: string | null;
  participanteIds: string[];
  categoria: GastoCategoria;
  explicacion: string;
  requiereRevision: boolean;
  nombresSinCoincidencia: string[];
  confirmacionRequerida: true;
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

export type MetodoPago = "yape" | "plin" | "transferencia" | "efectivo";
export type EstadoPago = "reportado" | "exitoso" | "rechazado" | "fallido" | "cancelado";

export interface Pago {
  nota?: string | null;
  fechaResolucion?: string | null;
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
  pagador: Pick<Usuario, "id" | "nombre" | "fotoUrl">;
  receptor: Pick<Usuario, "id" | "nombre" | "fotoUrl">;
  grupo: Pick<Grupo, "id" | "nombre">;
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export type TonoRecordatorio = "suave" | "directo" | "urgente";
export type TipoRecordatorio = "manual" | "automatico";

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

// ─── Activity ─────────────────────────────────────────────────────────────────

export interface ActividadEvento {
  id: string;
  tipo: "gasto" | "pago";
  titulo: string;
  detalle: string;
  monto: number;
  fecha: string;
  grupoId: string;
  gastoId: string | null;
  pagoId: string | null;
  estado?: EstadoPago;
  tuParte?: number | null;
  pagaste?: boolean;
  requiereAccion: boolean;
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
