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
    <View className="flex-1 bg-background">
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      <LinearGradient
        colors={['#6366F1', '#4F46E5']}
        className="h-80 w-full absolute top-0"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingTop: 100, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View className="items-center mb-10">
          <View className="bg-white/20 w-20 h-20 rounded-3xl items-center justify-center border border-white/30 shadow-glass mb-6">
            <Text className="text-white text-4xl font-bold">J</Text>
          </View>
          <Text className="text-white text-3xl font-extrabold tracking-tight mb-1">Bienvenido</Text>
          <Text className="text-white/70 text-base font-medium">Ingresa a tu cuenta de Junto</Text>
        </View>

        {/* Login Card */}
        <GlassCard className="p-6 mb-8" intensity={1.1}>
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
                leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#6366F1" />}
              />
            )}
          />

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            className="self-end mb-8"
          >
            <Text className="text-primary font-bold">¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <GradientButton 
            title="Ingresar" 
            onPress={handleSubmit(onSubmit)} 
            loading={isSubmitting} 
            className="mb-6"
          />

          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-[0.5px] bg-gray-200" />
            <Text className="mx-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">O continúa con</Text>
            <View className="flex-1 h-[0.5px] bg-gray-200" />
          </View>

          <TouchableOpacity 
            activeOpacity={0.8}
            className="w-full h-14 bg-white border border-gray-100 rounded-2xl flex-row items-center justify-center shadow-sm"
            onPress={() => Alert.alert('Google Login', 'Esta funcionalidad estará disponible pronto.')}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text className="ml-3 text-text font-bold text-base">Continuar con Google</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Footer */}
        <View className="flex-row justify-center items-center">
          <Text className="text-text-muted font-medium">¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-primary font-bold text-lg">Regístrate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
