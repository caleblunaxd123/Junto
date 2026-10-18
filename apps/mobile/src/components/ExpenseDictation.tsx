import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Sheet } from "./ui/Sheet";
import { Button, Label, ErrorBox, design, palette } from "./ui/Design";
import { createDictation, dictationError, type DictationState } from "../lib/dictation";
import { getSpeechDriver } from "../lib/speechDriver";

export function ExpenseDictation({ visible, onClose, onUse, onUseAndPrepare, replacing }: {
  visible: boolean; onClose: () => void; onUse: (text: string) => void; onUseAndPrepare?: (text: string) => void; replacing: boolean;
}) {
  const [state, setState] = useState<DictationState>("idle");
  const stateRef = useRef<DictationState>("idle");
  stateRef.current = state;
  const [text, setText] = useState(""); const [error, setError] = useState("");
  const session = useRef<ReturnType<typeof createDictation> | null>(null);
  const attempt = useRef(0); const locked = useRef(false);
  const cancel = () => { attempt.current++; locked.current = false; session.current?.cancel(); session.current = null; };
  useEffect(() => {
    if (!visible) return;
    setText(""); setError(""); setState("idle");
    // Android's permission prompt pauses the app ("background"). Cancelling then silently dropped the
    // dictation the person had just allowed, so it never listened. Only an open mic stops on leaving.
    const listener = AppState.addEventListener("change", next => { if (next === "background" && stateRef.current !== "permission") cancel(); });
    return () => { cancel(); listener.remove(); };
  }, [visible]);
  async function start() {
    if (locked.current) return;
    locked.current = true; const own = ++attempt.current;
    setState("permission"); setError("");
    try {
      const driver = await getSpeechDriver();
      if (own !== attempt.current) return;
      session.current = createDictation(driver, { text: setText, error: setError, state: next => { setState(next); if (next === "idle") locked.current = false; } });
      await session.current.start();
    } catch {
      if (own === attempt.current) { locked.current = false; setState("idle"); setError(dictationError("unavailable")); }
    }
  }
  const ready = state === "idle" && text.trim().length >= 3;
  return <Sheet visible={visible} onClose={onClose} title="Dictar un gasto" subtitle="Habla → revisa el texto → revisa el reparto." width={520}>
    <View style={{ gap: 12 }}>
      <Label size={13}>Ejemplo: «Pagué ciento veinte soles por la cena con Ana y Luis».</Label>
      <Label size={12} color={palette.muted}>Solo escuchamos al tocar el botón, por hasta 30 segundos. El servicio de voz de tu celular o navegador puede procesar el audio en sus servidores. JUNTO no guarda el audio; solo envía el texto cuando eliges completar el formulario.</Label>
      <View style={{ alignItems: "center", gap: 8, padding: 14, borderRadius: 18, backgroundColor: state === "listening" ? palette.mint : palette.lilac }}>
        <Ionicons name={state === "listening" ? "mic" : "mic-outline"} size={32} color={palette.primary} />
        <Label accessibilityLiveRegion="polite" weight="bold">{state === "permission" ? "Preparando micrófono…" : state === "listening" ? "Te escucho…" : state === "finishing" ? "Terminando el dictado…" : text ? "Dictado terminado · revisa el texto" : "Listo para dictar · toca Empezar"}</Label>
      </View>
      {state === "idle" ? <Button title={text ? "Volver a dictar" : "Empezar dictado"} onPress={start} /> : <Button secondary title="Terminar dictado" onPress={() => state === "permission" ? cancel() : session.current?.stop()} disabled={state === "finishing"} />}
      {!!error && <ErrorBox message={error} />}
      {!!error && state === "idle" && Platform.OS !== "web" && /permiso|acceder al audio/.test(error) && <Button compact secondary title="Abrir ajustes de JUNTO" onPress={() => { void Linking.openSettings().catch(() => setError("Abre Ajustes del celular → Aplicaciones → JUNTO → Permisos → Micrófono.")); }} />}
      <TextInput accessibilityLabel="Texto dictado del gasto" value={text} onChangeText={setText} editable={state === "idle"} multiline maxLength={500} placeholder="Aquí aparecerá tu frase. También puedes escribirla." placeholderTextColor={palette.muted} style={[design.input, { minHeight: 90 }]} />
      {replacing && <Label size={12} color={palette.muted}>«Usar este texto» reemplaza tu frase anterior. Cerrar conserva lo que ya escribiste.</Label>}
      {onUseAndPrepare && <Button title="Completar formulario con esta frase" disabled={!ready} onPress={() => { onUseAndPrepare(text.trim()); onClose(); }} />}
      <Button secondary title="Usar este texto" disabled={!ready} onPress={() => { onUse(text.trim()); onClose(); }} />
      <Label size={12} color={palette.muted}>Todavía no se guarda ningún gasto. Revisa los nombres y el monto antes de continuar.</Label>
    </View>
  </Sheet>;
}
