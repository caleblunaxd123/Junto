import React from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

export default function PerfilScreen() {
  const { usuario, logout } = useAuthStore();

  const { data: historialPagos } = useQuery({
    queryKey: ['pagos', 'historial'],
    queryFn: () => api.get('/pagos/historial').then((r) => r.data),
  });

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-fondo">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-6 pb-4">
          <Text className="text-2xl font-bold text-texto mb-6">Perfil</Text>

          {/* Avatar + info */}
          <Card>
            <View className="flex-row items-center gap-4">
              <View className="w-16 h-16 rounded-full bg-primary-50 items-center justify-center">
                <Text className="text-primary text-2xl font-bold">
                  {usuario?.nombre?.charAt(0) || 'U'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-texto text-lg font-bold">{usuario?.nombre}</Text>
                <Text className="text-texto-secundario text-sm">{usuario?.email}</Text>
                {usuario?.celular && (
                  <Text className="text-texto-hint text-sm">+51 {usuario.celular}</Text>
                )}
              </View>
              {usuario?.emailVerificado && (
                <View className="bg-green-50 px-2 py-1 rounded-full flex-row items-center gap-1">
                  <Ionicons name="checkmark-circle" size={14} color="#1D9E75" />
                  <Text className="text-verde text-xs">Verificado</Text>
                </View>
              )}
            </View>
          </Card>

          {/* Historial de pagos */}
          <Text className="text-texto-secundario font-medium mb-3 mt-4">
            Historial de pagos
          </Text>

          {!historialPagos || historialPagos.length === 0 ? (
            <Card>
              <View className="items-center py-6">
                <Text className="text-3xl mb-2">💳</Text>
                <Text className="text-texto-secundario text-sm">Sin pagos aún</Text>
              </View>
            </Card>
          ) : (
            historialPagos.slice(0, 5).map((pago: {
              id: string;
              pagador: { id: string; nombre: string };
              receptor: { id: string; nombre: string };
              monto: number;
              metodo: string;
              estado: string;
              fechaPago: string;
              grupo: { nombre: string };
            }) => (
              <Card key={pago.id}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-texto font-medium text-sm">
                      {pago.pagador.id === usuario?.id
                        ? `→ ${pago.receptor.nombre}`
                        : `← ${pago.pagador.nombre}`}
                    </Text>
                    <Text className="text-texto-hint text-xs">
                      {pago.grupo.nombre} · {pago.metodo?.toUpperCase()}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text
                      className={`font-semibold ${
                        pago.pagador.id === usuario?.id ? 'text-rojo' : 'text-verde'
                      }`}
                    >
                      {pago.pagador.id === usuario?.id ? '-' : '+'}S/
                      {(pago.monto / 100).toFixed(2)}
                    </Text>
                    <Text
                      className={`text-xs ${
                        pago.estado === 'exitoso' ? 'text-verde' : 'text-rojo'
                      }`}
                    >
                      {pago.estado}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}

          <View className="mt-6">
            <Button title="Cerrar sesión" variant="outline" onPress={handleLogout} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
