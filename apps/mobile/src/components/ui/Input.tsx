import React, { forwardRef } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, leftIcon, className, ...props }, ref) => {
    return (
      <View className="mb-4">
        {label && (
          <Text className="text-texto-secundario text-sm font-medium mb-1">{label}</Text>
        )}
        <View
          className={`flex-row items-center bg-white border rounded-card px-4 py-3 ${
            error ? 'border-rojo' : 'border-gray-200'
          }`}
        >
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <TextInput
            ref={ref}
            className={`flex-1 text-texto text-base ${className || ''}`}
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            {...props}
          />
        </View>
        {error && <Text className="text-rojo text-xs mt-1">{error}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';
