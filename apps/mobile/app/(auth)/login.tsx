import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StatusBar } from 'react-native';
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
    <View style={{ flex: 1, backgroundColor: '#534AB7' }}>
      <StatusBar barStyle="light-content" backgroundColor="#534AB7" />

      {/* Top purple section */}
      <View style={{ alignItems: 'center', paddingTop: 72, paddingBottom: 36 }}>
        <View
          style={{
            width: 72,
            height: 72,
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}>J</Text>
        </View>
        <Text style={{ color: 'white', fontSize: 26, fontWeight: 'bold' }}>Bienvenido de vuelta</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4, fontSize: 15 }}>
          Ingresa a tu cuenta Junto
        </Text>
      </View>

      {/* White card section */}
      <ScrollView
        style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
              leftIcon={<Ionicons name="mail-outline" size={20} color="#534AB7" />}
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
              leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#534AB7" />}
            />
          )}
        />

        <TouchableOpacity
          onPress={() => router.push('/(auth)/forgot-password')}
          style={{ alignSelf: 'flex-end', marginBottom: 24 }}
        >
          <Text style={{ color: '#534AB7', fontWeight: '600' }}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <Button title="Ingresar" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ color: '#6B7280' }}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={{ color: '#534AB7', fontWeight: '700' }}>Regístrate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
