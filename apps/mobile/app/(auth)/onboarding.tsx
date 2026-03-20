import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../../src/components/ui/GradientButton';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    emoji: '💸',
    titulo: 'Divide sin drama',
    subtitulo: 'Registra gastos y Junto calcula automáticamente quién debe cuánto. Sin errores, sin estrés.',
    colors: ['#6366F1', '#4F46E5'] as const,
  },
  {
    id: 2,
    emoji: '🔔',
    titulo: 'Cobra sin roches',
    subtitulo: 'La app hace el trabajo social incómodo por ti con recordatorios automáticos y elegantes.',
    colors: ['#8B5CF6', '#6366F1'] as const,
  },
  {
    id: 3,
    emoji: '⚡',
    titulo: 'Paga con Yape',
    subtitulo: 'Salda tus deudas directo con Yape sin salir de la app. Rápido, seguro y oficial.',
    colors: ['#10B981', '#059669'] as const,
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const slide = SLIDES[currentIndex];

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setCurrentIndex(next);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_completado', 'true');
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={slide.colors}
        className="flex-1"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            className="flex-1"
            contentContainerStyle={{ width: width * SLIDES.length }}
          >
            {SLIDES.map((sl) => (
              <View key={sl.id} style={{ width }} className="items-center justify-center px-10">
                <View className="bg-white/10 w-48 h-48 rounded-[60px] items-center justify-center border border-white/20 mb-12 shadow-glass">
                   <Text className="text-8xl">{sl.emoji}</Text>
                </View>
                <Text className="text-white text-4xl font-extrabold text-center mb-4 tracking-tighter" style={{ letterSpacing: -1 }}>
                  {sl.titulo}
                </Text>
                <Text className="text-white/70 text-lg text-center leading-7 font-medium">
                  {sl.subtitulo}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View className="px-8 pb-10 items-center">
            {/* Dots */}
            <View className="flex-row gap-2 mb-10">
              {SLIDES.map((_, i) => (
                <View 
                  key={i} 
                  className={`h-2 rounded-full ${
                    i === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'
                  }`} 
                />
              ))}
            </View>

            <GradientButton 
              title={currentIndex < SLIDES.length - 1 ? 'Siguiente' : 'Comenzar ahora'}
              onPress={goNext}
              className="w-full"
              colors={['#FFFFFF', '#F3F4F6']}
              style={{ paddingVertical: 0 }}
            >
               {/* Customizing text color for the light button */}
               <Text style={{ color: slide.colors[0], fontWeight: '800', fontSize: 18 }}>
                  {currentIndex < SLIDES.length - 1 ? 'Siguiente' : 'Comenzar ahora'}
               </Text>
            </GradientButton>

            {currentIndex < SLIDES.length - 1 && (
              <TouchableOpacity onPress={finishOnboarding} className="mt-6 py-2">
                <Text className="text-white/60 font-semibold">Saltar introducción</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
