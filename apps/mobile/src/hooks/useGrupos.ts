import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Grupo, GrupoConBalance, Saldo, Gasto } from '@junto/shared';

export function useGrupos() {
  return useQuery<GrupoConBalance[]>({
    queryKey: ['grupos'],
    queryFn: () => api.get('/grupos').then((r) => r.data),
  });
}

export function useGrupo(id: string) {
  return useQuery<GrupoConBalance & { saldos: Saldo[] }>({
    queryKey: ['grupos', id],
    queryFn: () => api.get(`/grupos/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useSaldosGrupo(grupoId: string) {
  return useQuery<Saldo[]>({
    queryKey: ['saldos', grupoId],
    queryFn: () => api.get(`/grupos/${grupoId}/saldos`).then((r) => r.data),
    enabled: !!grupoId,
  });
}

export function useCrearGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; descripcion?: string; tipo: string }) =>
      api.post<Grupo>('/grupos', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos'] }),
  });
}

export function useGastosGrupo(grupoId: string, page = 1) {
  return useQuery<{ gastos: Gasto[]; total: number; totalPages: number }>({
    queryKey: ['gastos', grupoId, page],
    queryFn: () => api.get(`/grupos/${grupoId}/gastos?page=${page}`).then((r) => r.data),
    enabled: !!grupoId,
  });
}

export function useCrearGasto(grupoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) =>
      api.post<Gasto>(`/grupos/${grupoId}/gastos`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gastos', grupoId] });
      qc.invalidateQueries({ queryKey: ['saldos', grupoId] });
      qc.invalidateQueries({ queryKey: ['grupos'] });
    },
  });
}

export function useEnviarRecordatorio(grupoId: string) {
  return useMutation({
    mutationFn: (data: { deudorId: string; tono: string }) =>
      api.post(`/grupos/${grupoId}/recordar`, data).then((r) => r.data),
  });
}
