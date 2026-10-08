import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  Grupo,
  GrupoConBalance,
  Saldo,
  Gasto,
  Pago,
  PagoDetalle,
  AiExpenseProposal,
  GrupoTipo,
  AprobacionPagos,
} from "../types";

export function useGrupos() {
  return useQuery<GrupoConBalance[]>({
    queryKey: ["grupos"],
    queryFn: () => api.get("/grupos").then((r) => r.data),
  });
}

export function useGrupo(id: string) {
  return useQuery<GrupoConBalance & { saldos: Saldo[]; pagosPorConfirmar?: number }>({
    queryKey: ["grupos", id],
    queryFn: () => api.get(`/grupos/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useSaldosGrupo(grupoId: string) {
  return useQuery<Saldo[]>({
    queryKey: ["saldos", grupoId],
    queryFn: () => api.get(`/grupos/${grupoId}/saldos`).then((r) => r.data),
    enabled: !!grupoId,
  });
}

export function useCrearGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      nombre: string;
      descripcion?: string;
      tipo: string;
      aprobacionPagos?: AprobacionPagos;
      fecha_inicio?: string;
      fecha_fin?: string;
    }) => api.post<Grupo>("/grupos", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grupos"] }),
  });
}

export function useEditarGrupo(grupoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre?: string; tipo?: GrupoTipo; descripcion?: string; aprobacionPagos?: AprobacionPagos }) =>
      api.put<GrupoConBalance>(`/grupos/${grupoId}`, data).then((r) => r.data),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["grupos"] }),
        qc.invalidateQueries({ queryKey: ["actividad"] }),
        qc.invalidateQueries({ queryKey: ["pagos"] }),
      ]);
    },
  });
}

export function useGastosGrupo(grupoId: string, page = 1) {
  return useQuery<{ gastos: Gasto[]; total: number; totalPages: number }>({
    queryKey: ["gastos", grupoId, page],
    queryFn: () =>
      api.get(`/grupos/${grupoId}/gastos?page=${page}`).then((r) => r.data),
    enabled: !!grupoId,
  });
}

export function useCrearGasto(grupoId: string, gastoId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) =>
      (gastoId
        ? api.put<Gasto>(`/gastos/${gastoId}`, data)
        : api.post<Gasto>(`/grupos/${grupoId}/gastos`, data)
      ).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["actividad"] });
      qc.invalidateQueries({ queryKey: ["gastos"] });
      qc.invalidateQueries({ queryKey: ["saldos", grupoId] });
      qc.invalidateQueries({ queryKey: ["grupos"] });
    },
  });
}

export function useInterpretarGasto() {
  return useMutation({
    mutationFn: (data: {
      grupoId: string;
      texto: string;
      signal?: AbortSignal;
    }) =>
      api
        .post<AiExpenseProposal>(
          "/ia/gastos/interpretar",
          { grupoId: data.grupoId, texto: data.texto },
          {
            timeout: 20_000,
            signal: data.signal,
          },
        )
        .then((response) => response.data),
  });
}

export function useEnviarRecordatorio(grupoId?: string) {
  return useMutation({
    mutationFn: (data: { deudorId: string; tono: string; grupoId?: string }) =>
      api
        .post(`/grupos/${data.grupoId ?? grupoId}/recordar`, { deudorId: data.deudorId, tono: data.tono })
        .then((r) => r.data),
  });
}

export function usePagos() {
  return useQuery<Pago[]>({
    queryKey: ["pagos"],
    queryFn: () =>
      api.get("/pagos/historial").then((response) => response.data),
  });
}

/** Confirm or reject a payment someone says they made to you. */
export function useResolverPago() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pagoId,
      confirmar,
    }: {
      pagoId: string;
      confirmar: boolean;
    }) =>
      api
        .post(`/pagos/${pagoId}/${confirmar ? "confirmar" : "rechazar"}`)
        .then((response) => response.data),
    // Also after an error: "ya fue resuelto" means someone else decided, and the card must go away.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["actividad"] });
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      queryClient.invalidateQueries({ queryKey: ["grupos"] });
      queryClient.invalidateQueries({ queryKey: ["saldos"] });
    },
  });
}

/** One payment with its voucher data and what the viewer may do with it. */
export function usePago(id: string, focused = true) {
  return useQuery<PagoDetalle>({
    queryKey: ["pagos", "detalle", id],
    queryFn: () => api.get(`/pagos/${id}`).then((r) => r.data),
    enabled: !!id,
    // Opening it again always shows the current state; while it waits, the decision appears on its own.
    refetchOnMount: "always",
    refetchInterval: (query) => (focused && query.state.data?.estado === "reportado" ? 15_000 : false),
  });
}

/** The voucher image, only fetched when the viewer may see it. Never cached on disk. */
export function useComprobanteImagen(pagoId: string, enabled: boolean) {
  return useQuery<{ mime: string; imagen: string }>({
    queryKey: ["pagos", "comprobante", pagoId],
    queryFn: () => api.get(`/pagos/${pagoId}/comprobante`, { timeout: 30_000 }).then((r) => r.data),
    enabled: enabled && !!pagoId,
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
  });
}
