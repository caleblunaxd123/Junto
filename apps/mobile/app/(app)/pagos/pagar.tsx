import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StatusBar, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../../src/store/auth.store';
import { api } from '../../../src/lib/api';
import { GradientButton } from '../../../src/components/ui/GradientButton';
import { Input } from '../../../src/components/ui/Input';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { centavosASoles } from '../../../src/types';

type MetodoPago = 'yape' | 'plin' | 'tarjeta';

const METODOS = [
  { value: 'yape' as const, label: 'Yape', emoji: '💜', desc: 'Pago rápido con código OTP', color: '#7422B2' },
  { value: 'plin' as const, label: 'Plin', emoji: '💙', desc: 'Transferencia bancaria directa', color: '#10B981' },
  { value: 'tarjeta' as const, label: 'Tarjeta', emoji: '💳', desc: 'Visa / Mastercard via Culqi', color: '#6366F1' },
];

export default function PagarScreen() {
  const { deudorId, acreedorId, monto, grupoId, nombre } = useLocalSearchParams<{
    deudorId: string; acreedorId: string; monto: string; grupoId: string; nombre: string;
  }>();
  const { usuario } = useAuthStore();

  const montoNum = parseInt(monto || '0');
  const feejunto = Math.round(montoNum * 0.01);
  const montoTotal = montoNum + feejunto;

  const [metodo, setMetodo] = useState<MetodoPago>('yape');
  const [celular, setCelular] = useState('');
  const [otp, setOtp] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pagadoExitoso, setPagadoExitoso] = useState(false);

  const handlePagar = async () => {
    if (metodo === 'yape' || metodo === 'plin') {
      if (!celular || !/^9\d{8}$/.test(celular)) return Alert.alert('Error', 'Ingresa tu número celular (9XXXXXXXX)');
      if (!otp || otp.length !== 6) return Alert.alert('Error', 'Ingresa el código OTP de 6 dígitos');
    }
    setIsProcessing(true);
    try {
      await api.post('/pagos/procesar', {
        tokenId: `tok_test_${Date.now()}`,
        deudorId, acreedorId, grupoId,
        monto: montoNum, metodo,
        email: usuario?.email,
      });
      setPagadoExitoso(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      Alert.alert('Pago rechazado', e?.response?.data?.error || 'No se pudo procesar el pago. Intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (pagadoExitoso) {
    return (
      <View className="flex-1 bg-success">
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <SafeAreaView className="flex-1 items-center justify-center p-8">
          <View className="w-28 h-28 bg-white/20 rounded-[40px] items-center justify-center mb-8 border border-white/30">
            <Ionicons name="checkmark-done" size={60} color="white" />
          </View>
          <Text className="text-white text-4xl font-black text-center mb-2">¡Pago listo!</Text>
          <Text className="text-white/80 text-lg font-medium text-center mb-10">
            Pagaste S/ {centavosASoles(montoNum)} a {nombre}
          </Text>
          
          <GlassCard className="p-6 w-full mb-10 border border-white/30" intensity={1.5}>
            <Text className="text-white/70 text-xs font-bold uppercase tracking-widest text-center mb-2">Confirmación</Text>
            <Text className="text-white text-center font-medium leading-6">
              El grupo ha sido actualizado y {nombre} recibirá una notificación inmediata.
            </Text>
          </GlassCard>

          <TouchableOpacity 
            onPress={() => router.replace(`/(app)/grupos/${grupoId}`)}
            className="w-full h-16 bg-white rounded-2xl items-center justify-center shadow-premium"
          >
            <Text className="text-success font-black text-lg">Volver al grupo</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

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
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center border border-white/30"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black">Pagar Deuda</Text>
          <View className="w-10" />
        </View>

        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary Card */}
          <GlassCard className="p-6 mb-8 border border-white/30" intensity={1.2}>
            <Text className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Pagando a</Text>
            <Text className="text-white text-3xl font-black mb-6">{nombre}</Text>
            
            <View className="space-y-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-white/70 font-medium">Deuda original</Text>
                <Text className="text-white font-bold text-lg">S/ {centavosASoles(montoNum)}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-white/70 font-medium">Comisión Junto (1%)</Text>
                <Text className="text-white font-bold">S/ {centavosASoles(feejunto)}</Text>
              </View>
              <View className="h-[1px] bg-white/20 my-2" />
              <View className="flex-row justify-between items-center">
                <Text className="text-white text-lg font-black tracking-tight">Total a pagar</Text>
                <Text className="text-white text-2xl font-black tracking-tighter">S/ {centavosASoles(montoTotal)}</Text>
              </View>
            </View>
          </GlassCard>

          <Text className="text-text font-extrabold text-lg mb-4 tracking-tight">Método de pago</Text>
          <View className="space-y-3 mb-8">
            {METODOS.map((m) => {
              const sel = metodo === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setMetodo(m.value)}
                  className={`flex-row items-center p-4 rounded-3xl border-2 ${
                    sel ? 'bg-white border-primary shadow-premium' : 'bg-white border-gray-100'
                  }`}
                >
                  <View 
                    style={{ backgroundColor: `${m.color}10` }}
                    className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
                  >
                    <Text className="text-3xl">{m.emoji}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className={`text-base font-bold ${sel ? 'text-primary' : 'text-text'}`}>{m.label}</Text>
                    <Text className="text-text-hint text-xs mt-0.5">{m.desc}</Text>
                  </View>
                  <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${sel ? 'border-primary' : 'border-gray-200'}`}>
                    {sel && <View className="w-3 h-3 rounded-full bg-primary" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Form based on method */}
          {(metodo === 'yape' || metodo === 'plin') && (
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 mb-8 shadow-sm">
              <Text className="text-text font-black text-lg mb-6 leading-tight">
                Datos de tu {metodo === 'yape' ? 'Yape' : 'Plin'}
              </Text>
              
              <View className="mb-6">
                <Input
                  label="Número de celular"
                  value={celular}
                  onChangeText={setCelular}
                  placeholder="9XXXXXXXX"
                  keyboardType="phone-pad"
                  maxLength={9}
                  leftIcon={<Ionicons name="phone-portrait-outline" size={20} color="#6366F1" />}
                />
              </View>

              <View className="bg-primary/5 p-5 rounded-2xl mb-6 border border-primary/10">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="help-circle" size={20} color="#6366F1" />
                  <Text className="text-primary font-black text-sm ml-2">¿Cómo obtener el código?</Text>
                </View>
                <Text className="text-primary/80 text-xs font-medium leading-5">
                  1. Abre tu app de {metodo === 'yape' ? 'Yape' : 'Plin'}{"\n"}
                  2. Ve a <Text className="font-bold">Cobrar → Código de pago</Text>{"\n"}
                  3. Ingresa el código de 6 dígitos aquí
                </Text>
              </View>

              <Input
                label="Código OTP de 6 dígitos"
                value={otp}
                onChangeText={setOtp}
                placeholder="000 000"
                keyboardType="numeric"
                maxLength={6}
                leftIcon={<Ionicons name="key-outline" size={20} color="#6366F1" />}
              />
            </View>
          )}

          {metodo === 'tarjeta' && (
            <View className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex-row mb-8">
              <Ionicons name="lock-closed" size={20} color="#D97706" />
              <Text className="text-amber-800 text-xs font-medium leading-5 ml-3 flex-1">
                Serás redirigido a la pasarela segura de <Text className="font-bold">Culqi</Text> para procesar tu tarjeta de forma privada y segura.
              </Text>
            </View>
          )}

          <GradientButton
            title={`Confirmar Pago · S/ ${centavosASoles(montoTotal)}`}
            onPress={handlePagar}
            loading={isProcessing}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
