import React from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StatusBar, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { centavosASoles } from '../../src/types';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { router } from 'expo-router';

export default function PerfilScreen() {
  const { usuario, logout } = useAuthStore();

  const { data: historialPagos, isLoading: loadingPagos } = useQuery({
    queryKey: ['pagos', 'historial'],
    queryFn: () => api.get('/pagos/historial').then((r) => r.data),
  });

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro que quieres salir de Junto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
    ]);
  };

  const inicial = usuario?.nombre?.charAt(0).toUpperCase() || 'U';

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
        {/* Header */}
        <View className="px-6 pt-4 pb-10 items-center">
          <View className="w-full flex-row justify-between items-center mb-6">
            <TouchableOpacity 
              onPress={() => router.push('/(app)/perfil/editar')}
              className="bg-white/20 px-4 py-2 rounded-xl flex-row items-center border border-white/30"
            >
              <Ionicons name="pencil" size={16} color="white" />
              <Text className="text-white ml-2 font-bold text-xs uppercase tracking-wider">Editar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleLogout}
              className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center border border-white/30"
            >
              <Ionicons name="log-out-outline" size={22} color="white" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => router.push('/(app)/perfil/editar')}
            className="items-center"
          >
            <View className="relative">
              <View className="w-24 h-24 bg-white/20 rounded-[32px] items-center justify-center mb-4 border-2 border-white/40 shadow-sm overflow-hidden">
                {usuario?.fotoUrl ? (
                  <Image source={{ uri: usuario.fotoUrl }} className="w-full h-full" />
                ) : (
                  <Text className="text-white text-4xl font-black">{inicial}</Text>
                )}
              </View>
              <View className="absolute bottom-2 right-[-4px] w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-indigo-500 shadow-sm">
                <Ionicons name="camera" size={14} color="white" />
              </View>
            </View>
            <Text className="text-white text-2xl font-black mb-1">{usuario?.nombre}</Text>
            <Text className="text-white/70 font-medium mb-3">{usuario?.email}</Text>
          </TouchableOpacity>
            
            {usuario?.emailVerificado && (
              <View className="flex-row items-center bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <Text className="text-white text-[10px] font-black uppercase tracking-wider ml-1.5">Verificado</Text>
              </View>
            )}
          </View>

        {/* Content */}
        <ScrollView 
          className="flex-1 bg-background-alt rounded-t-[40px] -mt-4 shadow-2xl"
          contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Info Section */}
          <Text className="text-text font-extrabold text-lg mb-4 tracking-tight">Información de Cuenta</Text>
          <View className="bg-white rounded-[32px] border border-gray-100 p-2 mb-8 shadow-sm">
            <InfoRow icon="person-outline" label="Nombre" value={usuario?.nombre || ''} />
            <InfoRow icon="mail-outline" label="Email" value={usuario?.email || ''} />
            {usuario?.celular && (
              <InfoRow icon="call-outline" label="Celular" value={`+51 ${usuario.celular}`} last />
            )}
          </View>

          {/* Payment History */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-text font-extrabold text-lg tracking-tight">Actividad de Pagos</Text>
            {historialPagos && historialPagos.length > 5 && (
              <TouchableOpacity>
                <Text className="text-primary font-bold text-xs">Ver todo</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingPagos ? (
            <ActivityIndicator color="#6366F1" className="my-10" />
          ) : !historialPagos || historialPagos.length === 0 ? (
            <View className="bg-white rounded-[32px] border border-gray-100 p-10 items-center justify-center shadow-sm">
              <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4">
                <Ionicons name="card-outline" size={32} color="#D1D5DB" />
              </View>
              <Text className="text-text font-bold text-base mb-1">Sin pagos aún</Text>
              <Text className="text-text-hint text-xs text-center">Tus transacciones aparecerán aquí.</Text>
            </View>
          ) : (
            <View className="bg-white rounded-[32px] border border-gray-100 p-2 shadow-sm">
              {historialPagos.slice(0, 5).map((pago: any, idx: number) => {
                const esPagador = pago.pagador.id === usuario?.id;
                return (
                  <View 
                    key={pago.id} 
                    className={`flex-row items-center p-4 ${idx < (historialPagos.length > 5 ? 4 : historialPagos.length - 1) ? 'border-b border-gray-50' : ''}`}
                  >
                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${esPagador ? 'bg-red-50' : 'bg-emerald-50'}`}>
                      <Ionicons 
                        name={esPagador ? 'arrow-up' : 'arrow-down'} 
                        size={20} 
                        color={esPagador ? '#EF4444' : '#10B981'} 
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-text font-bold text-sm leading-tight mb-1" numberOfLines={1}>
                        {esPagador ? `A ${pago.receptor.nombre}` : `De ${pago.pagador.nombre}`}
                      </Text>
                      <Text className="text-text-hint text-[10px] font-medium uppercase tracking-widest">
                        {pago.grupo.nombre} · {pago.metodo || 'Junto'}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className={`font-black text-base tracking-tighter ${esPagador ? 'text-red-500' : 'text-emerald-500'}`}>
                        {esPagador ? '-' : '+'}S/ {centavosASoles(pago.monto)}
                      </Text>
                      <Text className="text-[9px] font-black text-text-hint uppercase tracking-tighter">{pago.estado}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View className="mt-10 items-center">
            <Text className="text-text-hint text-[10px] font-black uppercase tracking-[4px] mb-2">Junto v1.3.0</Text>
            <View className="flex-row items-center bg-gray-100 px-3 py-1 rounded-full">
              <Text className="text-text-hint text-[10px] font-bold">Hecho en Perú 🇵🇪</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center p-4 ${!last ? 'border-b border-gray-50' : ''}`}>
      <View className="w-10 h-10 bg-primary/5 rounded-xl items-center justify-center mr-4 border border-primary/10">
        <Ionicons name={icon} size={20} color="#6366F1" />
      </View>
      <View className="flex-1">
        <Text className="text-text-hint font-bold text-[10px] uppercase tracking-wider mb-0.5">{label}</Text>
        <Text className="text-text font-bold text-base">{value}</Text>
      </View>
    </View>
  );
}
