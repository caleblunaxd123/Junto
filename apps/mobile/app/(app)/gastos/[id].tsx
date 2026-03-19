import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/store/auth.store';
import { Card } from '../../../src/components/ui/Card';
import { MontoDisplay } from '../../../src/components/ui/MontoDisplay';
import type { Gasto } from '../../../src/types';

export default function GastoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuthStore();
  const qc = useQueryClient();

  const { data: gasto, isLoading } = useQuery<Gasto>({
    queryKey: ['gastos', 'detalle', id],
    queryFn: () => api.get(`/gastos/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { mutateAsync: eliminar } = useMutation({
    mutationFn: () => api.delete(`/gastos/${id}`),
    onSuccess: () => {
      if (gasto) {
        qc.invalidateQueries({ queryKey: ['gastos', gasto.grupoId] });
        qc.invalidateQueries({ queryKey: ['saldos', gasto.grupoId] });
      }
      router.back();
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-fondo">
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  if (!gasto) return null;

  const puedeEliminar =
    gasto.creadoPor === usuario?.id;

  const CATEGORY_ICONS: Record<string, string> = {
    comida: '🍽️',
    transporte: '🚗',
    entretenimiento: '🎬',
    alojamiento: '🏠',
    compras: '🛒',
    otro: '💸',
  };

  const handleEliminar = () => {
    Alert.alert('Eliminar gasto', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => eliminar(),
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-fondo">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="px-4 pt-4 pb-6 bg-white border-b border-gray-100">
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            {puedeEliminar && (
              <TouchableOpacity onPress={handleEliminar}>
                <Ionicons name="trash-outline" size={22} color="#E24B4A" />
              </TouchableOpacity>
            )}
          </View>

          <View className="items-center">
            <Text className="text-5xl mb-3">{CATEGORY_ICONS[gasto.categoria]}</Text>
            <Text className="text-3xl font-bold text-texto mb-1">{gasto.descripcion}</Text>
            <MontoDisplay centavos={gasto.montoTotal} className="text-4xl font-bold text-primary mt-2" />
          </View>
        </View>

        <View className="px-4 pt-4">
          {/* Pagador */}
          <Card>
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-primary-50 items-center justify-center">
                <Ionicons name="person" size={20} color="#534AB7" />
              </View>
              <View>
                <Text className="text-texto-hint text-xs">Pagó</Text>
                <Text className="text-texto font-semibold">{gasto.pagador.nombre}</Text>
              </View>
            </View>
          </Card>

          {/* Participantes */}
          <Text className="text-texto-secundario font-medium mb-3">División del gasto</Text>
          {gasto.participantes.map((p) => (
            <Card key={p.id}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                    <Text className="text-texto-secundario text-xs font-bold">
                      {p.usuario.nombre.charAt(0)}
                    </Text>
                  </View>
                  <Text className="text-texto font-medium">
                    {p.usuario.nombre}
                    {p.usuarioId === usuario?.id ? ' (yo)' : ''}
                  </Text>
                </View>
                <View className="items-end">
                  <MontoDisplay centavos={p.montoAsignado} className="font-semibold text-texto" />
                  {p.pagado && (
                    <Text className="text-verde text-xs mt-0.5">Pagado ✓</Text>
                  )}
                </View>
              </View>
            </Card>
          ))}

          {gasto.notas && (
            <Card>
              <Text className="text-texto-hint text-xs mb-1">Notas</Text>
              <Text className="text-texto">{gasto.notas}</Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
