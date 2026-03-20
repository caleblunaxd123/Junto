import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface SocialPressureWidgetProps {
  level: 'low' | 'medium' | 'high' | 'critical';
  totalDebt: string;
}

export function SocialPressureWidget({ level, totalDebt }: SocialPressureWidgetProps) {
  const config = {
    low: {
      label: 'Tranqui',
      color: '#10B981',
      icon: 'leaf-outline',
      description: 'Todo bajo control.',
    },
    medium: {
      label: 'Pendiente',
      color: '#F59E0B',
      icon: 'time-outline',
      description: 'Ya va siendo hora...',
    },
    high: {
      label: 'Picante',
      color: '#EF4444',
      icon: 'flame-outline',
      description: 'La presión social aumenta.',
    },
    critical: {
      label: 'URGENTE',
      color: '#7F1D1D',
      icon: 'alert-circle',
      description: 'Escalada máxima activada.',
    },
  }[level];

  return (
    <View className="rounded-3xl overflow-hidden border border-white/20 shadow-glass">
      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']}
        className="p-4"
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2">
            <View style={{ backgroundColor: config.color }} className="w-8 h-8 rounded-full items-center justify-center">
              <Ionicons name={config.icon as any} size={18} color="white" />
            </View>
            <Text className="font-bold text-lg" style={{ color: config.color }}>
              Nivel: {config.label}
            </Text>
          </View>
          <Text className="text-text-muted font-semibold">S/ {totalDebt}</Text>
        </View>
        <Text className="text-text-muted text-sm font-medium">
          {config.description}
        </Text>
        
        {/* Progress bar */}
        <View className="h-1.5 w-full bg-gray-200 rounded-full mt-3 overflow-hidden">
          <View 
            className="h-full rounded-full" 
            style={{ 
              backgroundColor: config.color,
              width: level === 'low' ? '25%' : level === 'medium' ? '50%' : level === 'high' ? '75%' : '100%' 
            }} 
          />
        </View>
      </LinearGradient>
    </View>
  );
}
