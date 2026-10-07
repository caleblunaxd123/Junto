import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  Grupo,
  GrupoConBalance,
  Saldo,
  Gasto,
  Pago,
  AiExpenseProposal,
  GrupoTipo,
} from "../types";

export function useGrupos() {
  return useQuery<GrupoConBalance[]>({
    queryKey: ["grupos"],
    queryFn: () => api.get("/grupos").then((r) => r.data),
  });
}

export function useGrupo(id: string) {
  return useQuery<GrupoConBalance & { saldos: Saldo[] }>({
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
      fecha_inicio?: string;
      fecha_fin?: string;
    }) => api.post<Grupo>("/grupos", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grupos"] }),
  });
}

export function useEditarGrupo(grupoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; tipo: GrupoTipo; descripcion: string }) =>
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

export function useEnviarRecordatorio(grupoId: string) {
  return useMutation({
    mutationFn: (data: { deudorId: string; tono: string }) =>
      api.post(`/grupos/${grupoId}/recordar`, data).then((r) => r.data),
  });
}

export function usePagos() {
  return useQuery<Pago[]>({
    queryKey: ["pagos"],
    queryFn: () =>
      api.get("/pagos/historial").then((response) => response.data),
  });
}

export function useResolverPago(grupoId: string) {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actividad"] });
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      queryClient.invalidateQueries({ queryKey: ["grupos"] });
      queryClient.invalidateQueries({ queryKey: ["grupos", grupoId] });
    },
  });
}
