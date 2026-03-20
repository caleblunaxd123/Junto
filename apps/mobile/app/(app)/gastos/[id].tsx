import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/store/auth.store';
import { centavosASoles } from '../../../src/types';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import type { Gasto } from '../../../src/types';

const CAT: Record<string, string> = { 
  comida: '🍽️', 
  transporte: '🚗', 
  entretenimiento: '🎬', 
  alojamiento: '🏠', 
  compras: '🛒', 
  otro: '💸' 
};

export default function GastoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuthStore();
  const qc = useQueryClient();

  const { data: gasto, isLoading } = useQuery<Gasto>({
    queryKey: ['gastos', 'detalle', id],
    queryFn: () => api.get(`/gastos/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { mutateAsync: eliminar, isPending: eliminando } = useMutation({
    mutationFn: () => api.delete(`/gastos/${id}`),
    onSuccess: () => {
      if (gasto) {
        qc.invalidateQueries({ queryKey: ['gastos', gasto.grupoId] });
        qc.invalidateQueries({ queryKey: ['saldos', gasto.grupoId] });
      }
      router.back();
    },
  });

  const handleEliminar = () => Alert.alert(
    'Eliminar gasto', 
    '¿Estás seguro? Esta acción no se puede deshacer y afectará los balances de todos.', 
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminar() },
    ]
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }

  if (!gasto) return null;

  const puedeEliminar = gasto.creadoPor === usuario?.id;

  return (
    <View className="flex-1 bg-background">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <LinearGradient
        colors={['#6366F1', '#4F46E5']}
        className="h-80 w-full absolute top-0"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header Navigation */}
        <View className="px-6 pt-4 pb-4 flex-row items-center justify-between">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center border border-white/30"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black">Detalle de Gasto</Text>
          {puedeEliminar ? (
            <TouchableOpacity 
              onPress={handleEliminar}
              disabled={eliminando}
              className="w-10 h-10 bg-red-400/20 rounded-xl items-center justify-center border border-red-400/30"
            >
              {eliminando ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="trash-outline" size={20} color="white" />}
            </TouchableOpacity>
          ) : (
            <View className="w-10" />
          )}
        </View>

        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Gasto Card */}
          <GlassCard className="mx-6 p-8 items-center border border-white/30 mb-8" intensity={1.2}>
            <View className="w-20 h-20 bg-white/20 rounded-[28px] items-center justify-center mb-6 border border-white/30 shadow-sm">
              <Text className="text-4xl">{CAT[gasto.categoria] || '💸'}</Text>
            </View>
            <Text className="text-white text-2xl font-black text-center mb-2 tracking-tight">
              {gasto.descripcion}
            </Text>
            <Text className="text-white text-5xl font-black text-center mb-6 tracking-tighter">
              S/ {centavosASoles(gasto.montoTotal)}
            </Text>
            <View className="bg-white/10 px-4 py-2 rounded-full border border-white/10">
              <Text className="text-white/80 text-xs font-bold uppercase tracking-widest">
                Pagado por <Text className="text-white">{gasto.pagador.nombre}</Text>
              </Text>
            </View>
          </GlassCard>

          <View className="px-6">
            <Text className="text-text font-extrabold text-lg mb-4 tracking-tight">División del gasto</Text>
            <View className="bg-white rounded-[32px] border border-gray-100 p-2 mb-8 shadow-sm">
              {gasto.participantes.map((p, idx) => (
                <View 
                  key={p.id} 
                  className={`flex-row items-center p-4 ${idx < gasto.participantes.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <View className="w-12 h-12 bg-primary/5 rounded-2xl items-center justify-center mr-4 border border-primary/10">
                    <Text className="text-primary font-black text-lg">{p.usuario.nombre.charAt(0)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text font-bold text-base">
                      {p.usuario.nombre}{p.usuarioId === usuario?.id ? ' (tú)' : ''}
                    </Text>
                    {p.pagado && (
                      <View className="flex-row items-center mt-1">
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                        <Text className="text-success text-xs font-bold ml-1">Liquidado</Text>
                      </View>
                    )}
                  </View>
                  <Text className={`font-black text-lg tracking-tighter ${p.pagado ? 'text-success' : 'text-text'}`}>
                    S/ {centavosASoles(p.montoAsignado)}
                  </Text>
                </View>
              ))}
            </View>

            <Text className="text-text font-extrabold text-lg mb-4 tracking-tight">Información adicional</Text>
            <View className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-sm">
              <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-gray-50">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 bg-gray-100 rounded-lg items-center justify-center mr-3">
                    <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  </View>
                  <Text className="text-text-hint font-bold text-sm">Fecha</Text>
                </View>
                <Text className="text-text font-bold text-sm">
                  {new Date(gasto.fecha).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })}
                </Text>
              </View>

              <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-gray-50">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 bg-gray-100 rounded-lg items-center justify-center mr-3">
                    <Ionicons name="pricetag-outline" size={18} color="#6B7280" />
                  </View>
                  <Text className="text-text-hint font-bold text-sm">Categoría</Text>
                </View>
                <Text className="text-text font-bold text-sm capitalize">{gasto.categoria}</Text>
              </View>

              {gasto.notas && (
                <View className="mt-2">
                  <Text className="text-text-hint font-bold text-xs uppercase tracking-widest mb-2">Notas</Text>
                  <Text className="text-text text-sm leading-6">{gasto.notas}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
