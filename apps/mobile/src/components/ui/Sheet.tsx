import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Label, palette } from "./Design";
import { useResponsiveLayout } from "./responsive";

/**
 * The one panel style for JUNTO, matching AppDialog: a bottom sheet on phones and a centered card on
 * the web and tablets, same backdrop, rounded white card, header with an optional eyebrow and ✕.
 */
export function Sheet({ visible, onClose, title, subtitle, eyebrow, header, children, footer, width = 520, scroll = true, keyboard = false, dismissable = true, onShow, closeLabel = "Cerrar" }: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  /** Replaces the title block (e.g. an avatar next to the title). */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Stays visible under the scrolling content (main actions). */
  footer?: React.ReactNode;
  width?: number;
  scroll?: boolean;
  keyboard?: boolean;
  /** false while saving: neither the backdrop nor ✕ close it. */
  dismissable?: boolean;
  onShow?: () => void;
  closeLabel?: string;
}) {
  const { tablet } = useResponsiveLayout();
  const { height } = useWindowDimensions();
  const close = () => { if (dismissable) onClose(); };
  const body = scroll
    ? <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ flexShrink: 1 }} contentContainerStyle={styles.content}>{children}</ScrollView>
    : <View style={styles.content}>{children}</View>;
  const Wrapper = keyboard && Platform.OS === "ios" ? KeyboardAvoidingView : View;
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType={Platform.OS === "web" ? "fade" : "slide"} onShow={onShow} onRequestClose={close}>
      <Wrapper {...(keyboard && Platform.OS === "ios" ? { behavior: "padding" as const } : {})} style={[styles.scrim, tablet ? styles.centered : styles.bottom]}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={close} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={tablet ? [] : ["bottom"]} accessibilityViewIsModal
          style={[styles.card, tablet ? [styles.cardCentered, { maxWidth: width, maxHeight: Math.min(height * 0.86, 760) }] : [styles.cardBottom, { maxHeight: height * 0.9 }]]}>
          {!tablet && <View style={styles.handle} />}
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 4 }}>
              {header ?? <>
                {!!eyebrow && <Label size={11} weight="extra" color="#6942CA" style={{ letterSpacing: 1.4 }}>{eyebrow}</Label>}
                {!!title && <Label accessibilityRole="header" size={22} weight="extra">{title}</Label>}
                {!!subtitle && <Label size={13} color={palette.muted}>{subtitle}</Label>}
              </>}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} accessibilityState={{ disabled: !dismissable }} disabled={!dismissable} hitSlop={8} onPress={close} style={[styles.close, { opacity: dismissable ? 1 : 0.4 }]}>
              <Ionicons name="close" size={22} color={palette.ink} />
            </Pressable>
          </View>
          {body}
          {!!footer && <View style={styles.footer}>{footer}</View>}
        </SafeAreaView>
      </Wrapper>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(8,38,68,0.52)" },
  centered: { justifyContent: "center", alignItems: "center", padding: 22 },
  bottom: { justifyContent: "flex-end", alignItems: "stretch" },
  card: { width: "100%", backgroundColor: palette.surface, overflow: "hidden", borderColor: "#FFFFFF", elevation: 16, shadowColor: palette.ink, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  cardCentered: { borderRadius: 28, borderWidth: 1 },
  cardBottom: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#D3DDEA", marginTop: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F8FB", borderWidth: 1, borderColor: palette.line },
  content: { paddingHorizontal: 24, paddingBottom: 22, gap: 12 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 22, gap: 10, borderTopWidth: 1, borderColor: palette.line },
});
