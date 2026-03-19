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
      router.replace('/(app)');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', error?.response?.data?.error || 'Error al crear la cuenta');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#534AB7' }}>
      <StatusBar barStyle="light-content" backgroundColor="#534AB7" />

      {/* Top purple section */}
      <View style={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 28 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: 26, fontWeight: 'bold' }}>Crear cuenta</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 4, fontSize: 15 }}>
          Únete y olvídate del drama
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
              leftIcon={<Ionicons name="person-outline" size={20} color="#534AB7" />}
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
              leftIcon={<Ionicons name="mail-outline" size={20} color="#534AB7" />}
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
              leftIcon={
                <Text style={{ color: '#534AB7', fontWeight: '700', fontSize: 15 }}>+51</Text>
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
              leftIcon={<Ionicons name="lock-closed-outline" size={20} color="#534AB7" />}
            />
          )}
        />

        <Button
          title="Crear cuenta"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          className="mt-2"
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ color: '#6B7280' }}>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={{ color: '#534AB7', fontWeight: '700' }}>Ingresar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
