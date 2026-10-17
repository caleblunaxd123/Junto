import React, { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Label, palette, design } from "./ui/Design";

/** Type a name, press Agregar: people who will share expenses, even without JUNTO yet. */
export function NamesInput({ names, onChange, taken = [], disabled = false, autoFocus = false, collapsible = false, onPendingChange }: {
  names: string[]; onChange: (names: string[]) => void; taken?: string[]; disabled?: boolean; autoFocus?: boolean;
  collapsible?: boolean; onPendingChange?: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(!collapsible);
  const input = useRef<TextInput>(null);
  useEffect(() => { if (expanded && collapsible) input.current?.focus(); }, [expanded, collapsible]);
  function add() {
    const name = value.replace(/\s+/g, " ").trim();
    if (!name) return;
    if (name.length > 60) return setError("Usa un nombre más corto (hasta 60 letras).");
    const key = name.toLocaleLowerCase("es");
    if ([...taken, ...names].some((n) => n.toLocaleLowerCase("es") === key)) return setError(`«${name}» ya está. Agrega su apellido para distinguirlos.`);
    onChange([...names, name]);
    setValue("");
    onPendingChange?.("");
    if (collapsible) setExpanded(false);
    setError("");
  }
  return (
    <View style={{ gap: 8 }}>
      {names.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {names.map((name) => (
            <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 6, paddingRight: 2, minHeight: 48, borderRadius: 24, backgroundColor: palette.mint, borderWidth: 1, borderColor: palette.line }}>
              <Avatar name={name} size={30} />
              <Label size={14} weight="bold">{name}</Label>
              <Pressable accessibilityRole="button" accessibilityLabel={`Quitar a ${name}`} disabled={disabled} onPress={() => onChange(names.filter((n) => n !== name))} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color={palette.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {expanded ? <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          ref={input}
          accessibilityLabel="Nombre de la persona"
          value={value}
          onChangeText={(text) => { setValue(text); onPendingChange?.(text); setError(""); }}
          onSubmitEditing={add}
          blurOnSubmit={false}
          returnKeyType="done"
          placeholder="Ej. Ana"
          placeholderTextColor="#8B98AE"
          autoCapitalize="words"
          autoFocus={autoFocus}
          editable={!disabled}
          maxLength={60}
          style={[design.input, { flex: 1 }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Agregar persona" disabled={disabled || !value.trim()} onPress={add}
          style={{ minHeight: 54, paddingHorizontal: 16, borderRadius: 16, justifyContent: "center", backgroundColor: value.trim() ? "#00856A" : palette.line }}>
          <Label weight="bold" size={14} color={value.trim() ? "white" : palette.muted}>Agregar</Label>
        </Pressable>
      </View> : <Pressable accessibilityRole="button" accessibilityLabel="Agregar persona" disabled={disabled} onPress={() => setExpanded(true)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 58, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#69BCA6" }}>
        <Ionicons name="add-circle-outline" size={26} color={palette.positive} /><Label size={16} weight="bold" color={palette.positive}>Agregar persona</Label>
      </Pressable>}
      {!!error && <Label size={12} color={palette.coral}>{error}</Label>}

    </View>
  );
}
