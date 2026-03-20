import React, { useEffect } from 'react';
import { View, Text, StatusBar } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(async () => {
      const done = await AsyncStorage.getItem('onboarding_completado');
      if (done === 'true') {
        router.replace('/(auth)/login');
      } else {
        router.replace('/(auth)/onboarding');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        className="flex-1 items-center justify-center"
      >
        <View className="bg-white/20 w-32 h-32 rounded-[40px] items-center justify-center border border-white/30 shadow-glass">
          <Text className="text-white text-6xl font-bold">J</Text>
        </View>
        
        <View className="items-center mt-8">
          <Text className="text-white text-5xl font-extrabold tracking-tighter" style={{ letterSpacing: -2 }}>
            Junto
          </Text>
          <Text className="text-white/60 text-lg mt-2 font-medium">Divide. Cobra. Simple.</Text>
        </View>

        <View className="absolute bottom-16 flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-white/40" />
          <View className="w-6 h-2 rounded-full bg-white" />
          <View className="w-2 h-2 rounded-full bg-white/40" />
        </View>
      </LinearGradient>
    </View>
  );
}
