import type { QuickBillInput } from "./quickBill";
import type { CurrencyCode } from "./currency";

export type SharePreview = {
  moneda?: CurrencyCode | string;
  title: string;
  total: number;
  totalLabel: string;
  caption: string;
  rowsHeading: string;
  rows: { id: string; name: string; amount: number; detail?: string; breakdown?: string; tone?: "guest" | "settled" | "receivable" | "payable" }[];
  payment?: { recipient: string; instructions: string };
  transfers?: { from: string; to: string; amount: number }[];
  note: string;
  reconciled?: boolean;
};
/** What the person reviews and shares. `resource` lets the API rebuild it from server data. */
export type ShareMessage = {
  subject: string;
  body: string;
  preview?: SharePreview;
  invitation?: { groupName: string; url: string };
  resource?: { tipo: "cuenta_rapida" | "grupo" | "gasto" | "invitacion"; id: string };
};
export type ShareExpense = {
  descripcion: string;
  montoTotal: number;
  pagador: { nombre: string };
  pagadores?: { monto: number; usuario: { nombre: string } }[];
  participantes: { usuario: { nombre: string }; montoAsignado: number }[];
};
export type ShareGroup = {
  moneda?: CurrencyCode | string;
  nombre: string;
  resumen: { totalGastado: number; cantidadGastos: number; cuentas: { nombre: string; tuParte: number; pagaste: number; neto: number }[] };
  saldos: { deudorNombre: string; acreedorNombre: string; monto: number }[];
};
export function shareMoney(value: number, currency?: CurrencyCode | string): string;
export function validShareEmail(value: string): boolean;
export function invitationShareMessage(groupName: string, url: string): ShareMessage;
export function expenseShareMessage(expense: ShareExpense, groupName: string, currency?: CurrencyCode | string): ShareMessage;
export function groupShareMessage(group: ShareGroup, pendingPayments?: number): ShareMessage;
export function quickBillSharePreview(input: QuickBillInput, aportes?: Record<string, number>): SharePreview;
export function quickBillShareMessage(input: QuickBillInput, aportes?: Record<string, number>): ShareMessage;
export function tryBillShareMessage(input: QuickBillInput): ShareMessage;
export function shareFingerprint(message: Pick<ShareMessage, "subject" | "body">): string;
export function shareEmailHtml(message: ShareMessage, meta?: { sentBy?: string }): string;
export function shareEmailText(message: ShareMessage, meta?: { sentBy?: string }): string;
