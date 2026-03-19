import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { router } from 'expo-router';

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(auth)/onboarding');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 bg-primary items-center justify-center">
      <View className="items-center">
        {/* Logo placeholder — replace with actual image asset */}
        <View className="w-24 h-24 bg-white rounded-3xl items-center justify-center mb-6">
          <Text className="text-primary text-4xl font-bold">J</Text>
        </View>
        <Text className="text-white text-4xl font-bold tracking-tight">Junto</Text>
        <Text className="text-white/70 text-base mt-2">Divide gastos, cobra sin incomodidad</Text>
      </View>
    </View>
  );
}
