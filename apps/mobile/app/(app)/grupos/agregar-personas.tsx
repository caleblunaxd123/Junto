import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  TextInput,
  Linking,
  ActivityIndicator,
  StatusBar,
  Share,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../../src/lib/api';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { GradientButton } from '../../../src/components/ui/GradientButton';

type ContactoItem = {
  id: string;
  nombre: string;
  celular: string;
  enJunto: boolean;
  seleccionado: boolean;
};

function getIniciales(nombre: string) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

function normalizarCelular(raw: string): string {
  return raw.replace(/[\s\-\(\)\+]/g, '').replace(/^51/, '');
}

export default function AgregarPersonasScreen() {
  const params = useLocalSearchParams<{
    grupoId: string;
    grupoNombre: string;
    fromOnboarding?: string;
  }>();
  const fromOnboarding = params.fromOnboarding === 'true';

  const [contactos, setContactos] = useState<ContactoItem[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [permisoDenegado, setPermisoDenegado] = useState(false);

  useEffect(() => {
    cargarContactos();
  }, []);

  async function cargarContactos() {
    setCargando(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermisoDenegado(true);
        setCargando(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      const celularesRaw: string[] = [];
      const mapa: Record<string, { id: string; nombre: string; celular: string }> = {};

      for (const c of data) {
        if (!c.name || !c.phoneNumbers?.length) continue;
        const celular = normalizarCelular(c.phoneNumbers[0].number || '');
        if (celular.length < 7) continue;
        const key = celular;
        mapa[key] = { id: c.id || key, nombre: c.name, celular };
        celularesRaw.push(celular);
      }

      let celularesEnJunto: string[] = [];
      try {
        const res = await api.post('/auth/verificar-celulares', {
          celulares: celularesRaw.slice(0, 200),
        });
        celularesEnJunto = res.data.celulares_registrados || [];
      } catch {
        // Ignorar error de red
      }

      const lista: ContactoItem[] = Object.values(mapa).map((c) => ({
        ...c,
        enJunto: celularesEnJunto.includes(c.celular),
        seleccionado: false,
      }));

      lista.sort((a, b) => {
        if (a.enJunto !== b.enJunto) return a.enJunto ? -1 : 1;
        return a.nombre.localeCompare(b.nombre);
      });

      setContactos(lista);
    } catch (e) {
      console.error('[Contactos]', e);
    } finally {
      setCargando(false);
    }
  }

  function toggleSeleccion(celular: string) {
    setContactos((prev) =>
      prev.map((c) =>
        c.celular === celular ? { ...c, seleccionado: !c.seleccionado } : c
      )
    );
  }

  const filtrados = busqueda
    ? contactos.filter(
        (c) =>
          c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          c.celular.includes(busqueda)
      )
    : contactos;

  const enJunto = filtrados.filter((c) => c.enJunto);
  const invitar = filtrados.filter((c) => !c.enJunto);

  const sections = [
    ...(enJunto.length > 0 ? [{ title: 'Amigos en Junto', data: enJunto }] : []),
    ...(invitar.length > 0 ? [{ title: 'Invitar amigos', data: invitar }] : []),
  ];

  const seleccionados = contactos.filter((c) => c.seleccionado);

  async function handleAgregar() {
    if (seleccionados.length === 0) return;
    setEnviando(true);
    try {
      const enJuntoSel = seleccionados.filter((c) => c.enJunto);
      const invitarSel = seleccionados.filter((c) => !c.enJunto);

      if (enJuntoSel.length > 0) {
        await api.post(`/grupos/${params.grupoId}/miembros-bulk`, {
          celulares: enJuntoSel.map((c) => c.celular),
        });
      }

      for (const c of invitarSel) {
        const msg = encodeURIComponent(
          `¡Hola ${c.nombre.split(' ')[0]}! Te invito al grupo "${params.grupoNombre}" en Junto para dividir gastos. Descárgala aquí: https://junto.app`
        );
        const numero = `51${c.celular}`;
        await Linking.openURL(`whatsapp://send?phone=${numero}&text=${msg}`).catch(() =>
          Linking.openURL(`https://wa.me/${numero}?text=${msg}`)
        );
      }

      router.replace(`/(app)/grupos/${params.grupoId}`);
    } catch (e) {
      console.error(e);
    } finally {
      setEnviando(false);
    }
  }

  async function handleCompartirLink() {
    const url = `https://junto.app/unirse/${params.grupoId}`;
    await Share.share({
      message: `Únete al grupo "${params.grupoNombre}" en Junto para dividir gastos: ${url}`,
      url,
    });
  }

  function renderContacto({ item }: { item: ContactoItem }) {
    const sel = item.seleccionado;
    return (
      <TouchableOpacity
        onPress={() => toggleSeleccion(item.celular)}
        activeOpacity={0.7}
        className="px-6 py-4 flex-row items-center bg-white border-b border-gray-50"
      >
        <View className={`w-12 h-12 rounded-2xl items-center justify-center ${sel ? 'bg-primary' : 'bg-gray-100'}`}>
          {sel ? (
            <Ionicons name="checkmark" size={24} color="white" />
          ) : (
            <Text className="text-text-muted font-bold text-base">{getIniciales(item.nombre)}</Text>
          )}
        </View>
        <View className="flex-1 ml-4">
          <Text className="text-text font-bold text-[15px]">{item.nombre}</Text>
          <Text className="text-text-muted text-xs mt-0.5">+51 {item.celular}</Text>
        </View>
        {item.enJunto ? (
          <View className="bg-primary/10 px-3 py-1.5 rounded-full">
            <Text className="text-primary text-[10px] font-black uppercase tracking-wider">Junto</Text>
          </View>
        ) : (
          <View className="flex-row items-center bg-success/10 px-3 py-1.5 rounded-full">
            <Ionicons name="logo-whatsapp" size={12} color="#10B981" />
            <Text className="text-success text-[10px] font-black uppercase tracking-wider ml-1">Invitar</Text>
          </View>
        )}
      </TouchableOpacity>
    );
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
        <View className="px-6 pt-4 pb-6">
          <View className="flex-row items-center justify-between mb-8">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center border border-white/30"
            >
              <Ionicons name="arrow-back" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.replace(`/(app)/grupos/${params.grupoId}`)}
              className="px-4 py-2 bg-white/10 rounded-xl"
            >
              <Text className="text-white font-bold text-sm">Omitir</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-white text-3xl font-black mb-1">Invitar amigos</Text>
          <Text className="text-white/70 text-sm font-medium" numberOfLines={1}>{params.grupoNombre}</Text>
        </View>

        {/* Floating Search Bar */}
        <GlassCard className="mx-6 p-4 mb-6 flex-row items-center border border-white/30" intensity={1.2}>
          <Ionicons name="search" size={20} color="white" />
          <TextInput
            className="flex-1 ml-3 text-white font-bold text-base"
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por nombre o número..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            selectionColor="white"
          />
        </GlassCard>

        {/* Quick Invite Link */}
        <TouchableOpacity 
          onPress={handleCompartirLink}
          className="mx-6 mb-6 bg-white rounded-3xl p-5 border border-gray-100 flex-row items-center shadow-premium"
          activeOpacity={0.9}
        >
          <View className="w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center mr-4">
            <Ionicons name="link" size={20} color="#6366F1" />
          </View>
          <View className="flex-1">
            <Text className="text-text font-bold text-[15px]">Link de invitación</Text>
            <Text className="text-text-hint text-xs mt-0.5">Cualquiera con el link se puede unir</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* List Content */}
        {cargando ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator color="#6366F1" size="large" />
            <Text className="text-text-hint font-bold mt-4 tracking-tight">Escaneando contactos...</Text>
          </View>
        ) : permisoDenegado ? (
          <View className="flex-1 items-center justify-center p-12">
            <View className="w-24 h-24 bg-gray-100 rounded-[40px] items-center justify-center mb-6">
              <Ionicons name="people-outline" size={48} color="#9CA3AF" />
            </View>
            <Text className="text-text text-xl font-bold mb-2">Sin acceso a contactos</Text>
            <Text className="text-text-muted text-center leading-6">Sincroniza tus contactos para agregar amigos mucho más rápido.</Text>
            <TouchableOpacity 
              onPress={() => Linking.openSettings()}
              className="mt-8 bg-primary h-14 px-10 rounded-2xl items-center justify-center shadow-premium"
            >
              <Text className="text-white font-bold">Abrir Ajustes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderContacto}
            renderSectionHeader={({ section }) => (
              <View className="bg-gray-50 px-6 py-3 border-y border-gray-100 flex-row justify-between items-center">
                <Text className="text-text-hint font-black text-[11px] uppercase tracking-widest">{section.title}</Text>
                <View className="bg-gray-200 px-2 py-0.5 rounded-md">
                  <Text className="text-text-hint font-bold text-[10px]">{section.data.length}</Text>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 150 }}
            stickySectionHeadersEnabled
          />
        )}

        {/* Selection Bar */}
        {seleccionados.length > 0 && (
          <View className="absolute bottom-10 left-6 right-6">
            <GradientButton
              title={`Agregar ${seleccionados.length} persona${seleccionados.length === 1 ? '' : 's'}`}
              onPress={handleAgregar}
              loading={enviando}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
