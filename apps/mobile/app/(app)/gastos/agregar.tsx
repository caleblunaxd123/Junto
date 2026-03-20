import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, StatusBar, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGrupo, useCrearGasto } from '../../../src/hooks/useGrupos';
import { useAuthStore } from '../../../src/store/auth.store';
import { GradientButton } from '../../../src/components/ui/GradientButton';
import { Input } from '../../../src/components/ui/Input';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { solesACentavos, centavosASoles } from '../../../src/types';

const CATEGORIAS = [
  { value:'comida', label:'Comida', icon:'🍽️' },
  { value:'transporte', label:'Transporte', icon:'🚗' },
  { value:'entretenimiento', label:'Entrete.', icon:'🎬' },
  { value:'alojamiento', label:'Alojamiento', icon:'🏠' },
  { value:'compras', label:'Compras', icon:'🛒' },
  { value:'otro', label:'Otro', icon:'💸' },
];

export default function AgregarGastoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { usuario } = useAuthStore();
  const { data: grupo, isLoading: loadingGrupo } = useGrupo(grupoId);
  const { mutateAsync: crearGasto } = useCrearGasto(grupoId);

  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('otro');
  const [pagadoPor, setPagadoPor] = useState(usuario?.id || '');
  const [participantes, setParticipantes] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize participants once grupo data is available
  React.useEffect(() => {
    if (grupo?.miembros && participantes.size === 0) {
      setParticipantes(new Set(grupo.miembros.map((m) => m.usuarioId)));
    }
  }, [grupo]);

  const miembros = grupo?.miembros || [];
  const montoNum = parseFloat(monto.replace(',', '.')) || 0;
  const participantesArray = Array.from(participantes);
  const montoPorPersona = participantesArray.length > 0 && montoNum > 0
    ? solesACentavos(montoNum) / participantesArray.length
    : 0;

  const toggleParticipante = (id: string) => {
    setParticipantes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!descripcion.trim()) return Alert.alert('Error', 'Ingresa una descripción para el gasto.');
    if (montoNum <= 0) return Alert.alert('Error', 'Ingresa un monto válido.');
    setIsSubmitting(true);
    try {
      await crearGasto({
        descripcion: descripcion.trim(),
        montoTotal: solesACentavos(montoNum),
        pagadoPor,
        categoria,
        tipoDivision: 'igual',
        participantes: participantesArray.map((id) => ({ usuarioId: id })),
      });
      router.back();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo registrar el gasto');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingGrupo) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6366F1" size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <LinearGradient
        colors={['#6366F1', '#4F46E5']}
        className="h-80 w-full absolute top-0"
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
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black">Nuevo Gasto</Text>
          <View className="w-10" />
        </View>

        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main Input Card */}
          <GlassCard className="mx-6 p-8 items-center border border-white/30 mb-8" intensity={1.2}>
            <Text className="text-white/70 text-xs font-bold uppercase tracking-widest mb-4">Monto del gasto (S/)</Text>
            <TextInput
              className="text-white text-6xl font-black text-center min-h-[80px] w-full"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="decimal-pad"
              value={monto}
              onChangeText={setMonto}
              selectionColor="white"
            />
            {participantesArray.length > 1 && montoNum > 0 && (
              <View className="bg-white/20 px-4 py-2 rounded-full mt-4 border border-white/10">
                <Text className="text-white text-xs font-bold">
                  S/ {centavosASoles(Math.round(montoPorPersona))} por persona
                </Text>
              </View>
            )}
          </GlassCard>

          <View className="px-6">
            <View className="mb-6">
              <Input
                label="¿En qué gastaron?"
                placeholder="Ej: Pizza el viernes 🍕"
                value={descripcion}
                onChangeText={setDescripcion}
                leftIcon={<Ionicons name="cart-outline" size={20} color="#6366F1" />}
              />
            </View>

            <Text className="text-text font-extrabold text-lg mb-4 tracking-tight">Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
              <View className="flex-row gap-3">
                {CATEGORIAS.map((c) => {
                  const sel = categoria === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      onPress={() => setCategoria(c.value)}
                      className={`px-5 py-4 rounded-3xl items-center border-2 ${
                        sel ? 'bg-primary/5 border-primary' : 'bg-white border-gray-100'
                      }`}
                    >
                      <Text className="text-2xl mb-1">{c.icon}</Text>
                      <Text className={`text-[11px] font-black uppercase tracking-wider ${sel ? 'text-primary' : 'text-text-hint'}`}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Who Paid Section */}
            <Text className="text-text font-extrabold text-lg mb-4 tracking-tight">¿Quién pagó?</Text>
            <View className="bg-white rounded-3xl border border-gray-100 p-2 mb-8 shadow-sm">
              {miembros.map((m, idx) => {
                const sel = pagadoPor === m.usuarioId;
                return (
                  <TouchableOpacity
                    key={m.usuarioId}
                    onPress={() => setPagadoPor(m.usuarioId)}
                    className={`flex-row items-center p-4 rounded-2xl ${sel ? 'bg-primary/5' : ''} ${idx < miembros.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${sel ? 'border-primary' : 'border-gray-200'}`}>
                      {sel && <View className="w-3 h-3 rounded-full bg-primary" />}
                    </View>
                    <View className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center ml-4 mr-3">
                      <Text className="text-text-hint font-bold">{m.usuario.nombre.charAt(0)}</Text>
                    </View>
                    <Text className={`flex-1 font-bold ${sel ? 'text-primary' : 'text-text'}`}>
                      {m.usuario.nombre}{m.usuarioId === usuario?.id ? ' (tú)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Participants Section */}
            <Text className="text-text font-extrabold text-lg mb-4 tracking-tight">¿Quiénes participaron?</Text>
            <View className="bg-white rounded-3xl border border-gray-100 p-2 mb-8 shadow-sm">
              {miembros.map((m, idx) => {
                const sel = participantes.has(m.usuarioId);
                return (
                  <TouchableOpacity
                    key={m.usuarioId}
                    onPress={() => toggleParticipante(m.usuarioId)}
                    className={`flex-row items-center p-4 rounded-2xl ${idx < miembros.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <View className={`w-6 h-6 rounded-lg border-2 items-center justify-center ${sel ? 'bg-primary border-primary' : 'border-gray-200'}`}>
                      {sel && <Ionicons name="checkmark" size={14} color="white" />}
                    </View>
                    <View className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center ml-4 mr-3">
                      <Text className="text-text-hint font-bold">{m.usuario.nombre.charAt(0)}</Text>
                    </View>
                    <Text className={`flex-1 font-bold ${sel ? 'text-text' : 'text-text-hint'}`}>
                      {m.usuario.nombre}{m.usuarioId === usuario?.id ? ' (tú)' : ''}
                    </Text>
                    {sel && montoNum > 0 && (
                      <Text className="text-primary font-black text-sm">S/ {centavosASoles(Math.round(montoPorPersona))}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View className="absolute bottom-10 left-6 right-6">
          <GradientButton
            title="Registrar Gasto"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!descripcion || montoNum <= 0}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
