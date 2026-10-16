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
  Animated,
  AccessibilityInfo,
  DimensionValue,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { setStatusBarStyle } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { avatarColors, initials } from "../../lib/people";
import { photoUri } from "../../lib/media";
import { feedbackTitle } from "../../lib/errorMessage";
import { useResponsiveLayout } from "./responsive";

export const palette = {
  // A soft mint wash from the logo's green, so no screen is a flat colorless page.
  background: "#EEF6F2",
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
  // Semantic money tones (AA on white): "te deben" / "debes". Prefer these over raw hex values.
  positive: "#007B60",
  negative: "#D9404C",
  skeleton: "#E9EEF3",
};
/** The JUNTO emerald, deepest to brightest (the logo is #00AD83). Used for headers and heroes. */
export const brand = { deep: "#00513F", base: "#007A60", bright: "#00AD83", mint: "#7FE3C4", onBrand: "#FFFFFF", onBrandMuted: "#D4F5EA" };

/**
 * The brand band behind a screen's title: an emerald gradient with soft circles that echo the logo's
 * heads (and coins). Decorative only; text on it is always white with AA contrast on #007A60.
 */
export function BrandBackdrop({ children, style, rounded = false }: { children?: React.ReactNode; style?: ViewStyle; rounded?: boolean }) {
  return (
    <View style={[{ overflow: "hidden", backgroundColor: brand.base }, rounded && { borderRadius: 28 }, style]}>
      <LinearGradient pointerEvents="none" colors={[brand.deep, brand.base, "#009B76"]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        <View style={{ position: "absolute", width: 220, height: 220, borderRadius: 110, right: -70, top: -90, backgroundColor: "#FFFFFF", opacity: 0.07 }} />
        <View style={{ position: "absolute", width: 120, height: 120, borderRadius: 60, right: 70, top: -40, backgroundColor: brand.mint, opacity: 0.12 }} />
        <View style={{ position: "absolute", width: 160, height: 160, borderRadius: 80, left: -60, bottom: -110, backgroundColor: "#FFFFFF", opacity: 0.06 }} />
        <View style={{ position: "absolute", width: 64, height: 64, borderRadius: 32, right: 24, bottom: -26, borderWidth: 10, borderColor: brand.mint, opacity: 0.16 }} />
      </View>
      {children}
    </View>
  );
}
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
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}) {
  return <View testID={testID} style={[design.card, style]}>{children}</View>;
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
      aria-disabled={disabled || loading} aria-busy={loading}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        design.button,
        compact && { minHeight: 48, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14 },
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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, maxWidth: "100%" }}>
        {loading && <ActivityIndicator color={secondary ? palette.purple : "white"} />}
        <Label
          weight="bold"
          size={16}
          color={secondary ? palette.purple : "white"}
          style={{ textAlign: "center", flexShrink: 1 }}
        >
          {title}
        </Label>
      </View>
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
  wide = false,
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
  /** Landing pages and multi-column workspaces, instead of a form-sized column. */
  wide?: boolean;
}) {
  const { desktop, web } = useResponsiveLayout();
  const maxWidth = wide ? 1160 : 800;
  const scrollView = React.useRef<ScrollView>(null);
  useFocusEffect(
    React.useCallback(() => {
      if (resetOnFocus) scrollView.current?.scrollTo({ y: 0, animated: false });
    }, [resetOnFocus]),
  );
  const insets = useSafeAreaInsets();
  // Titled screens get the emerald band; the content sits on a rounded mint sheet over it.
  const band = !!title;
  // The status bar follows the screen in focus: white on the emerald band, dark on plain pages.
  useFocusEffect(React.useCallback(() => { setStatusBarStyle(band ? "light" : "dark"); }, [band]));
  const header = band && (
    <BrandBackdrop style={{ paddingTop: insets.top + (desktop ? 20 : 10), paddingBottom: 40 }}>
      <View style={{ width: "100%", maxWidth: web ? maxWidth : undefined, alignSelf: "center", paddingHorizontal: desktop ? 32 : 16, flexDirection: "row", gap: 12, alignItems: "center" }}>
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={onBack || (() =>
              router.canGoBack() ? router.back() : router.replace("/(app)/(tabs)")
            )}
            style={[design.back, { backgroundColor: "#FFFFFF26" }]}
          >
            <Ionicons name="arrow-back" size={24} color={brand.onBrand} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Label accessibilityRole="header" weight="extra" size={desktop ? 30 : compact ? 23 : 27} color={brand.onBrand}>
            {title}
          </Label>
          {subtitle && <Label color={brand.onBrandMuted}>{subtitle}</Label>}
        </View>
      </View>
    </BrandBackdrop>
  );
  const content = (
    <View style={{ width: "100%", maxWidth: web ? maxWidth : undefined, alignSelf: "center", padding: desktop ? 32 : 16, gap: desktop ? 24 : 16 }}>
      {children}
    </View>
  );
  const body = band ? (
    <>
      {header}
      <View style={{ marginTop: -24, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: palette.background, paddingTop: 6, flexGrow: 1 }}>{content}</View>
    </>
  ) : content;
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: band ? brand.base : palette.background }}
      edges={band ? ["left", "right"] : ["top", "left", "right", "bottom"]}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {scroll ? (
        <ScrollView
          ref={scrollView}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: palette.background }}
          contentContainerStyle={{ paddingBottom: band ? 24 + insets.bottom : 24, flexGrow: 1 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} colors={[palette.primary]} progressBackgroundColor="#FFFFFF" /> : undefined}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, backgroundColor: palette.background }}>{body}</View>
      )}
      {footer && <View style={{ borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: "#FFFFFF", paddingBottom: band ? insets.bottom : 0 }}><View style={{ width: "100%", maxWidth: web ? maxWidth : undefined, alignSelf: "center", padding: 16, gap: 8 }}>{footer}</View></View>}
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
  // A photo that no longer exists (or no connection) falls back to the initials.
  const uri = photoUri(photo);
  const [failed, setFailed] = React.useState<string | undefined>();
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
      {uri && failed !== uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" onError={() => setFailed(uri)} />
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
/**
 * Placeholder while content loads: keeps the layout so nothing jumps when data arrives.
 * It pulses softly, and stays still when the system asks to reduce motion.
 */
export function Skeleton({ width = "100%", height = 16, radius = 8 }: { width?: DimensionValue; height?: number; radius?: number }) {
  const opacity = React.useRef(new Animated.Value(0.55)).current;
  React.useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== "web" }),
      ]));
      loop.start();
    });
    return () => { cancelled = true; loop?.stop(); };
  }, [opacity]);
  return <Animated.View importantForAccessibility="no" accessibilityElementsHidden style={{ width, height, borderRadius: radius, backgroundColor: palette.skeleton, opacity }} />;
}
/** A card-shaped placeholder for lists (groups, accounts) while they load. */
export function SkeletonRow() {
  return (
    <View style={[design.card, { padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }]}>
      <Skeleton width={64} height={64} radius={16} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} />
        <Skeleton width="50%" height={12} />
      </View>
    </View>
  );
}
export function FeedbackBox({ message, title, tone = "info" }: { message: string; title: string; tone?: "info" | "success" | "warning" | "error" }) {
  const colors = {
    info: {bg: palette.lilac, border: "#DDD2F6", color: "#6543C4", icon: "information-circle-outline" as const},
    success: {bg: palette.mint, border: "#BDEBD9", color: "#007B60", icon: "checkmark-circle-outline" as const},
    warning: {bg: palette.yellow, border: "#F1DFA8", color: "#79520A", icon: "time-outline" as const},
    error: {bg: palette.blush, border: "#F6D8DD", color: "#BD2938", icon: "alert-circle-outline" as const},
  }[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: colors.bg, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "flex-start", gap: 10 }}
    >
      <Ionicons name={colors.icon} size={24} color={colors.color} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 4 }}><Label size={16} weight="bold" color={colors.color}>{title}</Label><Label size={15} color={palette.ink}>{message}</Label></View>
    </View>
  );
}
export function ErrorBox({ message, title }: { message: string; title?: string }) {
  const heading = title || feedbackTitle(message);
  return <FeedbackBox message={message} title={heading} tone={heading === "Revisa este paso" ? "error" : "warning"} />;
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
