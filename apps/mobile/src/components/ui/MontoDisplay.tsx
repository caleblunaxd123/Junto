import React from 'react';
import { Text, TextProps } from 'react-native';

interface MontoDisplayProps extends TextProps {
  centavos: number;
  showSign?: boolean;
  /** If true, positive = green (te deben), negative = red (debes) */
  colorize?: boolean;
}

export function MontoDisplay({ centavos, showSign, colorize, className, ...props }: MontoDisplayProps) {
  const soles = (Math.abs(centavos) / 100).toFixed(2);
  const isPositive = centavos >= 0;
  const sign = showSign ? (isPositive ? '+' : '-') : '';

  let colorClass = 'text-texto';
  if (colorize) {
    colorClass = isPositive ? 'text-verde' : 'text-rojo';
  }

  return (
    <Text className={`${colorClass} ${className || ''}`} {...props}>
      {sign}S/{soles}
    </Text>
  );
}
