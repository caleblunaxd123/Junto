import React from 'react';
import { View, Text, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/auth.store';
import { GlassCard } from '../../src/components/ui/GlassCard';

const OPCIONES = [
  {
    tipo: 'viaje',
    emoji: '✈️',
    titulo: 'Crear un grupo de viaje',
    desc: 'Divide gastos en tus trips inolvidables',
    color: '#6366F1',
    icon: 'airplane-outline',
  },
  {
    tipo: 'roomies',
    emoji: '🏠',
    titulo: 'Gastos del depa',
    desc: 'Alquiler, servicios y refri compartida',
    color: '#10B981',
    icon: 'home-outline',
  },
  {
    tipo: 'amigos',
    emoji: '👥',
    titulo: 'Grupo de amigos',
    desc: 'Salidas, cenas y planes espontáneos',
    color: '#F59E0B',
    icon: 'people-outline',
  },
  {
    tipo: 'trabajo',
    emoji: '💼',
    titulo: 'Equipo de trabajo',
    desc: 'Gastos corporativos o para clientes',
    color: '#4F46E5',
    icon: 'briefcase-outline',
  },
];

export default function FirstActionScreen() {
  const { usuario } = useAuthStore();
  const primerNombre = usuario?.nombre?.split(' ')[0] || 'tú';

  return (
    <View className="flex-1 bg-background-alt">
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="items-center mb-10 pt-4">
            <View className="w-24 h-24 bg-primary/10 rounded-[32px] items-center justify-center mb-6">
              <Text className="text-5xl">🎉</Text>
            </View>
            <Text className="text-text text-3xl font-black text-center mb-2 tracking-tight">
              ¡Hola, {primerNombre}!
            </Text>
            <Text className="text-text-hint text-base font-medium text-center px-4 leading-6">
              Todo está listo. ¿Cuál será tu primer grupo en Junto?
            </Text>
          </View>

          {/* Opciones */}
          <View className="space-y-4 mb-10">
            {OPCIONES.map((op) => (
              <TouchableOpacity
                key={op.tipo}
                onPress={() => router.push(`/(app)/grupos/crear?tipo=${op.tipo}&fromOnboarding=true`)}
                activeOpacity={0.9}
                className="bg-white rounded-[32px] p-5 flex-row items-center border border-gray-100 shadow-sm"
              >
                <View 
                  style={{ backgroundColor: `${op.color}15` }}
                  className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
                >
                  <Text className="text-3xl">{op.emoji}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text font-black text-base mb-1">{op.titulo}</Text>
                  <Text className="text-text-hint text-xs font-medium">{op.desc}</Text>
                </View>
                <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Skip */}
          <TouchableOpacity
            className="items-center py-4 px-6 rounded-2xl bg-gray-50 border border-gray-100"
            onPress={() => router.replace('/(app)')}
          >
            <Text className="text-text-hint font-bold text-sm">Explorar sin crear grupo ahora</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
