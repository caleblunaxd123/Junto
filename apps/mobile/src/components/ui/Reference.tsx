import React from "react";
import { View, Pressable, TextInput } from "react-native";
import { MotionImage } from "./MotionImage";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import { Label, palette, design } from "./Design";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Svg
        width={compact ? 38 : 48}
        height={compact ? 38 : 48}
        viewBox="0 0 60 60"
      >
        <Circle cx="18" cy="12" r="7" fill={palette.primary} />
        <Circle cx="38" cy="8" r="8" fill={palette.primary} />
        <Path
          d="M14 23C8 25 1 39 3 47C5 53 13 51 18 44C21 55 32 56 35 47C22 49 23 42 23 32C24 24 19 21 14 23Z"
          fill={palette.primary}
        />
        <Path
          d="M33 20C23 23 25 38 27 43C30 47 35 43 35 37C35 28 43 29 44 36L47 47C50 55 60 50 58 43L54 29C52 19 42 17 33 20Z"
          fill={palette.primary}
        />
      </Svg>
      <Label
        size={compact ? 29 : 36}
        weight="extra"
        style={{ letterSpacing: -1.7 }}
      >
        JUNTO
      </Label>
    </View>
  );
}
export function ReferenceHero({
  title,
  subtitle,
  image,
  tint = palette.mint,
  height = 140,
  brand = false,
  imageSide = "right",
  titleSize = 20,
}: {
  title?: string;
  subtitle?: string;
  image: number;
  tint?: string;
  height?: number;
  brand?: boolean;
  imageSide?: "left" | "right";
  titleSize?: number;
}) {
  return (
    <View
      style={{
        minHeight: height,
        borderRadius: 22,
        backgroundColor: tint,
        overflow: "hidden",
        justifyContent: "center",
      }}
    >
      <MotionImage
        source={image}
        resizeMode={imageSide === "left" ? "cover" : "contain"}
        style={{
          position: "absolute",
          bottom: 0,
          right: imageSide === "right" ? -12 : undefined,
          left: imageSide === "left" ? -6 : undefined,
          height: height,
          width: imageSide === "left" ? "35%" : "52%",
        }}
      />
      <View
        style={{
          width: imageSide === "left" ? "65%" : "51%",
          marginLeft: imageSide === "left" ? "35%" : 0,
          padding: 14,
          gap: 6,
        }}
      >
        {brand && <Brand compact />}
        {title && (
          <Label size={titleSize} weight="extra">
            {title}
          </Label>
        )}
        {subtitle && (
          <Label size={12} color={palette.muted}>
            {subtitle}
          </Label>
        )}
      </View>
    </View>
  );
}
export function IconBubble({
  name,
  color = palette.primary,
  background = palette.mint,
  size = 40,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color?: string;
  background?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} color={color} size={size * 0.53} />
    </View>
  );
}
export function FormField({
  label,
  icon,
  error,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Label weight="bold" size={14}>
        {label}
      </Label>
      <View
        style={[
          design.input,
          error ? { borderColor: palette.coral, borderWidth: 1.5 } : undefined,
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 0,
          },
        ]}
      >
        {icon && <Ionicons name={icon} size={22} color="#56708E" />}
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel || label}
          placeholderTextColor="#8B98AE"
          style={{
            flex: 1,
            minHeight: 54,
            color: palette.ink,
            fontFamily: "JakartaMedium",
            fontSize: 15,
          }}
        />
      </View>
      {!!error && <Label accessibilityRole="alert" size={12} color={palette.coral}>{error}</Label>}
    </View>
  );
}
export function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={[design.row, { justifyContent: "space-between", marginTop: 4 }]}
    >
      <Label size={20} weight="extra" style={{ flex: 1 }}>
        {title}
      </Label>
      {action && (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={{ minHeight: 44, justifyContent: "center" }}>
          <Label size={13} color={palette.primary} weight="bold">
            {action} ›
          </Label>
        </Pressable>
      )}
    </View>
  );
}
