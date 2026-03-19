import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

const emailSchema = z.object({ email: z.string().email('Email inválido') });
const otpSchema = z.object({
  otp: z.string().length(6, 'El código debe tener 6 dígitos'),
  newPassword: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/\d/, 'Debe incluir al menos un número'),
});

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
  });
  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
  });

  const sendOTP = async (data: z.infer<typeof emailSchema>) => {
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setEmail(data.email);
      setStep('otp');
    } catch {
      Alert.alert('Error', 'No se pudo enviar el código. Inténtalo de nuevo.');
    }
  };

  const resetPassword = async (data: z.infer<typeof otpSchema>) => {
    try {
      await api.post('/auth/reset-password', {
        email,
        otp: data.otp,
        newPassword: data.newPassword,
      });
      Alert.alert('¡Listo!', 'Contraseña actualizada correctamente', [
        { text: 'Ingresar', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch {
      Alert.alert('Error', 'Código incorrecto o expirado');
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-fondo"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-1 px-6 pt-16 pb-8">
        <TouchableOpacity onPress={() => (step === 'otp' ? setStep('email') : router.back())} className="mb-8">
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        {step === 'email' ? (
          <>
            <View className="mb-8">
              <Text className="text-3xl font-bold text-texto">Recuperar contraseña</Text>
              <Text className="text-texto-secundario mt-2">
                Te enviaremos un código de 6 dígitos a tu email
              </Text>
            </View>

            <Controller
              control={emailForm.control}
              name="email"
              render={({ field: { onChange, value, ref } }) => (
                <Input
                  ref={ref}
                  label="Email"
                  placeholder="tu@email.com"
                  keyboardType="email-address"
                  onChangeText={onChange}
                  value={value}
                  error={emailForm.formState.errors.email?.message}
                  leftIcon={<Ionicons name="mail-outline" size={20} color="#9CA3AF" />}
                />
              )}
            />

            <Button
              title="Enviar código"
              onPress={emailForm.handleSubmit(sendOTP)}
              loading={emailForm.formState.isSubmitting}
              className="mt-2"
            />
          </>
        ) : (
          <>
            <View className="mb-8">
              <Text className="text-3xl font-bold text-texto">Ingresa el código</Text>
              <Text className="text-texto-secundario mt-2">
                Enviamos un código de 6 dígitos a {email}
              </Text>
            </View>

            <Controller
              control={otpForm.control}
              name="otp"
              render={({ field: { onChange, value, ref } }) => (
                <Input
                  ref={ref}
                  label="Código OTP"
                  placeholder="123456"
                  keyboardType="numeric"
                  maxLength={6}
                  onChangeText={onChange}
                  value={value}
                  error={otpForm.formState.errors.otp?.message}
                  leftIcon={<Ionicons name="key-outline" size={20} color="#9CA3AF" />}
                />
              )}
            />

            <Controller
              control={otpForm.control}
              name="newPassword"
              render={({ field: { onChange, value, ref } }) => (
                <Input
                  ref={ref}
                  label="Nueva contraseña"
                  placeholder="••••••••"
                  secureTextEntry
                  onChangeText={onChange}
                  value={value}
                  error={otpForm.formState.errors.newPassword?.message}
                  leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />}
                />
              )}
            />

            <Button
              title="Cambiar contraseña"
              onPress={otpForm.handleSubmit(resetPassword)}
              loading={otpForm.formState.isSubmitting}
              className="mt-2"
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}
