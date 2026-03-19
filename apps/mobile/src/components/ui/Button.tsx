import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  primary: {
    container: 'bg-primary',
    text: 'text-white',
  },
  outline: {
    container: 'bg-white border-2 border-primary',
    text: 'text-primary',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-primary',
  },
  danger: {
    container: 'bg-rojo',
    text: 'text-white',
  },
};

const sizeStyles = {
  sm: { container: 'py-2 px-4', text: 'text-sm' },
  md: { container: 'py-3 px-6', text: 'text-base' },
  lg: { container: 'py-4 px-6', text: 'text-lg' },
};

export function Button({
  title,
  loading,
  variant = 'primary',
  size = 'lg',
  disabled,
  className,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`rounded-btn flex-row items-center justify-center ${v.container} ${s.container} ${isDisabled ? 'opacity-60' : ''} ${className || ''}`}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#534AB7'} />
      ) : (
        <Text className={`font-semibold ${v.text} ${s.text}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
