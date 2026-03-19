import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGrupo, useCrearGasto } from '../../../src/hooks/useGrupos';
import { useAuthStore } from '../../../src/store/auth.store';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { solesACentavos } from '../../../src/types';

type TipoDivision = 'igual' | 'exacto' | 'porcentaje';

const CATEGORIAS = [
  { value: 'comida', label: 'Comida', icon: '🍽️' },
  { value: 'transporte', label: 'Transporte', icon: '🚗' },
  { value: 'entretenimiento', label: 'Entretenimiento', icon: '🎬' },
  { value: 'alojamiento', label: 'Alojamiento', icon: '🏠' },
  { value: 'compras', label: 'Compras', icon: '🛒' },
  { value: 'otro', label: 'Otro', icon: '💸' },
];

export default function AgregarGastoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const { usuario } = useAuthStore();
  const { data: grupo } = useGrupo(grupoId);
  const { mutateAsync: crearGasto } = useCrearGasto(grupoId);

  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('otro');
  const [pagadoPor, setPagadoPor] = useState(usuario?.id || '');
  const [tipoDivision, setTipoDivision] = useState<TipoDivision>('igual');
  const [participantes, setParticipantes] = useState<Set<string>>(
    new Set(grupo?.miembros.map((m) => m.usuarioId) || [])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const miembros = grupo?.miembros || [];
  const montoNum = parseFloat(monto.replace(',', '.')) || 0;
  const montoEnCentavos = solesACentavos(montoNum);
  const participantesArray = Array.from(participantes);

  const toggleParticipante = (id: string) => {
    setParticipantes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // at least one participant
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!descripcion.trim()) {
      Alert.alert('Error', 'Ingresa una descripción');
      return;
    }
    if (montoNum <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }
    if (participantesArray.length === 0) {
      Alert.alert('Error', 'Selecciona al menos un participante');
      return;
    }

    setIsSubmitting(true);
    try {
      await crearGasto({
        descripcion: descripcion.trim(),
        montoTotal: montoEnCentavos,
        pagadoPor,
        categoria,
        tipoDivision,
        participantes: participantesArray.map((id) => ({ usuarioId: id })),
      });
      router.back();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', error?.response?.data?.error || 'No se pudo registrar el gasto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const montoPorPersona =
    participantesArray.length > 0 && montoEnCentavos > 0
      ? montoEnCentavos / participantesArray.length
      : 0;

  return (
    <SafeAreaView className="flex-1 bg-fondo">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-4 pb-8">
          {/* Header */}
          <View className="flex-row items-center mb-8">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-texto">Agregar gasto</Text>
          </View>

          {/* Monto */}
          <View className="bg-white rounded-card p-6 mb-4 items-center">
            <Text className="text-texto-hint text-sm mb-2">Monto total (S/)</Text>
            <TextInput
              className="text-5xl font-bold text-texto text-center w-full"
              placeholder="0.00"
              placeholderTextColor="#D1D5DB"
              keyboardType="decimal-pad"
              value={monto}
              onChangeText={setMonto}
            />
            {participantesArray.length > 1 && montoNum > 0 && (
              <Text className="text-texto-hint text-sm mt-2">
                ≈ S/{(montoPorPersona / 100).toFixed(2)} por persona
              </Text>
            )}
          </View>

          <Input
            label="¿En qué gastaron?"
            placeholder="Cena, taxi, supermercado..."
            onChangeText={setDescripcion}
            value={descripcion}
            autoCapitalize="sentences"
          />

          {/* Categoría */}
          <Text className="text-texto-secundario text-sm font-medium mb-3">Categoría</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2 pr-4">
              {CATEGORIAS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setCategoria(c.value)}
                  className={`items-center px-4 py-3 rounded-card border ${
                    categoria === c.value ? 'bg-primary-50 border-primary' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className="text-2xl mb-1">{c.icon}</Text>
                  <Text
                    className={`text-xs font-medium ${
                      categoria === c.value ? 'text-primary' : 'text-texto-secundario'
                    }`}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* ¿Quién pagó? */}
          <Text className="text-texto-secundario text-sm font-medium mb-3">¿Quién pagó?</Text>
          <View className="bg-white rounded-card border border-gray-200 mb-4 overflow-hidden">
            {miembros.map((m) => (
              <TouchableOpacity
                key={m.usuarioId}
                onPress={() => setPagadoPor(m.usuarioId)}
                className={`flex-row items-center px-4 py-3 border-b border-gray-100 last:border-b-0 ${
                  pagadoPor === m.usuarioId ? 'bg-primary-50' : ''
                }`}
              >
                <View
                  className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
                    pagadoPor === m.usuarioId ? 'border-primary' : 'border-gray-300'
                  }`}
                >
                  {pagadoPor === m.usuarioId && (
                    <View className="w-3 h-3 rounded-full bg-primary" />
                  )}
                </View>
                <Text className="text-texto font-medium">
                  {m.usuario.nombre} {m.usuarioId === usuario?.id ? '(yo)' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Participantes */}
          <Text className="text-texto-secundario text-sm font-medium mb-3">
            ¿Entre quiénes se divide?
          </Text>
          <View className="bg-white rounded-card border border-gray-200 mb-6 overflow-hidden">
            {miembros.map((m) => (
              <TouchableOpacity
                key={m.usuarioId}
                onPress={() => toggleParticipante(m.usuarioId)}
                className="flex-row items-center px-4 py-3 border-b border-gray-100 last:border-b-0"
              >
                <View
                  className={`w-6 h-6 rounded-md border-2 mr-3 items-center justify-center ${
                    participantes.has(m.usuarioId) ? 'bg-primary border-primary' : 'border-gray-300'
                  }`}
                >
                  {participantes.has(m.usuarioId) && (
                    <Ionicons name="checkmark" size={14} color="white" />
                  )}
                </View>
                <Text className="text-texto font-medium flex-1">
                  {m.usuario.nombre} {m.usuarioId === usuario?.id ? '(yo)' : ''}
                </Text>
                {participantes.has(m.usuarioId) && montoNum > 0 && (
                  <Text className="text-texto-hint text-sm">
                    S/{(montoPorPersona / 100).toFixed(2)}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Registrar gasto"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!descripcion || montoNum <= 0}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
