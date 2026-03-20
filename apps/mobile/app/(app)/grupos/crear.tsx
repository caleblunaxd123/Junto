import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useCrearGrupo } from '../../../src/hooks/useGrupos';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { GradientButton } from '../../../src/components/ui/GradientButton';
import { Input } from '../../../src/components/ui/Input';

const TIPOS = [
  { tipo: 'viaje', emoji: '✈️', label: 'Viaje', bg: '#EEEDFE', color: '#6366F1' },
  { tipo: 'roomies', emoji: '🏠', label: 'Roomies', bg: '#E1F5EE', color: '#10B981' },
  { tipo: 'amigos', emoji: '👥', label: 'Amigos', bg: '#FAEEDA', color: '#F59E0B' },
  { tipo: 'trabajo', emoji: '💼', label: 'Trabajo', bg: '#E6F1FB', color: '#3B82F6' },
  { tipo: 'otro', emoji: '📦', label: 'Otro', bg: '#F3F4F6', color: '#6B7280' },
];

function formatDate(d: Date) {
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

export default function CrearGrupoScreen() {
  const params = useLocalSearchParams<{ tipo?: string; fromOnboarding?: string }>();
  const fromOnboarding = params.fromOnboarding === 'true';

  const initialTipo = TIPOS.find((t) => t.tipo === params.tipo) || TIPOS[2];
  const [tipoSeleccionado, setTipoSeleccionado] = useState(initialTipo.tipo);
  const [nombre, setNombre] = useState('');
  const [conFechas, setConFechas] = useState(params.tipo === 'viaje');
  const [fechaInicio, setFechaInicio] = useState(new Date());
  const [fechaFin, setFechaFin] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [showPickerInicio, setShowPickerInicio] = useState(false);
  const [showPickerFin, setShowPickerFin] = useState(false);

  const { mutateAsync: crearGrupo, isPending } = useCrearGrupo();
  const tipoObj = TIPOS.find((t) => t.tipo === tipoSeleccionado) || TIPOS[2];
  const canSubmit = nombre.trim().length >= 2;

  async function handleCrear() {
    if (!canSubmit || isPending) return;
    try {
      const payload: any = {
        nombre: nombre.trim(),
        tipo: tipoSeleccionado,
      };
      if (conFechas) {
        payload.fecha_inicio = fechaInicio.toISOString().split('T')[0];
        payload.fecha_fin = fechaFin.toISOString().split('T')[0];
      }
      const grupo = await crearGrupo(payload);
      if (fromOnboarding) {
        router.replace(
          `/(app)/grupos/agregar-personas?grupoId=${grupo.id}&grupoNombre=${encodeURIComponent(grupo.nombre)}&fromOnboarding=true`
        );
      } else {
        router.replace(`/(app)/grupos/${grupo.id}`);
      }
    } catch {
      Alert.alert('Error', 'No se pudo crear el grupo. Intenta de nuevo.');
    }
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <LinearGradient
        colors={['#6366F1', '#4F46E5']}
        className="h-64 w-full absolute top-0"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center border border-white/30"
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black">Nuevo Grupo</Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card Preview */}
          <GlassCard className="p-6 mb-8 flex-row items-center border border-white/30" intensity={1.2}>
            <View 
              style={{ backgroundColor: tipoObj.bg }} 
              className="w-20 h-20 rounded-[28px] items-center justify-center mr-6 shadow-sm"
            >
              <Text className="text-4xl">{tipoObj.emoji}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Vista Previa</Text>
              <Text className="text-white text-2xl font-black" numberOfLines={1}>
                {nombre.trim() || 'Nombre del Grupo'}
              </Text>
              {conFechas && (
                <Text className="text-white/80 text-sm font-medium mt-1">
                  {formatDate(fechaInicio)} — {formatDate(fechaFin)}
                </Text>
              )}
            </View>
          </GlassCard>

          <View className="mb-6">
            <Input
              label="Nombre del Grupo"
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Viaje a Cusco 🏔️"
              autoFocus
              leftIcon={<Ionicons name="pencil-outline" size={20} color="#6366F1" />}
            />
          </View>

          <View className="mb-6">
            <Text className="text-text font-extrabold text-lg mb-4 tracking-tight">Tipo de Grupo</Text>
            <View className="flex-row flex-wrap gap-2">
              {TIPOS.map((t) => {
                const selected = tipoSeleccionado === t.tipo;
                return (
                  <TouchableOpacity
                    key={t.tipo}
                    onPress={() => setTipoSeleccionado(t.tipo)}
                    className={`px-5 py-3 rounded-2xl border-2 flex-row items-center gap-2 ${
                      selected ? 'bg-primary/5 border-primary' : 'bg-white border-gray-100'
                    }`}
                  >
                    <Text className="text-xl">{t.emoji}</Text>
                    <Text className={`font-bold ${selected ? 'text-primary' : 'text-text-hint'}`}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Fechas */}
          <View className="bg-white rounded-3xl p-5 border border-gray-100 mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-text font-bold text-base">Definir fechas</Text>
                <Text className="text-text-muted text-xs">Opcional para organizar mejor</Text>
              </View>
              <Switch
                value={conFechas}
                onValueChange={setConFechas}
                trackColor={{ false: '#E5E7EB', true: '#C4C0F6' }}
                thumbColor={conFechas ? '#6366F1' : '#fff'}
              />
            </View>

            {conFechas && (
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  className="flex-1 bg-gray-50 p-4 rounded-2xl flex-row items-center border border-gray-100"
                  onPress={() => {
                    setShowPickerFin(false);
                    setShowPickerInicio(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#6366F1" />
                  <Text className="ml-2 text-text font-bold">{formatDate(fechaInicio)}</Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                <TouchableOpacity
                  className="flex-1 bg-gray-50 p-4 rounded-2xl flex-row items-center border border-gray-100"
                  onPress={() => {
                    setShowPickerInicio(false);
                    setShowPickerFin(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#6366F1" />
                  <Text className="ml-2 text-text font-bold">{formatDate(fechaFin)}</Text>
                </TouchableOpacity>
              </View>
            )}

            {showPickerInicio && (
              <DateTimePicker
                value={fechaInicio}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  setShowPickerInicio(Platform.OS === 'ios');
                  if (date) setFechaInicio(date);
                }}
                minimumDate={new Date()}
              />
            )}
            {showPickerFin && (
              <DateTimePicker
                value={fechaFin}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  setShowPickerFin(Platform.OS === 'ios');
                  if (date) setFechaFin(date);
                }}
                minimumDate={fechaInicio}
              />
            )}
          </View>

          <GradientButton
            title={fromOnboarding ? "Siguiente" : "Crear Grupo"}
            onPress={handleCrear}
            loading={isPending}
            disabled={!canSubmit}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
