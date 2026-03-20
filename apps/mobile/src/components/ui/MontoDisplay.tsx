import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

interface MontoDisplayProps extends Omit<TextProps, 'style'> {
  centavos: number;
  showSign?: boolean;
  colorize?: boolean;
  style?: TextProps['style'];
}

export function MontoDisplay({ centavos, showSign, colorize, style, ...props }: MontoDisplayProps) {
  const soles = (Math.abs(centavos) / 100).toFixed(2);
  const isPositive = centavos >= 0;
  const sign = showSign ? (isPositive ? '+' : '-') : '';

  const colorStyle = colorize
    ? isPositive ? styles.verde : styles.rojo
    : styles.texto;

  return (
    <Text style={[styles.base, colorStyle, style]} {...props}>
      {sign}S/{soles}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { fontSize: 15, fontWeight: '600' },
  texto: { color: '#1A1A1A' },
  verde: { color: '#1D9E75' },
  rojo: { color: '#E24B4A' },
});
