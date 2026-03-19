import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGrupo, useGastosGrupo, useEnviarRecordatorio } from '../../../src/hooks/useGrupos';
import { useAuthStore } from '../../../src/store/auth.store';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { MontoDisplay } from '../../../src/components/ui/MontoDisplay';
import type { Gasto, Saldo } from '../../../src/types';

function GastoItem({ gasto }: { gasto: Gasto }) {
  const CATEGORY_ICONS: Record<string, string> = {
    comida: '🍽️',
    transporte: '🚗',
    entretenimiento: '🎬',
    alojamiento: '🏠',
    compras: '🛒',
    otro: '💸',
  };

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/gastos/${gasto.id}`)}
      activeOpacity={0.85}
    >
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 gap-3">
            <Text className="text-2xl">{CATEGORY_ICONS[gasto.categoria] || '💸'}</Text>
            <View className="flex-1">
              <Text className="text-texto font-semibold" numberOfLines={1}>
                {gasto.descripcion}
              </Text>
              <Text className="text-texto-hint text-xs mt-0.5">
                Pagó {gasto.pagador.nombre}
              </Text>
            </View>
          </View>
          <MontoDisplay centavos={gasto.montoTotal} className="font-semibold text-texto" />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function SaldoItem({
  saldo,
  currentUserId,
  grupoId,
}: {
  saldo: Saldo;
  currentUserId: string;
  grupoId: string;
}) {
  const { mutateAsync: enviarRecordatorio } = useEnviarRecordatorio(grupoId);
  const esTuDeuda = saldo.deudorId === currentUserId;
  const esTuAcreencia = saldo.acreedorId === currentUserId;

  const handlePagar = () => {
    router.push(
      `/(app)/pagos/pagar?deudorId=${saldo.deudorId}&acreedorId=${saldo.acreedorId}&monto=${saldo.monto}&grupoId=${grupoId}&nombre=${saldo.acreedorNombre}`
    );
  };

  const handleRecordar = async () => {
    Alert.alert('Enviar recordatorio', '¿Con qué tono?', [
      {
        text: 'Suave',
        onPress: async () => {
          try {
            await enviarRecordatorio({ deudorId: saldo.deudorId, tono: 'suave' });
            Alert.alert('✓', 'Recordatorio enviado');
          } catch {
            Alert.alert('Error', 'No se pudo enviar el recordatorio');
          }
        },
      },
      {
        text: 'Directo',
        onPress: async () => {
          try {
            await enviarRecordatorio({ deudorId: saldo.deudorId, tono: 'directo' });
            Alert.alert('✓', 'Recordatorio enviado');
          } catch {
            Alert.alert('Error', 'No se pudo enviar el recordatorio');
          }
        },
      },
      {
        text: 'Urgente',
        style: 'destructive',
        onPress: async () => {
          try {
            await enviarRecordatorio({ deudorId: saldo.deudorId, tono: 'urgente' });
            Alert.alert('✓', 'Recordatorio enviado');
          } catch {
            Alert.alert('Error', 'No se pudo enviar el recordatorio');
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-texto font-medium">
            {esTuDeuda ? 'Debes a ' : ''}
            {esTuAcreencia ? '' : saldo.deudorNombre}
            {esTuAcreencia ? `${saldo.deudorNombre} te debe` : ''}
            {!esTuDeuda && !esTuAcreencia
              ? `${saldo.deudorNombre} → ${saldo.acreedorNombre}`
              : ''}
          </Text>
          {(esTuDeuda || esTuAcreencia) && (
            <Text className="text-texto-hint text-xs mt-0.5">
              {esTuDeuda ? `a ${saldo.acreedorNombre}` : ''}
            </Text>
          )}
        </View>
        <View className="items-end gap-2">
          <MontoDisplay
            centavos={saldo.monto}
            className={`font-bold text-base ${esTuDeuda ? 'text-rojo' : esTuAcreencia ? 'text-verde' : 'text-texto'}`}
          />
          {esTuDeuda && (
            <TouchableOpacity
              onPress={handlePagar}
              className="bg-primary px-3 py-1.5 rounded-lg"
            >
              <Text className="text-white text-xs font-semibold">Pagar</Text>
            </TouchableOpacity>
          )}
          {esTuAcreencia && (
            <TouchableOpacity
              onPress={handleRecordar}
              className="bg-ambar/10 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-ambar text-xs font-semibold">Recordar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Card>
  );
}

export default function GrupoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario } = useAuthStore();
  const { data: grupo, isLoading, refetch, isRefetching } = useGrupo(id);
  const { data: gastosData } = useGastosGrupo(id);
  const [tab, setTab] = useState<'gastos' | 'saldos'>('gastos');

  const handleShareInvite = async () => {
    const link = grupo?.linkInvitacion;
    if (!link) return;
    await Share.share({
      message: `Únete a "${grupo?.nombre}" en Junto: junto://unirse/${link}`,
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-fondo">
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  if (!grupo) {
    return (
      <View className="flex-1 items-center justify-center bg-fondo">
        <Text className="text-texto-secundario">Grupo no encontrado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-fondo">
      {/* Header */}
      <View className="px-4 pt-4 pb-0 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShareInvite}>
            <Ionicons name="person-add-outline" size={24} color="#534AB7" />
          </TouchableOpacity>
        </View>

        <Text className="text-2xl font-bold text-texto mb-1">{grupo.nombre}</Text>
        <Text className="text-texto-hint text-sm mb-4">
          {grupo.miembros.length} miembros
        </Text>

        {/* Tabs */}
        <View className="flex-row">
          {(['gastos', 'saldos'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 py-3 border-b-2 ${tab === t ? 'border-primary' : 'border-transparent'}`}
            >
              <Text
                className={`text-center font-medium capitalize ${tab === t ? 'text-primary' : 'text-texto-secundario'}`}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#534AB7" />
        }
      >
        {tab === 'gastos' ? (
          <>
            {gastosData?.gastos.length === 0 ? (
              <View className="items-center py-16">
                <Text className="text-4xl mb-4">🧾</Text>
                <Text className="text-texto-secundario text-lg">Sin gastos aún</Text>
              </View>
            ) : (
              gastosData?.gastos.map((gasto) => <GastoItem key={gasto.id} gasto={gasto} />)
            )}
          </>
        ) : (
          <>
            {grupo.saldos.length === 0 ? (
              <View className="items-center py-16">
                <Text className="text-4xl mb-4">🎉</Text>
                <Text className="text-texto-secundario text-lg">¡Todos están al día!</Text>
              </View>
            ) : (
              grupo.saldos.map((saldo, i) => (
                <SaldoItem
                  key={i}
                  saldo={saldo}
                  currentUserId={usuario?.id || ''}
                  grupoId={id}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* FAB — Agregar gasto */}
      <TouchableOpacity
        onPress={() => router.push(`/(app)/gastos/agregar?grupoId=${id}`)}
        className="absolute bottom-8 right-6 bg-primary w-14 h-14 rounded-full items-center justify-center"
        style={{ elevation: 6, shadowColor: '#534AB7', shadowOpacity: 0.4, shadowRadius: 8 }}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
