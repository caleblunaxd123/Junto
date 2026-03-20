import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Share, RefreshControl, ActivityIndicator, StatusBar } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGrupo, useGastosGrupo, useEnviarRecordatorio } from '../../../src/hooks/useGrupos';
import { useAuthStore } from '../../../src/store/auth.store';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { GradientButton } from '../../../src/components/ui/GradientButton';
import type { Gasto, Saldo } from '../../../src/types';
import { centavosASoles } from '../../../src/types';

const CAT: Record<string, string> = { comida:'🍽️', transporte:'🚗', entretenimiento:'🎬', alojamiento:'🏠', compras:'🛒', otro:'💸' };

function GastoItem({ gasto }: { gasto: Gasto }) {
  const fecha = new Date(gasto.fecha).toLocaleDateString('es-PE', { day:'numeric', month:'short' });
  return (
    <TouchableOpacity onPress={() => router.push(`/(app)/gastos/${gasto.id}`)} activeOpacity={0.85} className="mb-3">
      <GlassCard className="p-4 flex-row items-center" intensity={1.1}>
        <View className="w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center mr-4">
          <Text className="text-2xl">{CAT[gasto.categoria] || '💸'}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-text font-bold text-[15px]" numberOfLines={1}>{gasto.descripcion}</Text>
          <Text className="text-text-muted text-xs mt-0.5">Pagó {gasto.pagador.nombre.split(' ')[0]} · {fecha}</Text>
        </View>
        <Text className="text-text font-extrabold text-[16px]">S/ {centavosASoles(gasto.montoTotal)}</Text>
      </GlassCard>
    </TouchableOpacity>
  );
}

function SaldoItem({ saldo, currentUserId, grupoId }: { saldo: Saldo; currentUserId: string; grupoId: string }) {
  const { mutateAsync: recordar } = useEnviarRecordatorio(grupoId);
  const esMio = saldo.deudorId === currentUserId;
  const esAcreencia = saldo.acreedorId === currentUserId;

  const pagar = () => router.push(
    `/(app)/pagos/pagar?deudorId=${saldo.deudorId}&acreedorId=${saldo.acreedorId}&monto=${saldo.monto}&grupoId=${grupoId}&nombre=${saldo.acreedorNombre}`
  );

  const remind = () => Alert.alert('Recordar deuda', `Tono para ${saldo.deudorNombre}:`, [
    { text: 'Suave 😊', onPress: () => recordar({ deudorId: saldo.deudorId, tono: 'suave' }).then(() => Alert.alert('✓', 'Enviado')).catch(() => {}) },
    { text: 'Directo 📢', onPress: () => recordar({ deudorId: saldo.deudorId, tono: 'directo' }).then(() => Alert.alert('✓', 'Enviado')).catch(() => {}) },
    { text: 'Urgente 🚨', style: 'destructive', onPress: () => recordar({ deudorId: saldo.deudorId, tono: 'urgente' }).then(() => Alert.alert('✓', 'Enviado')).catch(() => {}) },
    { text: 'Cancelar', style: 'cancel' },
  ]);

  const titulo = esMio
    ? `Debes a ${saldo.acreedorNombre.split(' ')[0]}`
    : esAcreencia
    ? `${saldo.deudorNombre.split(' ')[0]} te debe`
    : `${saldo.deudorNombre.split(' ')[0]} → ${saldo.acreedorNombre.split(' ')[0]}`;

  return (
    <View className="mb-3">
      <GlassCard 
        className={`p-4 flex-row items-center border-l-4 ${esMio ? 'border-l-danger' : esAcreencia ? 'border-l-success' : 'border-l-gray-300'}`} 
        intensity={1.1}
      >
        <View className="flex-1 mr-4">
          <Text className="text-text font-bold text-[14px]">{titulo}</Text>
          {(esMio || esAcreencia) && (
            <Text className="text-text-muted text-[11px] mt-0.5">{esMio ? 'Toca Pagar para saldar' : 'Toca Recordar si no paga'}</Text>
          )}
        </View>
        <View className="items-end">
          <Text className={`text-[16px] font-black mb-2 ${esMio ? 'text-danger' : esAcreencia ? 'text-success' : 'text-text'}`}>
            S/ {centavosASoles(saldo.monto)}
          </Text>
          {esMio && (
            <TouchableOpacity onPress={pagar} className="bg-primary px-4 py-1.5 rounded-xl shadow-premium">
              <Text className="text-white text-[11px] font-bold">Pagar</Text>
            </TouchableOpacity>
          )}
          {esAcreencia && (
            <TouchableOpacity onPress={remind} className="bg-warning/20 px-4 py-1.5 rounded-xl border border-warning/30">
              <Text className="text-warning-dark font-bold text-[11px]">Recordar</Text>
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>
    </View>
  );
}

export default function GrupoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuthStore();
  const { data: grupo, isLoading, refetch, isRefetching } = useGrupo(id);
  const { data: gastosData } = useGastosGrupo(id);
  const [tab, setTab] = useState<'gastos'|'saldos'>('gastos');

  const share = async () => {
    if (!grupo?.linkInvitacion) return;
    await Share.share({ message: `Únete a "${grupo.nombre}" en Junto: junto://unirse/${grupo.linkInvitacion}` });
  };

  if (isLoading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator size="large" color="#6366F1" /></View>;
  if (!grupo) return <View className="flex-1 items-center justify-center bg-background"><Text className="text-text-muted font-medium">Grupo no encontrado</Text></View>;

  const gastos = gastosData?.gastos || [];
  const saldos = grupo.saldos || [];
  const miNeto = saldos.reduce((acc: number, x: Saldo) => {
    if (x.acreedorId === usuario?.id) return acc + x.monto;
    if (x.deudorId === usuario?.id) return acc - x.monto;
    return acc;
  }, 0);

  return (
    <View className="flex-1 bg-background">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <LinearGradient
        colors={['#6366F1', '#4F46E5']}
        className="h-64 w-full absolute top-0"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <View className="flex-row justify-between items-center mb-6">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center border border-white/30">
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={share} className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center border border-white/30">
              <Ionicons name="person-add-outline" size={22} color="white" />
            </TouchableOpacity>
          </View>
          
          <Text className="text-white text-3xl font-black mb-1" numberOfLines={1}>{grupo.nombre}</Text>
          <Text className="text-white/70 text-sm font-medium">{grupo.miembros.length} Miembros activos</Text>
          
          {miNeto !== 0 && (
            <View className="mt-4 bg-white/10 self-start px-4 py-2 rounded-2xl border border-white/20">
              <Text className="text-white font-bold text-sm">
                {miNeto > 0 ? `Te deben S/ ${centavosASoles(miNeto)}` : `Debes S/ ${centavosASoles(Math.abs(miNeto))}`}
              </Text>
            </View>
          )}
        </View>

        {/* Tab Bar */}
        <View className="flex-row bg-white/80 border-b border-gray-100 backdrop-blur-md">
          {(['gastos','saldos'] as const).map((t) => (
            <TouchableOpacity 
              key={t} 
              onPress={() => setTab(t)} 
              className={`flex-1 py-4 items-center border-b-2 ${tab===t ? 'border-primary' : 'border-transparent'}`}
            >
              <Text className={`text-sm font-bold ${tab===t ? 'text-primary' : 'text-text-hint'}`}>
                {t === 'gastos' ? `GASTOS (${gastos.length})` : `SALDOS (${saldos.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ padding:24, paddingBottom:120 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
        >
          {tab === 'gastos'
            ? (gastos.length === 0
              ? <View className="items-center py-20"><Text className="text-6xl mb-4">🧾</Text><Text className="text-text text-xl font-bold">Sin gastos aún</Text><Text className="text-text-muted mt-2">Agreguen el primero pulsando +</Text></View>
              : gastos.map((g: Gasto) => <GastoItem key={g.id} gasto={g} />))
            : (saldos.length === 0
              ? <View className="items-center py-20"><Text className="text-6xl mb-4">🎉</Text><Text className="text-text text-xl font-bold">¡Todos al día!</Text><Text className="text-text-muted mt-2">No hay deudas pendientes en este grupo</Text></View>
              : saldos.map((x: Saldo, i: number) => <SaldoItem key={i} saldo={x} currentUserId={usuario?.id || ''} grupoId={id} />))
          }
        </ScrollView>

        <View className="absolute bottom-8 right-8">
           <TouchableOpacity 
            onPress={() => router.push(`/(app)/gastos/agregar?grupoId=${id}`)}
            className="w-16 h-16 bg-primary rounded-[24px] items-center justify-center shadow-premium shadow-primary/40"
          >
            <Ionicons name="add" size={32} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
