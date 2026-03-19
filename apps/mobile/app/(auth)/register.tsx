import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

const schema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  celular: z
    .string()
    .regex(/^9\d{8}$/, 'Formato: 9XXXXXXXX (9 dígitos, empieza en 9)'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/\d/, 'Debe incluir al menos un número'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const { register } = useAuthStore();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await register(data);
      router.replace('/(app)');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', error?.response?.data?.error || 'Error al crear la cuenta');
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-fondo"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-1 px-6 pt-16 pb-8">
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        <View className="mb-8">
          <Text className="text-3xl font-bold text-texto">Crear cuenta</Text>
          <Text className="text-texto-secundario mt-1">Únete a Junto y olvídate del drama</Text>
        </View>

        <Controller
          control={control}
          name="nombre"
          render={({ field: { onChange, value, ref } }) => (
            <Input
              ref={ref}
              label="Nombre completo"
              placeholder="Luis García"
              onChangeText={onChange}
              value={value}
              error={errors.nombre?.message}
              autoCapitalize="words"
              leftIcon={<Ionicons name="person-outline" size={20} color="#9CA3AF" />}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value, ref } }) => (
            <Input
              ref={ref}
              label="Email"
              placeholder="tu@email.com"
              keyboardType="email-address"
              onChangeText={onChange}
              value={value}
              error={errors.email?.message}
              leftIcon={<Ionicons name="mail-outline" size={20} color="#9CA3AF" />}
            />
          )}
        />

        <Controller
          control={control}
          name="celular"
          render={({ field: { onChange, value, ref } }) => (
            <Input
              ref={ref}
              label="Celular peruano"
              placeholder="9XXXXXXXX"
              keyboardType="phone-pad"
              onChangeText={onChange}
              value={value}
              error={errors.celular?.message}
              leftIcon={<Text className="text-texto-hint text-base">+51</Text>}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value, ref } }) => (
            <Input
              ref={ref}
              label="Contraseña"
              placeholder="••••••••"
              secureTextEntry
              onChangeText={onChange}
              value={value}
              error={errors.password?.message}
              leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />}
            />
          )}
        />

        <Button
          title="Crear cuenta"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          className="mt-2"
        />

        <View className="flex-row justify-center mt-6">
          <Text className="text-texto-secundario">¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-primary font-semibold">Ingresar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
