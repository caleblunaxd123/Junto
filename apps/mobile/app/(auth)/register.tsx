import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/auth.store';
import { GradientButton } from '../../src/components/ui/GradientButton';
import { Input } from '../../src/components/ui/Input';
import { GlassCard } from '../../src/components/ui/GlassCard';

const schema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  celular: z.string().regex(/^9\d{8}$/, 'Formato: 9XXXXXXXX (9 dígitos, empieza en 9)'),
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
      router.replace('/(app)/first-action');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', error?.response?.data?.error || 'Error al crear la cuenta');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        className="h-64 w-full absolute top-0"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-white/20 w-12 h-12 rounded-2xl items-center justify-center border border-white/30 shadow-glass mb-8"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <View className="mb-8">
          <Text className="text-white text-3xl font-extrabold tracking-tight mb-2">Crea tu cuenta</Text>
          <Text className="text-white/70 text-lg font-medium">Únete a la nueva forma de dividir gastos</Text>
        </View>

        <GlassCard className="p-6 mb-8" intensity={1.1}>
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
                leftIcon={<Ionicons name="person-outline" size={20} color="#6366F1" />}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value, ref } }) => (
              <Input
                ref={ref}
                label="Correo Electrónico"
                placeholder="nombre@ejemplo.com"
                keyboardType="email-address"
                onChangeText={onChange}
                value={value}
                error={errors.email?.message}
                leftIcon={<Ionicons name="mail-outline" size={20} color="#6366F1" />}
              />
            )}
          />

          <Controller
            control={control}
            name="celular"
            render={({ field: { onChange, value, ref } }) => (
              <Input
                ref={ref}
                label="Celular"
                placeholder="9XXXXXXXX"
                keyboardType="phone-pad"
                onChangeText={onChange}
                value={value}
                error={errors.celular?.message}
                leftIcon={
                  <View className="flex-row items-center">
                    <Text className="text-primary font-bold mr-1">+51</Text>
                  </View>
                }
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
                placeholder="Mínimo 8 caracteres + número"
                secureTextEntry
                onChangeText={onChange}
                value={value}
                error={errors.password?.message}
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#6366F1" />}
              />
            )}
          />

          <GradientButton 
            title="Registrarme" 
            onPress={handleSubmit(onSubmit)} 
            loading={isSubmitting}
            className="mt-4 mb-6"
          />

          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-[0.5px] bg-gray-200" />
            <Text className="mx-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">O regístrate con</Text>
            <View className="flex-1 h-[0.5px] bg-gray-200" />
          </View>

          <TouchableOpacity 
            activeOpacity={0.8}
            className="w-full h-14 bg-white border border-gray-100 rounded-2xl flex-row items-center justify-center shadow-sm"
            onPress={() => Alert.alert('Google Login', 'Esta funcionalidad estará disponible pronto.')}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text className="ml-3 text-text font-bold text-base">Google</Text>
          </TouchableOpacity>
        </GlassCard>

        <View className="flex-row justify-center items-center">
          <Text className="text-text-muted font-medium">¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-primary font-bold text-lg">Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
