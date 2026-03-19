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
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const { login } = useAuthStore();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      router.replace('/(app)');
    } catch {
      Alert.alert('Error', 'Email o contraseña incorrectos');
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
        <View className="mb-10">
          <View className="w-14 h-14 bg-primary rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-2xl font-bold">J</Text>
          </View>
          <Text className="text-3xl font-bold text-texto">Bienvenido de vuelta</Text>
          <Text className="text-texto-secundario mt-1">Ingresa a tu cuenta Junto</Text>
        </View>

        {/* Form */}
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

        <TouchableOpacity
          onPress={() => router.push('/(auth)/forgot-password')}
          className="mb-6"
        >
          <Text className="text-primary text-right font-medium">¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <Button
          title="Ingresar"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />

        <View className="flex-row justify-center mt-6">
          <Text className="text-texto-secundario">¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-primary font-semibold">Regístrate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
