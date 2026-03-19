import React, { useRef, useState } from 'react';
import { View, Text, FlatList, Dimensions, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: 'people-outline' as const,
    title: 'Divide gastos fácilmente',
    description:
      'Registra gastos compartidos con amigos, roomies o compañeros de trabajo. Junto calcula automáticamente quién debe cuánto.',
    bg: '#EEEDFE',
    iconColor: '#534AB7',
  },
  {
    id: '2',
    icon: 'notifications-outline' as const,
    title: 'Cobra sin incomodidad',
    description:
      'La app envía recordatorios automáticos por ti. Ya no tienes que tener esa conversación incómoda — Junto lo hace.',
    bg: '#E8F8F3',
    iconColor: '#1D9E75',
  },
  {
    id: '3',
    icon: 'phone-portrait-outline' as const,
    title: 'Liquida por Yape',
    description:
      'Paga tus deudas directamente con Yape o Plin sin salir de la app. Rápido, seguro y sin complicaciones.',
    bg: '#FFF4E6',
    iconColor: '#BA7517',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <View className="flex-1 bg-white">
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 items-center justify-center px-8">
            <View
              className="w-32 h-32 rounded-3xl items-center justify-center mb-10"
              style={{ backgroundColor: item.bg }}
            >
              <Ionicons name={item.icon} size={64} color={item.iconColor} />
            </View>
            <Text className="text-3xl font-bold text-texto text-center mb-4">{item.title}</Text>
            <Text className="text-texto-secundario text-lg text-center leading-7">
              {item.description}
            </Text>
          </View>
        )}
      />

      {/* Dots */}
      <View className="flex-row justify-center mb-6">
        {slides.map((_, i) => (
          <View
            key={i}
            className={`h-2 mx-1 rounded-full ${i === currentIndex ? 'w-6 bg-primary' : 'w-2 bg-gray-300'}`}
          />
        ))}
      </View>

      <View className="px-6 pb-12 gap-3">
        <Button
          title={currentIndex === slides.length - 1 ? 'Empezar' : 'Siguiente'}
          onPress={handleNext}
        />
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} className="py-2">
          <Text className="text-texto-secundario text-center">Ya tengo cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
