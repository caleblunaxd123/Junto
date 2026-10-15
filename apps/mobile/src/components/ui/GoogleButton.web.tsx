import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { GOOGLE_CLIENT_ID, googleNonce, loadGoogleIdentity } from "../../lib/googleIdentity.web";
import { Button, Label, palette } from "./Design";

/** The official GIS-rendered button, not a simulated click or a custom One Tap prompt. */
export function GoogleButton({ onPress, loading = false, disabled = false }: { onPress: (idToken?: string, nonce?: string) => void; loading?: boolean; disabled?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onPress); callback.current = onPress;
  const blocked = useRef(false); blocked.current = disabled || loading;
  const focused = useIsFocused();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!focused || !host.current) return;
    let active = true;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let resize: (() => void) | undefined;
    const parent = host.current;
    setReady(false); setError("");
    loadGoogleIdentity().then((identity) => {
      if (!active) return;
      const nonce = googleNonce();
      identity.initialize({ client_id: GOOGLE_CLIENT_ID, nonce, auto_select: false, ux_mode: "popup", callback: (response) => {
        if (!active || blocked.current) return;
        if (!response.credential) { setError("Google no devolvió tu identidad. Reintenta."); return; }
        callback.current(response.credential, nonce);
      } });
      let renderedWidth = 0;
      const render = () => {
        if (!active || !parent.clientWidth) return;
        const width = Math.max(200, Math.min(400, Math.floor(parent.clientWidth)));
        if (width === renderedWidth && parent.childElementCount) return;
        renderedWidth = width;
        parent.replaceChildren();
        identity.renderButton(parent, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill", width, locale: "es" });
      };
      // GIS fixes its iframe width when rendered. Follow the actual form width after resizing.
      resize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(render); };
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(resize); observer.observe(parent); }
      else window.addEventListener('resize', resize);
      render();
      setReady(true);
    }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "No pudimos cargar Google."); });
    return () => { active = false; observer?.disconnect(); cancelAnimationFrame(frame); if (resize) window.removeEventListener('resize', resize); parent.replaceChildren(); };
  }, [focused, attempt]);
  return <View style={{ gap: 8, minHeight: 48 }}>
    <div ref={host} aria-hidden={disabled || loading} inert={disabled || loading ? true : undefined} style={{ minWidth: 0, width: '100%', minHeight: 44, display: "flex", justifyContent: "center", pointerEvents: disabled || loading ? "none" : "auto", opacity: disabled || loading ? 0.5 : 1 }} />
    {(!ready || loading) && !error && <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}><ActivityIndicator size="small" color={palette.primary} /><Label size={12}>{loading ? "Entrando a JUNTO…" : "Preparando Google…"}</Label></View>}
    {!!error && <View style={{ gap: 6 }}><Label accessibilityLiveRegion="polite" color={palette.coral} size={13}>{error}</Label><Button secondary compact title="Reintentar Google" onPress={() => setAttempt((value) => value + 1)} /></View>}
  </View>;
}
export function OrDivider({ text = "o con tu correo" }: { text?: string }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessible={false}><View style={{ flex: 1, height: 1, backgroundColor: palette.line }} /><Label size={12} color={palette.muted}>{text}</Label><View style={{ flex: 1, height: 1, backgroundColor: palette.line }} /></View>;
}
