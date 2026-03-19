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
import { useGrupos } from '../../src/hooks/useGrupos';
import { useAuthStore } from '../../src/store/auth.store';
import { MontoDisplay } from '../../src/components/ui/MontoDisplay';
import type { GrupoConBalance } from '../../src/types';
import { centavosASoles } from '../../src/types';

function GrupoCard({ grupo }: { grupo: GrupoConBalance }) {
  const { neto } = grupo.balanceUsuario;
  const positivo = neto > 0;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/grupos/${grupo.id}`)}
      activeOpacity={0.85}
      style={{
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: '#EEEDFE',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ fontSize: 22 }}>
            {grupo.tipo === 'viaje' ? '✈️' : grupo.tipo === 'casa' ? '🏠' : grupo.tipo === 'pareja' ? '💑' : '👥'}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>{grupo.nombre}</Text>
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
            {grupo.miembros.length} miembro{grupo.miembros.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          {neto === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={16} color="#1D9E75" />
              <Text style={{ color: '#1D9E75', fontSize: 13, fontWeight: '600' }}>Al día</Text>
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: positivo ? '#1D9E75' : '#E24B4A' }}>
                S/ {centavosASoles(Math.abs(neto)).toFixed(2)}
              </Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                {positivo ? 'te deben' : 'debes'}
              </Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { usuario } = useAuthStore();
  const { data: grupos, isLoading, refetch, isRefetching } = useGrupos();

  const totalTeDeben = grupos?.reduce((acc, g) => acc + g.balanceUsuario.teDeben, 0) ?? 0;
  const totalDebes = grupos?.reduce((acc, g) => acc + g.balanceUsuario.debes, 0) ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#534AB7' }}>
      <StatusBar barStyle="light-content" backgroundColor="#534AB7" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Purple header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Hola,</Text>
              <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold' }}>
                {usuario?.nombre?.split(' ')[0]} 👋
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(app)/grupos/crear')}
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Balance summary cards */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>Te deben</Text>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                S/ {centavosASoles(totalTeDeben).toFixed(2)}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 }}>Debes</Text>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                S/ {centavosASoles(totalDebes).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* White content area */}
        <View style={{ flex: 1, backgroundColor: '#F8F8F8', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#534AB7" />
            </View>
          ) : (
            <FlatList
              data={grupos || []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <GrupoCard grupo={item} />}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#534AB7" />
              }
              ListHeaderComponent={
                grupos && grupos.length > 0 ? (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 }}>
                    Mis grupos
                  </Text>
                ) : null
              }
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <View style={{ width: 80, height: 80, backgroundColor: '#EEEDFE', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 36 }}>👥</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 }}>
                    Aún no tienes grupos
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 32, lineHeight: 22 }}>
                    Crea un grupo e invita a tus amigos para dividir gastos juntos
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(app)/grupos/crear')}
                    style={{ marginTop: 24, backgroundColor: '#534AB7', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Crear mi primer grupo</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
