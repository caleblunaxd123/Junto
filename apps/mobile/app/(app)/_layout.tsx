import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useAuthStore } from '../../src/store/auth.store';

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 12,
          elevation: 20,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Grupos',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-1 ${focused ? '' : 'opacity-80'}`}>
              <Ionicons name={focused ? "people" : "people-outline"} size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <View className={`p-1 ${focused ? '' : 'opacity-80'}`}>
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
            </View>
          ),
        }}
      />
      {/* Hide all sub-routes from tab bar */}
      <Tabs.Screen name="first-action" options={{ href: null }} />
      <Tabs.Screen name="grupos/[id]" options={{ href: null }} />
      <Tabs.Screen name="grupos/crear" options={{ href: null }} />
      <Tabs.Screen name="grupos/agregar-personas" options={{ href: null }} />
      <Tabs.Screen name="gastos/[id]" options={{ href: null }} />
      <Tabs.Screen name="gastos/agregar" options={{ href: null }} />
      <Tabs.Screen name="pagos/pagar" options={{ href: null }} />
    </Tabs>
  );
}
