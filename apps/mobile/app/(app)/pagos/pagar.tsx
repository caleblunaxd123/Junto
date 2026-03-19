import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useAuthStore } from '../../../src/store/auth.store';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { MontoDisplay } from '../../../src/components/ui/MontoDisplay';
import type { Usuario } from '@junto/shared';

type MetodoPago = 'yape' | 'plin' | 'tarjeta';

const METODOS = [
  { value: 'yape' as const, label: 'Yape', emoji: '💜', color: '#6C34B0', desc: 'Código OTP de tu app' },
  { value: 'plin' as const, label: 'Plin', emoji: '💙', color: '#0066CC', desc: 'Código de tu app Plin' },
  { value: 'tarjeta' as const, label: 'Tarjeta', emoji: '💳', color: '#1D9E75', desc: 'Visa / Mastercard' },
];

export default function PagarScreen() {
  const { deudorId, acreedorId, monto, grupoId, nombre } = useLocalSearchParams<{
    deudorId: string;
    acreedorId: string;
    monto: string;
    grupoId: string;
    nombre: string;
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

  const { data: acreedor } = useQuery<Pick<Usuario, 'id' | 'nombre' | 'email'>>({
    queryKey: ['usuario', acreedorId],
    queryFn: () => api.get(`/auth/me`).then((r) => r.data), // simplified, would need a user endpoint
    enabled: false,
  });

  const handlePagar = async () => {
    if (metodo === 'yape' || metodo === 'plin') {
      if (!celular || !/^9\d{8}$/.test(celular)) {
        Alert.alert('Error', 'Ingresa tu número celular (9XXXXXXXX)');
        return;
      }
      if (!otp || otp.length !== 6) {
        Alert.alert('Error', 'Ingresa el código OTP de 6 dígitos');
        return;
      }
    }

    setIsProcessing(true);
    try {
      // In a real implementation, you'd use Culqi.js SDK to tokenize
      // For MVP, we simulate the token generation
      const tokenId = `tok_test_${Date.now()}`; // Replace with real Culqi.js token

      await api.post('/pagos/procesar', {
        tokenId,
        deudorId,
        acreedorId,
        grupoId,
        monto: montoNum,
        metodo,
        email: usuario?.email,
      });

      setPagadoExitoso(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      Alert.alert('Pago rechazado', error?.response?.data?.error || 'No se pudo procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  if (pagadoExitoso) {
    return (
      <SafeAreaView className="flex-1 bg-fondo">
        <View className="flex-1 items-center justify-center px-8">
          <View className="bg-green-50 w-28 h-28 rounded-full items-center justify-center mb-8">
            <Text className="text-6xl">✅</Text>
          </View>
          <Text className="text-3xl font-bold text-texto text-center mb-3">
            ¡Pago exitoso!
          </Text>
          <Text className="text-texto-secundario text-center mb-2">
            Pagaste S/{(montoNum / 100).toFixed(2)} a {nombre}
          </Text>
          <Text className="text-texto-hint text-sm text-center mb-12">
            {nombre} recibirá una notificación 💚
          </Text>
          <Button
            title="Volver al grupo"
            onPress={() => router.replace(`/(app)/grupos/${grupoId}`)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-fondo">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-4 pb-8">
          {/* Header */}
          <View className="flex-row items-center mb-8">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-texto">Pagar deuda</Text>
          </View>

          {/* Resumen */}
          <View className="bg-primary-50 rounded-card p-5 mb-6">
            <Text className="text-texto-secundario text-sm mb-1">Pagas a</Text>
            <Text className="text-texto text-xl font-bold mb-4">{nombre}</Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-texto-secundario">Deuda</Text>
              <MontoDisplay centavos={montoNum} className="text-texto font-medium" />
            </View>
            <View className="flex-row justify-between mb-3">
              <Text className="text-texto-secundario">Comisión Junto (1%)</Text>
              <MontoDisplay centavos={feejunto} className="text-texto font-medium" />
            </View>
            <View className="border-t border-primary/20 pt-3 flex-row justify-between">
              <Text className="text-texto font-bold">Total</Text>
              <MontoDisplay centavos={montoTotal} className="text-primary font-bold text-lg" />
            </View>
          </View>

          {/* Método de pago */}
          <Text className="text-texto-secundario font-medium mb-3">Método de pago</Text>
          <View className="gap-2 mb-6">
            {METODOS.map((m) => (
              <TouchableOpacity
                key={m.value}
                onPress={() => setMetodo(m.value)}
                className={`flex-row items-center p-4 rounded-card border ${
                  metodo === m.value
                    ? 'border-primary bg-primary-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Text className="text-3xl mr-3">{m.emoji}</Text>
                <View className="flex-1">
                  <Text
                    className={`font-semibold ${metodo === m.value ? 'text-primary' : 'text-texto'}`}
                  >
                    {m.label}
                  </Text>
                  <Text className="text-texto-hint text-xs">{m.desc}</Text>
                </View>
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                    metodo === m.value ? 'border-primary' : 'border-gray-300'
                  }`}
                >
                  {metodo === m.value && <View className="w-3 h-3 rounded-full bg-primary" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Yape / Plin fields */}
          {(metodo === 'yape' || metodo === 'plin') && (
            <View className="bg-white rounded-card p-4 border border-gray-200 mb-6">
              <Text className="text-texto font-semibold mb-4">
                Datos de {metodo === 'yape' ? 'Yape' : 'Plin'}
              </Text>
              <Input
                label="Tu número de celular"
                placeholder="9XXXXXXXX"
                keyboardType="phone-pad"
                maxLength={9}
                onChangeText={setCelular}
                value={celular}
                leftIcon={<Text className="text-texto-hint">+51</Text>}
              />
              <View className="bg-primary-50 rounded-xl p-4 mb-4">
                <Text className="text-primary text-sm font-medium mb-1">
                  ¿Cómo obtener el código OTP?
                </Text>
                <Text className="text-primary/70 text-xs">
                  1. Abre tu app de {metodo === 'yape' ? 'Yape' : 'Plin'}{'\n'}
                  2. Ve a Cobrar → Código de pago{'\n'}
                  3. Ingresa el código de 6 dígitos aquí
                </Text>
              </View>
              <Input
                label="Código OTP (6 dígitos)"
                placeholder="123456"
                keyboardType="numeric"
                maxLength={6}
                onChangeText={setOtp}
                value={otp}
                leftIcon={<Ionicons name="key-outline" size={20} color="#9CA3AF" />}
              />
            </View>
          )}

          {metodo === 'tarjeta' && (
            <View className="bg-amber-50 rounded-card p-4 border border-amber-200 mb-6">
              <Text className="text-ambar text-sm">
                💳 Para pago con tarjeta, serás redirigido al formulario seguro de Culqi
              </Text>
            </View>
          )}

          <Button
            title={isProcessing ? 'Procesando...' : `Pagar S/${(montoTotal / 100).toFixed(2)}`}
            onPress={handlePagar}
            loading={isProcessing}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
