export interface QuickBillPerson { id: string; nombre: string; consumo: number; invitado: boolean; }
export interface QuickBillInput { nombre: string; participantes: QuickBillPerson[]; extras: number; cobrarA: string; instrucciones: string; division?: "consumos" | "igual"; totalCuenta?: number; }
export interface QuickBillResult {
  montoTotal: number; totalInvitados: number; totalExtras: number; cantidadPagadores: number;
  partes: (QuickBillPerson & { invitados: number; extras: number; total: number })[];
}
export function calculateQuickBill(input: QuickBillInput): QuickBillResult;
export function quickBillMessage(input: QuickBillInput, received?: string[]): string;
export interface QuickBillProgress { aportes: Record<string, number>; recibidos: string[]; cobrado: number; pendiente: number; estado: "abierta" | "parcial" | "completada"; }
export function quickBillProgress(input: QuickBillInput, aportes?: Record<string, number>, received?: string[]): QuickBillProgress;
export function quickBillBrief(input: QuickBillInput, aportes?: Record<string, number>, received?: string[]): string;
