import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../../src/store/auth.store';
import { Input } from '../../../src/components/ui/Input';
import { GradientButton } from '../../../src/components/ui/GradientButton';
import { GlassCard } from '../../../src/components/ui/GlassCard';

export default function EditarPerfilScreen() {
  const { usuario, updateUsuario } = useAuthStore();
  
  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [celular, setCelular] = useState(usuario?.celular || '');
  const [foto, setFoto] = useState<string | null>(usuario?.fotoUrl || null);
  const [isUpdating, setIsUpdating] = useState(false);

  const seleccionarImagen = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para cambiar la foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setFoto(result.assets[0].uri);
    }
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setFoto(result.assets[0].uri);
    }
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) return Alert.alert('Error', 'El nombre es obligatorio.');
    
    setIsUpdating(true);
    try {
      // Simulate API call to update profile
      // In a real app, you would send FormData for the image
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      updateUsuario({
        nombre: nombre.trim(),
        email: email.trim(),
        celular: celular.trim(),
        fotoUrl: foto,
      });

      Alert.alert('Éxito', 'Perfil actualizado correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el perfil.');
    } finally {
      setIsUpdating(false);
    }
  };

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
        <View className="px-6 py-4 flex-row items-center justify-between">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center border border-white/30"
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black tracking-tight">Editar Perfil</Text>
          <View className="w-10" />
        </View>

        <ScrollView 
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Edit */}
          <View className="items-center mb-10">
            <View className="relative">
              <View className="w-32 h-32 bg-white/20 rounded-[40px] items-center justify-center border-4 border-white/40 shadow-2xl overflow-hidden">
                {foto ? (
                  <Image source={{ uri: foto }} className="w-full h-full" />
                ) : (
                  <Text className="text-white text-5xl font-black">{nombre.charAt(0).toUpperCase() || '?'}</Text>
                )}
              </View>
              <View className="flex-row absolute -bottom-2 justify-center w-full gap-2">
                <TouchableOpacity 
                  onPress={tomarFoto}
                  className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-premium border border-gray-100"
                >
                  <Ionicons name="camera" size={18} color="#6366F1" />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={seleccionarImagen}
                  className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-premium border border-gray-100"
                >
                  <Ionicons name="images" size={18} color="#6366F1" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <GlassCard className="p-6 mb-8 border border-white/20" intensity={1.1}>
            <View className="space-y-6">
              <Input
                label="Nombre completo"
                value={nombre}
                onChangeText={setNombre}
                placeholder="Tu nombre"
                leftIcon={<Ionicons name="person-outline" size={20} color="#6366F1" />}
              />

              <Input
                label="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon={<Ionicons name="mail-outline" size={20} color="#6366F1" />}
              />

              <Input
                label="Número de celular"
                value={celular}
                onChangeText={setCelular}
                placeholder="9XXXXXXXX"
                keyboardType="phone-pad"
                maxLength={9}
                leftIcon={<Ionicons name="call-outline" size={20} color="#6366F1" />}
              />
            </View>
          </GlassCard>

          <GradientButton 
            title="Guardar Cambios" 
            onPress={handleGuardar}
            loading={isUpdating}
            className="shadow-premium"
          />

          <TouchableOpacity 
            onPress={() => router.back()}
            className="mt-6 items-center py-2"
          >
            <Text className="text-text-hint font-bold">Cancelar</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
