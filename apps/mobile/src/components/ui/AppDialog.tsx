import React from "react";
import { AccessibilityInfo, ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { createDialogQueue, DialogButton, DialogOptions } from "../../lib/dialogQueue";
import { Label, palette } from "./Design";

const queue = createDialogQueue();
export const AppDialog = {
  alert(title: string, message?: string, buttons?: DialogButton[], options?: DialogOptions) {
    Keyboard.dismiss();
    queue.alert(title, message, buttons, options);
  },
};
const tones = {
  info: { color: "#6942CA", background: palette.lilac, icon: "information-circle-outline" as const },
  success: { color: "#007B60", background: palette.mint, icon: "checkmark-circle-outline" as const },
  warning: { color: "#8A5B05", background: palette.yellow, icon: "alert-circle-outline" as const },
  danger: { color: "#BD2938", background: palette.blush, icon: "shield-checkmark-outline" as const },
};

export function DialogHost() {
  const dialog = React.useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const { height, width, fontScale } = useWindowDimensions();
  const announced = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    if (dialog && announced.current !== dialog.id) {
      announced.current = dialog.id;
      AccessibilityInfo.announceForAccessibility(`${dialog.title}. ${dialog.message}${dialog.summary ? ` ${dialog.summary.label}: ${dialog.summary.value}. ${dialog.summary.caption || ""}` : ""}`);
    }
  }, [dialog]);
  if (!dialog) return null;
  const destructive = dialog.buttons.some((button) => button.style === "destructive");
  const tone = tones[dialog.tone || (destructive ? "danger" : dialog.buttons.length > 1 ? "warning" : "info")];
  const horizontal = dialog.buttons.length === 2 && width >= 360 && fontScale <= 1.25 && dialog.buttons.every((button) => button.text.length <= 16);
  const action = (index?: number) => { void queue.choose(dialog.id, index); };
  return <Modal key={dialog.id} visible transparent animationType="none" statusBarTranslucent onRequestClose={() => action()}>
    <SafeAreaView style={styles.scrim}>
      <View style={[styles.card, { maxHeight: height * 0.86 }]} accessibilityViewIsModal>
        <ScrollView bounces={false} contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            <View style={[styles.icon, { backgroundColor: tone.background }]}><Ionicons name={tone.icon} size={30} color={tone.color} /></View>
            <Label size={11} weight="extra" color={tone.color} style={{ letterSpacing: 1.4 }}>{dialog.eyebrow || "JUNTO · CUENTAS CLARAS"}</Label>
          </View>
          <Label accessibilityRole="header" weight="extra" size={23}>{dialog.title}</Label>
          {!!dialog.message && <Label size={14} color={palette.muted}>{dialog.message}</Label>}
          {dialog.summary && <View style={[styles.summary, { backgroundColor: tone.background }]}>
            <Label size={13} weight="bold" color={tone.color}>{dialog.summary.label}</Label>
            <Label size={34} weight="extra" color={tone.color}>{dialog.summary.value}</Label>
            {!!dialog.summary.caption && <Label size={12} color={tone.color}>{dialog.summary.caption}</Label>}
          </View>}
          {!!dialog.details?.length && <View style={styles.details}>{dialog.details.map((detail) => <View key={detail.label} style={styles.detail}>
            <Label size={12} color={palette.muted} style={{ flex: 1 }}>{detail.label}</Label><Label size={13} weight="bold" style={{ flexShrink: 1, textAlign: "right" }}>{detail.value}</Label>
          </View>)}</View>}
          {!!dialog.footnote && <View style={styles.note}><Ionicons name="lock-closed-outline" size={16} color={palette.muted} /><Label size={11} color={palette.muted} style={{ flex: 1 }}>{dialog.footnote}</Label></View>}
        </ScrollView>
        <View style={[styles.actions, horizontal && { flexDirection: "row" }]}>{dialog.buttons.map((button, index) => {
          const secondary = button.style === "cancel";
          return <Pressable key={`${button.text}-${index}`} accessibilityRole="button" accessibilityLabel={button.text} accessibilityState={{ disabled: dialog.busy, busy: dialog.busy }} disabled={dialog.busy} android_ripple={{ color: secondary ? "#08264412" : "#FFFFFF33" }} onPress={() => action(index)} style={[styles.button, horizontal && { flex: 1 }, secondary && styles.secondary, { opacity: dialog.busy ? 0.72 : 1 }]}>
            {secondary ? <Text style={[styles.buttonText, { color: palette.ink }]}>{button.text}</Text> : <LinearGradient colors={button.style === "destructive" ? ["#CD3544", "#BD2938"] : ["#00856A", "#007B60"]} style={styles.primary}>
              <Text style={styles.buttonText}>{button.text}</Text>
            </LinearGradient>}
          </Pressable>;
        })}
        {dialog.busy && <View style={styles.busy} accessibilityLiveRegion="polite"><ActivityIndicator size="small" color="#007B60" /><Label size={12} color={palette.muted}>Un momento…</Label></View>}
        </View>
      </View>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(8,38,68,0.52)", justifyContent: "center", alignItems: "center", padding: 22 },
  card: { width: "100%", maxWidth: 430, backgroundColor: palette.surface, borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: "#FFFFFF", elevation: 16, shadowColor: palette.ink, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  content: { padding: 24, paddingBottom: 18, gap: 16 },
  heading: { gap: 12 },
  icon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  summary: { padding: 18, borderRadius: 20, gap: 3 },
  details: { gap: 12 },
  detail: { flexDirection: "row", alignItems: "center", gap: 16 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 12, borderTopWidth: 1, borderColor: palette.line },
  actions: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  button: { minHeight: 52, borderRadius: 16, overflow: "hidden", justifyContent: "center" },
  secondary: { borderWidth: 1, borderColor: palette.line, backgroundColor: "#F6F8FB", paddingVertical: 14, paddingHorizontal: 12 },
  primary: { minHeight: 52, paddingVertical: 14, paddingHorizontal: 14, justifyContent: "center" },
  buttonText: { fontFamily: "JakartaBold", fontSize: 14, color: "#FFFFFF", textAlign: "center", lineHeight: 21 },
  busy: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
});
