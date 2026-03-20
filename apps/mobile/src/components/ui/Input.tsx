import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, leftIcon, onFocus, onBlur, secureTextEntry, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const borderColor = error ? '#EF4444' : focused ? '#6366F1' : '#F3F4F6';
    const bgColor = error ? '#FFF5F5' : 'white';
    const isPassword = secureTextEntry === true;

    return (
      <View style={{ marginBottom: 20 }}>
        {label && (
          <Text style={{ color: '#374151', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 }}>
            {label}
          </Text>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: bgColor,
            borderRadius: 16,
            paddingHorizontal: 16,
            height: 56,
            borderWidth: 1.5,
            borderColor,
            shadowColor: '#6366F1',
            shadowOpacity: focused ? 0.08 : 0,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: focused ? 3 : 0,
          }}
        >
          {leftIcon && <View style={{ marginRight: 12, opacity: focused ? 1 : 0.6 }}>{leftIcon}</View>}
          <TextInput
            ref={ref}
            style={styles.textInput}
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            secureTextEntry={isPassword && !showPassword}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />
          {isPassword && (
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ padding: 4 }}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          )}
        </View>
        {error && (
          <Text style={{ color: '#E24B4A', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
            {error}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  textInput: {
    flex: 1,
    color: '#1A1A1A',
    fontSize: 16,
    paddingVertical: 0, // avoid Android extra padding
  },
});
