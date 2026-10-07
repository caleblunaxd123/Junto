import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { avatarColors, initials } from "../../lib/people";

export const palette = {
  background: "#FFFCF7",
  surface: "#FFFFFF",
  ink: "#082644",
  muted: "#64748B",
  primary: "#00AD83",
  mint: "#E7FBF3",
  purple: "#8055ED",
  lilac: "#F2EDFF",
  coral: "#D9404C",
  blush: "#FFF0F1",
  line: "#E6EAF0",
  yellow: "#FFF4D7",
};
export function Label({
  children,
  size = 15,
  weight = "regular",
  color = palette.ink,
  style,
  ...props
}: React.ComponentProps<typeof Text> & {
  size?: number;
  weight?: "regular" | "medium" | "bold" | "extra";
  color?: string;
}) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: {
            regular: "Jakarta",
            medium: "JakartaMedium",
            bold: "JakartaBold",
            extra: "JakartaExtra",
          }[weight],
          fontSize: size,
          color,
          lineHeight: size * 1.45,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[design.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  loading = false,
  disabled = false,
  compact = false,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Smaller button for inline actions inside cards. */
  compact?: boolean;
  accessibilityHint?: string;
}) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        design.button,
        compact && { minHeight: 44, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14 },
        {
          backgroundColor: secondary ? palette.lilac : palette.primary,
          opacity: disabled || loading ? 0.55 : pressed ? 0.82 : 1,
        },
      ]}
    >
      {!secondary && (
        <LinearGradient
          pointerEvents="none"
          colors={["#00856A", "#007B60"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: compact ? 14 : 20 }]}
        />
      )}
      {loading ? (
        <ActivityIndicator color={secondary ? palette.purple : "white"} />
      ) : (
        <Label
          weight="bold"
          size={compact ? 14 : 16}
          color={secondary ? palette.purple : "white"}
          style={{ textAlign: "center" }}
        >
          {title}
        </Label>
      )}
    </Pressable>
  );
}
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  scroll = true,
  resetOnFocus = false,
  onRefresh,
  refreshing = false,
  onBack,
  footer,
  compact = false,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  scroll?: boolean;
  resetOnFocus?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onBack?: () => void;
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  const scrollView = React.useRef<ScrollView>(null);
  useFocusEffect(
    React.useCallback(() => {
      if (resetOnFocus) scrollView.current?.scrollTo({ y: 0, animated: false });
    }, [resetOnFocus]),
  );
  const content = (
    <View style={{ padding: 16, gap: 16 }}>
      {title && (
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver"
              onPress={onBack || (() =>
                router.canGoBack() ? router.back() : router.replace("/(app)")
              )}
              style={design.back}
            >
              <Ionicons name="arrow-back" size={24} color={palette.ink} />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Label weight="extra" size={compact ? 23 : 27}>
              {title}
            </Label>
            {subtitle && <Label color={palette.muted}>{subtitle}</Label>}
          </View>
        </View>
      )}
      {children}
    </View>
  );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.background }}
      edges={["top", "left", "right", "bottom"]}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {scroll ? (
        <ScrollView
          ref={scrollView}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} /> : undefined}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {footer && <View style={{ padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: palette.background }}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Avatar({
  name,
  size = 44,
  photo,
  seed,
}: {
  name: string;
  size?: number;
  photo?: string | null;
  /** Stable id (user id) so two people with the same name get different colors. */
  seed?: string;
}) {
  const colors = avatarColors(seed || name);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Foto de ${name}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text
          allowFontScaling={false}
          style={{ fontFamily: "JakartaExtra", fontSize: Math.round(size * 0.38), color: colors.fg }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: palette.blush, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: "#F6D8DD", flexDirection: "row", alignItems: "flex-start", gap: 10 }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: "#FADDE1", alignItems: "center", justifyContent: "center" }}><Ionicons name="alert-circle-outline" size={20} color={palette.coral} /></View>
      <Label size={13} color={palette.coral} style={{ flex: 1 }}>{message}</Label>
    </View>
  );
}
export const design = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EDF0F2",
    gap: 12,
  },
  button: {
    minHeight: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F5FC",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CFD8E5",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Jakarta",
    fontSize: 16,
    color: palette.ink,
    backgroundColor: "white",
    minHeight: 54,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
});
