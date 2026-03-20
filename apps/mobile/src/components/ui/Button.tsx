import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export function Button({
  title,
  loading,
  variant = 'primary',
  size = 'lg',
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyles: ViewStyle[] = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'outline' && styles.outline,
    variant === 'ghost' && styles.ghost,
    variant === 'danger' && styles.danger,
    size === 'sm' && styles.sizeSm,
    size === 'md' && styles.sizeMd,
    size === 'lg' && styles.sizeLg,
    isDisabled ? styles.disabled : undefined,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textColor =
    variant === 'primary' || variant === 'danger' ? '#fff' : '#534AB7';
  const fontSize = size === 'sm' ? 14 : size === 'md' ? 16 : 17;

  return (
    <TouchableOpacity
      style={containerStyles}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#6366F1' },
  outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#E5E7EB' },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: '#EF4444' },
  disabled: { opacity: 0.5 },
  sizeSm: { paddingVertical: 8, paddingHorizontal: 16 },
  sizeMd: { paddingVertical: 12, paddingHorizontal: 24 },
  sizeLg: { paddingVertical: 16, paddingHorizontal: 28 },
  text: { fontWeight: '600', letterSpacing: -0.2 },
});
