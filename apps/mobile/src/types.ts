// ─── Users ────────────────────────────────────────────────────────────────────

import type { CurrencyCode, CountryCode } from "@junto/shared/currency";

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
  /** Added by name only: their personal invitation code (joining with it makes them this person). */
  codigoPersonal?: string | null;
  usuario: Pick<Usuario, "id" | "nombre" | "email" | "fotoUrl"> & { celular?: string | null; sinCuenta?: boolean };
}

/** "receptor": only who receives approves a payment. "administrador": who receives or a group admin. */
export type AprobacionPagos = "receptor" | "administrador";

export interface Grupo {
  id: string;
  nombre: string;
  descripcion?: string | null;
  tipo: GrupoTipo;
  moneda?: CurrencyCode;
  pais?: CountryCode | null;
  aprobacionPagos?: AprobacionPagos;
  /** true: fewest payments. false: person to person (default for new groups). */
  simplificarDeudas?: boolean;
  /** "cobranza": someone paid and the rest pay back. "division": everyone puts in toward a goal. */
  modo?: "cobranza" | "division" | null;
  /** Until when people can pay; reminders go out automatically as it approaches. */
  fechaLimite?: string | null;
  creadoPor: string;
  linkInvitacion?: string | null;
  fechaCreacion: string;
  activo: boolean;
  miembros: GrupoMiembro[];
  estado?: 'abierto' | 'por_liquidar' | 'cerrado';
  cerradoEn?: string | null;
  cierreSolicitadoEn?: string | null;
  archivado?: boolean;
  tieneHistorialFinanciero?: boolean;
}

/** WhatsApp ticks on what I post: ✓ sent, ✓✓ received (they used JUNTO after), blue ✓✓ seen. */
export type Entrega = "enviado" | "recibido" | "visto";
/** The message a reply quotes (text is empty if it was deleted). */
export type Respuesta = { comentarioId: string; autor: ChatPersona; texto: string; eliminado: boolean };
export type Reaccion = { emoji: string; total: number; mia: boolean };
export type Presencia = { usuarioId: string; enLinea: boolean; ultimaConexion: string | null };

export interface GrupoConBalance extends Grupo {
  funciones?: { variosPagadores?: boolean };
  /** The pinned group message, shown above the chat. */
  mensajeFijado?: { id: string; texto: string; fechaCreacion: string; autor: { id: string; nombre: string } } | null;
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
      pagosPorConfirmar?: number;
      neto: number;
      /** false: no longer in the group but still has history here. */
      activo?: boolean;
    }[];
    saldos?: Saldo[];
    /** Which plan `saldos` is: simplified (fewest payments) or person to person. */
    simplificado?: boolean;
    /** The fewest-payments plan, always available to compare. */
    saldosSimplificados?: Saldo[];
    /** Who owes whom before simplifying (per pair). Same net per person as `saldos`. */
    deudasDirectas?: { deudorId: string; acreedorId: string; monto: number }[];
    /** What the group spent per category (payments between people are not spending). */
    porCategoria?: { categoria: string; monto: number; cantidad: number }[];
  };
  balanceUsuario: {
    teDeben: number; // en centavos
    debes: number; // en centavos
    neto: number; // en centavos, positivo = te deben
  };
  rolUsuario: MiembroRol;
  /** The group's bill in equal parts: free parts stay with whoever paid until someone joins. */
  cuenta?: CuentaPorPartes | null;
  cuentasPorPartes?: CuentaPorPartes[];
  /** Chat items from others since the viewer last opened the group (Home badge). */
  noLeidos?: number;
}

export interface CuentaPorPartes {
  id: string;
  descripcion: string;
  montoTotal: number;
  pagadoPor: string;
  pagadorNombre: string;
  participantes: { usuarioId: string; montoAsignado: number }[];
  partes: number;
  parte: number;
  libres: number;
  montosLibres?: number[];
  montoLibre?: number;
  siguienteParte?: number | null;
}

export type PartesAlUnirse = { total: number; cuentas: { descripcion: string; parte: number; pagadorNombre: string }[] };

// ─── Group chat ───────────────────────────────────────────────────────────────

export type ChatPersona = { id: string; nombre: string; fotoUrl?: string | null };
type ChatBase = { id: string; fecha: string; autor: ChatPersona; mio: boolean };
export type ChatItem = ChatBase & (
  | { tipo: "creado" }
  | { tipo: 'cambio'; texto: string; evento: string }
  | { tipo: "union"; parte: number | null; activo: boolean; sinCuenta?: boolean }
  | { tipo: "cuenta" | "gasto"; gastoId: string; descripcion: string; monto: number; pagador: ChatPersona; pagadores?: Gasto['pagadores']; comentarios: number; tuParte: number | null; repite?: string | null; partes?: number; parte?: number; libres?: number; entrega?: Entrega }
  | { tipo: "pago"; pagoId: string; monto: number; monedaOrigen?: CurrencyCode | null; montoOrigen?: number | null; tipoCambio?: string | null; metodo: string | null; estado: string; receptor: ChatPersona; resolutor: ChatPersona | null; fechaResolucion: string | null; comentarios: number; tieneComprobante?: boolean; puedeVerComprobante?: boolean; apruebaComo: "receptor" | "administrador" | null }
  | { tipo: "recordatorio"; para: ChatPersona; monto: number | null; aviso: string | null }
  | { tipo: "mensaje"; comentarioId: string; texto: string; eliminado: boolean; puedeEliminar: boolean; entrega?: Entrega; reacciones?: Reaccion[]; fijado?: boolean; respuesta?: Respuesta }
);

// ─── Expenses ─────────────────────────────────────────────────────────────────

export type GastoCategoria =
  | "comida"
  | "transporte"
  | "entretenimiento"
  | "alojamiento"
  | "compras"
  | "otro";

export type TipoDivision = "igual" | "exacto" | "porcentaje" | "participaciones";

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
  grupo?: { moneda: CurrencyCode };
  id: string;
  grupoId: string;
  descripcion: string;
  montoTotal: number; // en centavos
  pagadoPor: string;
  tipoDivision?: "igual" | "exacto" | "porcentaje" | "participaciones";
  pagadores?: { usuarioId: string; monto: number; usuario: Pick<Usuario, "id" | "nombre" | "fotoUrl"> }[];
  categoria: GastoCategoria;
  fecha: string;
  creadoPor: string;
  fotoUrl?: string | null;
  notas?: string | null;
  activo: boolean;
  participantes: GastoParticipante[];
  pagador: Pick<Usuario, "id" | "nombre" | "fotoUrl">;
  creador: Pick<Usuario, "id" | "nombre">;
  _count?: { comentarios: number };
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
  fechaEfectiva?: string | null;
  referenciaCambio?: { origen: CurrencyCode; destino: CurrencyCode; tasa: string; fecha: string; fuente: string } | null;
  monedaOrigen?: CurrencyCode | null;
  montoOrigen?: number | null;
  tipoCambio?: string | null;
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
  grupo: Pick<Grupo, "id" | "nombre" | "aprobacionPagos" | "moneda">;
  /** Who approved or rejected it (the receiver or an admin). */
  resueltoPor?: string | null;
  resolutor?: Pick<Usuario, "id" | "nombre"> | null;
  comprobante?: { id: string; app?: string | null; montoLeido?: number | null } | null;
  _count?: { comentarios: number };
  /** What the viewer may do with this payment, computed by the server. */
  permisos?: PermisosPago;
}

export interface PermisosPago {
  aprobar: boolean;
  /** The receiver may say an admin-approved payment never arrived. */
  marcarNoRecibido: boolean;
  verComprobante: boolean;
}

export interface PagoDetalle extends Omit<Pago, "comprobante"> {
  permisos: PermisosPago;
  aprobadores: { id: string; nombre: string; rol: "receptor" | "administrador" }[];
  comprobante: null | {
    id: string;
    app: string | null;
    montoLeido: number | null;
    monedaLeida?: CurrencyCode | null;
    imagenDisponible: boolean;
    operacion?: string | null;
    destinatarioLeido?: string | null;
    fechaLeida?: string | null;
    codigoSeguridad?: string | null;
  };
}

/** What JUNTO read from a Yape/Plin/transfer screenshot. Always a proposal to review. */
export interface LecturaComprobante {
  moneda?: CurrencyCode | null;
  comprobanteId: string;
  leido: boolean;
  app: MetodoPago | null;
  monto: number | null;
  candidatos: number[];
  operacion: string | null;
  destinatario: string | null;
  fecha: string | null;
  codigoSeguridad: string | null;
  sugerenciaReceptorId: string | null;
  duplicado: string | null;
  advertencias: string[];
}

export interface Comentario {
  id: string;
  texto: string;
  eliminado: boolean;
  fechaCreacion: string;
  autor: Pick<Usuario, "id" | "nombre" | "fotoUrl">;
  mio: boolean;
  puedeEliminar: boolean;
  reportadoPorMi: boolean;
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
  moneda?: CurrencyCode;
  id: string;
  tipo: "gasto" | "pago" | 'cambio';
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
  /** For a payment waiting on the viewer: as who they decide. */
  apruebaComo?: "receptor" | "administrador" | null;
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

/** A recurring expense rule (rent, internet…): it adds the same expense on a schedule. */
export interface GastoRecurrente {
  id: string; grupoId: string; descripcion: string; categoria: string; montoTotal: number;
  pagador: { id: string; nombre: string } | null; tipoDivision: string; frecuencia: "semanal" | "quincenal" | "mensual"; diaMes: number | null;
  cada: string; proximaFecha: string; activo: boolean; pausaMotivo: string | null; creador: { id: string; nombre: string }; gastosCreados: number;
}
