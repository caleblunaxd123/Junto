import React, { useEffect, useRef, useState } from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, Label, palette } from "./ui/Design";
import { firstSteps } from "../lib/firstSteps";
import { enableNotifications } from "../lib/push";
import { useAuthStore } from "../store/auth.store";

const outcomes: Record<string, string> = {
  registered: "Avisos activados para este celular. La entrega depende de tu conexión y de los ajustes del sistema.",
  unavailable: "El permiso está concedido, pero esta versión aún no tiene configurada la entrega push. Por ahora revisa las novedades dentro de JUNTO.",
  denied: "Sin problema: puedes usar JUNTO sin avisos. Verás las novedades al abrir la app.",
  settings: "El celular no permite volver a pedir el permiso aquí. Puedes habilitar los avisos en los ajustes de JUNTO.",
  unsupported: "En la web puedes revisar tus novedades dentro de JUNTO. Los avisos del celular requieren la app configurada.",
  failed: "No pudimos activar los avisos. Revisa tu conexión y vuelve a intentarlo; tus cuentas no se modificaron.",
};

/** Optional, repeatable and per account: never consumes an invitation or creates a bill. */
export function FirstSteps({ userId, onBrand = false }: { userId: string; onBrand?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    setVisible(false); setStep(0); setResult(""); setBusy(false);
    return () => { controller.current?.abort(); };
  }, [userId]);
  const close = () => {
    controller.current?.abort(); setBusy(false); setVisible(false);
  };
  async function activate() {
    if (busy) return;
    const request = new AbortController(); controller.current = request; setBusy(true); setResult("");
    const current = () => !request.signal.aborted && !useAuthStore.getState().signingOut && useAuthStore.getState().usuario?.id === userId && useAuthStore.getState().isAuthenticated;
    const outcome = await enableNotifications(userId, current, request.signal);
    if (current()) { setResult(outcome); setBusy(false); }
  }
  const page = firstSteps[step];
  const open = (next: number) => { setStep(next); setResult(""); setVisible(true); };
  return <>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Pressable accessibilityRole="button" onPress={() => open(0)} style={{ minHeight: 44, flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 12, borderRadius: 16, backgroundColor: onBrand ? "#FFFFFF24" : palette.lilac }}><Ionicons name="compass-outline" size={18} color={onBrand ? "#FFFFFF" : palette.purple} /><Label size={12} weight="bold" color={onBrand ? "#FFFFFF" : palette.purple}>Guía rápida</Label></Pressable>
      <Pressable accessibilityRole="button" onPress={() => open(3)} style={{ minHeight: 44, flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 12, borderRadius: 16, backgroundColor: onBrand ? "#FFFFFF24" : palette.mint }}><Ionicons name="notifications-outline" size={18} color={onBrand ? "#FFFFFF" : "#007B60"} /><Label size={12} weight="bold" color={onBrand ? "#FFFFFF" : "#007B60"}>Mis avisos</Label></Pressable>
    </View>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: "#08264499", justifyContent: "center", alignItems: "center" }}>
        <View accessibilityViewIsModal style={{ width: "100%", maxWidth: 480, maxHeight: "95%", borderRadius: 28, backgroundColor: palette.surface, overflow: "hidden" }}>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Label size={12} weight="bold" color={palette.purple}>PRIMEROS PASOS · {step + 1} DE {firstSteps.length}</Label>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar guía" onPress={close} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={24} color={palette.muted} /></Pressable>
            </View>
            <View style={{ alignSelf: "flex-start", padding: 20, borderRadius: 24, backgroundColor: step === 3 ? palette.lilac : palette.mint }}><Ionicons name={page.icon} size={42} color={step === 3 ? palette.purple : "#007B60"} /></View>
            <Label accessibilityRole="header" size={26} weight="extra">{page.title}</Label>
            <Label color={palette.muted}>{page.text}</Label>
            <View style={{ padding: 16, borderRadius: 18, backgroundColor: palette.yellow }}><Label size={13}>{page.example}</Label></View>
            <View style={{ flexDirection: "row", gap: 6 }}>{firstSteps.map((_, index) => <View key={index} style={{ height: 5, flex: 1, borderRadius: 3, backgroundColor: index <= step ? palette.primary : palette.line }} />)}</View>
            {step === 3 && <>
              {result && <Label accessibilityLiveRegion="polite" size={13} color={palette.muted}>{outcomes[result] || "Puedes seguir usando JUNTO."}</Label>}
              {result === "settings" && Platform.OS !== "web" ? <Button title="Abrir ajustes del celular" onPress={() => { void Linking.openSettings().catch(() => setResult("failed")); }} /> : <Button title={result === "registered" ? "Avisos activados" : "Activar avisos"} loading={busy} disabled={busy || result === "registered"} onPress={() => { void activate(); }} />}
            </>}
            <Button title={step === 3 ? "Empezar a usar JUNTO" : "Siguiente"} secondary={step === 3} onPress={() => step === 3 ? close() : setStep(step + 1)} />
            {step < 3 && <Button compact secondary title={step ? "Anterior" : "Lo veré después"} onPress={() => step ? setStep(step - 1) : close()} />}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  </>;
}
