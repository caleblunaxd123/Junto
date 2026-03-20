import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGrupos } from '../../src/hooks/useGrupos';
import { useAuthStore } from '../../src/store/auth.store';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { SocialPressureWidget } from '../../src/components/SocialPressureWidget';
import type { GrupoConBalance } from '../../src/types';
import { centavosASoles } from '../../src/types';

function GrupoCard({ grupo }: { grupo: GrupoConBalance }) {
  const { neto } = grupo.balanceUsuario;
  const positivo = neto > 0;

  return (
    <TouchableOpacity onPress={() => router.push(`/(app)/grupos/${grupo.id}`)} activeOpacity={0.85} className="mb-4">
      <GlassCard className="p-4" intensity={1.05}>
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center mr-4">
            <Text className="text-xl">
              {grupo.tipo === 'viaje' ? '✈️' : grupo.tipo === 'roomies' ? '🏠' : grupo.tipo === 'amigos' ? '👥' : grupo.tipo === 'trabajo' ? '💼' : '📦'}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-text font-bold text-lg" style={{ letterSpacing: -0.5 }}>{grupo.nombre}</Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="people-outline" size={14} color="#6B7280" />
              <Text className="text-text-muted text-xs ml-1 font-medium">{grupo.miembros.length} Miembro{grupo.miembros.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <View className="items-end">
            {neto === 0 ? (
              <View className="bg-success/10 px-3 py-1.5 rounded-full flex-row items-center border border-success/20">
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text className="text-success text-xs font-bold ml-1">Al día</Text>
              </View>
            ) : (
              <View className="items-end">
                <Text className={`text-lg font-extrabold ${positivo ? 'text-success' : 'text-danger'}`}>S/ {centavosASoles(Math.abs(neto))}</Text>
                <Text className="text-text-hint text-[10px] font-bold uppercase tracking-wider">{positivo ? 'te deben' : 'debes'}</Text>
              </View>
            )}
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { usuario } = useAuthStore();
  const { data: grupos, isLoading, refetch, isRefetching } = useGrupos();

  const totalTeDeben = grupos?.reduce((acc, g) => acc + g.balanceUsuario.teDeben, 0) ?? 0;
  const totalDebes = grupos?.reduce((acc, g) => acc + g.balanceUsuario.debes, 0) ?? 0;

  // Mock pressure level for demo
  const pressureLevel = totalTeDeben > 10000 ? 'high' : totalTeDeben > 5000 ? 'medium' : 'low';

  return (
    <View className="flex-1 bg-background">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <LinearGradient
        colors={['#6366F1', '#4F46E5']}
        className="h-72 w-full absolute top-0"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <View className="flex-row items-center justify-between mb-8">
            <View>
              <Text className="text-white/70 text-base font-medium">Hola de nuevo,</Text>
              <Text className="text-white text-3xl font-extrabold tracking-tight">
                {usuario?.nombre?.split(' ')[0]} 👋
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(app)/grupos/crear')}
              className="bg-white/20 w-12 h-12 rounded-2xl items-center justify-center border border-white/30"
            >
              <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
          </View>

          {/* Balance Cards Row */}
          <View className="flex-row gap-4">
            <View className="flex-1 bg-white/10 rounded-3xl p-4 border border-white/20">
              <View className="w-8 h-8 rounded-full bg-success/20 items-center justify-center mb-3">
                <Ionicons name="arrow-down" size={16} color="#10B981" />
              </View>
              <Text className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Te deben</Text>
              <Text className="text-white text-2xl font-black">
                S/ {centavosASoles(totalTeDeben)}
              </Text>
            </View>
            
            <View className="flex-1 bg-white/10 rounded-3xl p-4 border border-white/20">
              <View className="w-8 h-8 rounded-full bg-danger/20 items-center justify-center mb-3">
                <Ionicons name="arrow-up" size={16} color="#EF4444" />
              </View>
              <Text className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Debes</Text>
              <Text className="text-white text-2xl font-black">
                S/ {centavosASoles(totalDebes)}
              </Text>
            </View>
          </View>
        </View>

        {/* Content Area */}
        <FlatList
          data={grupos || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <GrupoCard grupo={item} />}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />
          }
          ListHeaderComponent={
            <View className="mb-6">
              {totalTeDeben > 0 && (
                <View className="mb-8">
                   <Text className="text-text font-extrabold text-xl mb-4 tracking-tight">Monitor de Cobros</Text>
                   <SocialPressureWidget level={pressureLevel as any} totalDebt={centavosASoles(totalTeDeben)} />
                </View>
              )}

              <View className="flex-row items-center justify-between">
                <Text className="text-text font-extrabold text-xl tracking-tight">
                  Tus Grupos
                </Text>
                {grupos && grupos.length > 0 && (
                  <TouchableOpacity>
                    <Text className="text-primary font-bold">Ver todos</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={
            isLoading ? (
              <View className="flex-1 items-center justify-center py-20">
                <ActivityIndicator size="large" color="#6366F1" />
              </View>
            ) : (
              <View className="items-center py-12">
                <View className="w-24 h-24 bg-primary/5 rounded-[40px] items-center justify-center mb-6">
                  <Ionicons name="people-outline" size={48} color="#6366F1" />
                </View>
                <Text className="text-text text-xl font-extrabold mb-2">Aún no tienes grupos</Text>
                <Text className="text-text-muted text-center px-10 leading-6 font-medium">
                  Crea un grupo e invita a tus amigos para empezar a dividir gastos.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(app)/grupos/crear')}
                  className="mt-8 bg-primary h-14 px-8 rounded-2xl items-center justify-center shadow-premium"
                >
                  <Text className="text-white font-black text-base">Crear mi primer grupo</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}
