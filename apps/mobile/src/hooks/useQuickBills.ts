import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuickBillInput, QuickBillResult, QuickBillProgress } from "@junto/shared/quickBill";
import { api } from "../lib/api";
export interface QuickBill extends QuickBillProgress {
  id: string; datos: QuickBillInput; resultado: QuickBillResult; recibidos: string[];
  cobrado: number; pendiente: number; version: number; fechaCreacion: string; fechaActualizacion: string; mensaje: string;
  mensajeBreve: string; archivada: boolean; historial: { evento: string; fecha: string; persona?: string; anterior?: number; monto?: number }[];
}
export function useQuickBills() {
  return useQuery<QuickBill[]>({ queryKey: ["cuentas-rapidas"], queryFn: () => api.get("/cuentas-rapidas").then((r) => r.data) });
}
export function useQuickBill(id?: string) {
  return useQuery<QuickBill>({ queryKey: ["cuentas-rapidas", id], queryFn: () => api.get(`/cuentas-rapidas/${id}`).then((r) => r.data), enabled: !!id });
}
export function useSavedBillRequest(solicitudId?: string) {
  return useQuery<QuickBill | null>({ queryKey: ["cuentas-rapidas", "solicitud", solicitudId], queryFn: () => api.get(`/cuentas-rapidas/solicitud/${solicitudId}`).then((r) => r.data), enabled: !!solicitudId, retry: false });
}
export function useSaveQuickBill(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: QuickBillInput & { version?: number; solicitudId?: string }) => (id ? api.put<QuickBill>(`/cuentas-rapidas/${id}`, datos) : api.post<QuickBill>("/cuentas-rapidas", datos)).then((r) => r.data),
    onSuccess: async (data) => { qc.setQueryData(["cuentas-rapidas", data.id], data); await qc.invalidateQueries({ queryKey: ["cuentas-rapidas"] }); },
  });
}
export function useQuickBillProgress(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { participanteId: string; monto: number; version: number } | { archivada: boolean; version: number }) => api.post<QuickBill>(`/cuentas-rapidas/${id}/${"archivada" in data ? "archivo" : "aportes"}`, data).then((r) => r.data),
    onSuccess: async (data) => { qc.setQueryData(["cuentas-rapidas", id], data); await qc.invalidateQueries({ queryKey: ["cuentas-rapidas"] }); },
  });
}
export function useConfirmQuickBill(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { participanteId: string; recibido: boolean; version: number }) => api.post<QuickBill>(`/cuentas-rapidas/${id}/recibidos`, data).then((r) => r.data),
    onSuccess: async (data) => { qc.setQueryData(["cuentas-rapidas", id], data); await qc.invalidateQueries({ queryKey: ["cuentas-rapidas"] }); },
  });
}
export interface ReceiptProposal { totalPropuesto: number | null; candidatos: { monto: number; linea: string }[]; necesitaRevision: boolean; advertencia: string; confianzaLectura: number; texto: string; }
export function useReadReceipt() {
  return useMutation({ mutationFn: (data: { imagen: string; signal: AbortSignal }) => api.post<ReceiptProposal>("/cuentas-rapidas/leer-boleta", { imagen: data.imagen }, { timeout: 40_000, signal: data.signal }).then((r) => r.data) });
}
