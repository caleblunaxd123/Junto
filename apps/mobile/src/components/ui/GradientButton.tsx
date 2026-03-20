import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  ColorValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientButtonProps {
  title?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  loading?: boolean;
  colors?: readonly [ColorValue, ColorValue, ...ColorValue[]];
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

export function GradientButton({
  title,
  children,
  onPress,
  loading,
  colors = ['#6366F1', '#8B5CF6'],
  size = 'lg',
  disabled,
  className = '',
  style,
}: GradientButtonProps & { style?: any }) {
  const isDisabled = disabled || loading;

  const height = size === 'sm' ? 40 : size === 'md' ? 48 : 56;
  const fontSize = size === 'sm' ? 14 : size === 'md' ? 16 : 18;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      className={`rounded-btn overflow-hidden ${isDisabled ? 'opacity-60' : ''} ${className}`}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : children ? (
          children
        ) : (
          <Text
            className="text-white font-bold"
            style={{ fontSize, letterSpacing: -0.3 }}
          >
            {title}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}
