import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCrearGrupo } from '../../../src/hooks/useGrupos';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';

const TIPOS = [
  { value: 'amigos', label: 'Amigos', icon: 'happy-outline' as const },
  { value: 'viaje', label: 'Viaje', icon: 'airplane-outline' as const },
  { value: 'roomies', label: 'Roomies', icon: 'home-outline' as const },
  { value: 'trabajo', label: 'Trabajo', icon: 'briefcase-outline' as const },
  { value: 'otro', label: 'Otro', icon: 'ellipsis-horizontal-outline' as const },
];

const schema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  descripcion: z.string().optional(),
  tipo: z.enum(['viaje', 'roomies', 'amigos', 'trabajo', 'otro']),
});

type FormData = z.infer<typeof schema>;

export default function CrearGrupoScreen() {
  const { mutateAsync: crearGrupo } = useCrearGrupo();
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'amigos' },
  });

  const tipoSeleccionado = watch('tipo');

  const onSubmit = async (data: FormData) => {
    try {
      const grupo = await crearGrupo(data);
      router.replace(`/(app)/grupos/${grupo.id}`);
    } catch {
      Alert.alert('Error', 'No se pudo crear el grupo');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-fondo">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-4 pb-8">
          {/* Header */}
          <View className="flex-row items-center mb-8">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-texto">Nuevo grupo</Text>
          </View>

          <Controller
            control={control}
            name="nombre"
            render={({ field: { onChange, value, ref } }) => (
              <Input
                ref={ref}
                label="Nombre del grupo"
                placeholder="Viaje a Cusco, Roomies Miraflores..."
                onChangeText={onChange}
                value={value}
                error={errors.nombre?.message}
                autoCapitalize="words"
              />
            )}
          />

          <Controller
            control={control}
            name="descripcion"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Descripción (opcional)"
                placeholder="Describe el grupo..."
                onChangeText={onChange}
                value={value}
                multiline
                numberOfLines={3}
              />
            )}
          />

          <Text className="text-texto-secundario text-sm font-medium mb-3">Tipo de grupo</Text>
          <View className="flex-row flex-wrap gap-2 mb-8">
            {TIPOS.map((tipo) => (
              <TouchableOpacity
                key={tipo.value}
                onPress={() => setValue('tipo', tipo.value as FormData['tipo'])}
                className={`flex-row items-center gap-2 px-4 py-3 rounded-card border ${
                  tipoSeleccionado === tipo.value
                    ? 'bg-primary-50 border-primary'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Ionicons
                  name={tipo.icon}
                  size={18}
                  color={tipoSeleccionado === tipo.value ? '#534AB7' : '#6B7280'}
                />
                <Text
                  className={`font-medium ${
                    tipoSeleccionado === tipo.value ? 'text-primary' : 'text-texto-secundario'
                  }`}
                >
                  {tipo.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Crear grupo"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
