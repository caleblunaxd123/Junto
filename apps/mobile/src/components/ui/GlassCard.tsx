import React from 'react';
import { View, ViewProps } from 'react-native';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  intensity?: number;
  className?: string;
}

export function GlassCard({ children, intensity = 1, className = '', ...props }: GlassCardProps) {
  return (
    <View
      className={`rounded-card overflow-hidden border border-white/30 shadow-glass ${className}`}
      style={[
        {
          backgroundColor: `rgba(255, 255, 255, ${0.7 * intensity})`,
        },
        props.style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
