import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGrupos } from '../../src/hooks/useGrupos';
import { useAuthStore } from '../../src/store/auth.store';
import { Card } from '../../src/components/ui/Card';
import { MontoDisplay } from '../../src/components/ui/MontoDisplay';
import type { GrupoConBalance } from '@junto/shared';

function GrupoCard({ grupo }: { grupo: GrupoConBalance }) {
  const { neto, teDeben, debes } = grupo.balanceUsuario;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/grupos/${grupo.id}`)}
      activeOpacity={0.85}
    >
      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-texto font-semibold text-lg">{grupo.nombre}</Text>
              <View className="bg-primary-50 px-2 py-0.5 rounded-full">
                <Text className="text-primary text-xs">{grupo.tipo}</Text>
              </View>
            </View>
            <Text className="text-texto-hint text-sm">
              {grupo.miembros.length} miembro{grupo.miembros.length !== 1 ? 's' : ''}
            </Text>
          </View>

          <View className="items-end">
            {neto === 0 ? (
              <Text className="text-texto-secundario text-sm">Estás al día ✓</Text>
            ) : (
              <>
                <MontoDisplay
                  centavos={Math.abs(neto)}
                  colorize
                  className="text-base font-semibold"
                />
                <Text className="text-texto-hint text-xs">
                  {neto > 0 ? 'te deben' : 'debes'}
                </Text>
              </>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { usuario } = useAuthStore();
  const { data: grupos, isLoading, refetch, isRefetching } = useGrupos();

  const totalTeDeben = grupos?.reduce((acc, g) => acc + g.balanceUsuario.teDeben, 0) ?? 0;
  const totalDebes = grupos?.reduce((acc, g) => acc + g.balanceUsuario.debes, 0) ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-fondo">
      {/* Header */}
      <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-texto-secundario text-sm">Hola,</Text>
            <Text className="text-texto text-xl font-bold">{usuario?.nombre?.split(' ')[0]} 👋</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/grupos/crear')}
            className="bg-primary w-11 h-11 rounded-2xl items-center justify-center"
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Balance summary */}
        {(totalTeDeben > 0 || totalDebes > 0) && (
          <View className="flex-row gap-3 pb-4">
            {totalTeDeben > 0 && (
              <View className="flex-1 bg-green-50 rounded-xl p-3">
                <Text className="text-verde text-xs mb-1">Te deben</Text>
                <MontoDisplay centavos={totalTeDeben} className="text-verde font-bold text-base" />
              </View>
            )}
            {totalDebes > 0 && (
              <View className="flex-1 bg-red-50 rounded-xl p-3">
                <Text className="text-rojo text-xs mb-1">Debes</Text>
                <MontoDisplay centavos={totalDebes} className="text-rojo font-bold text-base" />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Grupos list */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#534AB7" />
        </View>
      ) : (
        <FlatList
          data={grupos || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <GrupoCard grupo={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#534AB7"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="people-outline" size={64} color="#D1D5DB" />
              <Text className="text-texto-secundario text-lg mt-4 font-medium">
                Aún no tienes grupos
              </Text>
              <Text className="text-texto-hint text-center mt-2 px-8">
                Crea un grupo e invita a tus amigos para dividir gastos
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/grupos/crear')}
                className="mt-6 bg-primary px-6 py-3 rounded-btn"
              >
                <Text className="text-white font-semibold">Crear mi primer grupo</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
