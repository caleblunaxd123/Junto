import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StatusBar, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/lib/api';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

const emailSchema = z.object({ email: z.string().email('Email inválido') });
const otpSchema = z.object({
  otp: z.string().length(6, 'El código debe tener 6 dígitos'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres').regex(/d/, 'Debe incluir al menos un número'),
});

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');

  const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  const otpForm = useForm<z.infer<typeof otpSchema>>({ resolver: zodResolver(otpSchema) });

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
      await api.post('/auth/reset-password', { email, otp: data.otp, newPassword: data.newPassword });
      Alert.alert('Listo!', 'Contraseña actualizada correctamente', [
        { text: 'Ingresar', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch {
      Alert.alert('Error', 'Código incorrecto o expirado');
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#534AB7" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => (step === 'otp' ? setStep('email') : router.back())} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {step === 'email' ? 'Recuperar contraseña' : 'Ingresa el código'}
          </Text>
          <Text style={s.headerSub}>
            {step === 'email'
              ? 'Te enviaremos un código de 6 dígitos a tu email'
              : 'Enviamos un código a ' + email}
          </Text>
        </View>

        <ScrollView
          style={s.form}
          contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'email' ? (
            <>
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
                    leftIcon={<Ionicons name="mail-outline" size={20} color="#534AB7" />}
                  />
                )}
              />
              <Button
                title="Enviar código"
                onPress={emailForm.handleSubmit(sendOTP)}
                loading={emailForm.formState.isSubmitting}
                style={{ marginTop: 8 }}
              />
            </>
          ) : (
            <>
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
                    leftIcon={<Ionicons name="key-outline" size={20} color="#534AB7" />}
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
                    leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#534AB7" />}
                  />
                )}
              />
              <Button
                title="Cambiar contraseña"
                onPress={otpForm.handleSubmit(resetPassword)}
                loading={otpForm.formState.isSubmitting}
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#534AB7' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  backBtn: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 20 },
  form: { flex: 1, backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
});
