import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Label, palette, design } from "./ui/Design";

/** Type a name, press Agregar: people who will share expenses, even without JUNTO yet. */
export function NamesInput({ names, onChange, taken = [], disabled = false, autoFocus = false }: {
  names: string[]; onChange: (names: string[]) => void; taken?: string[]; disabled?: boolean; autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  function add() {
    const name = value.replace(/\s+/g, " ").trim();
    if (!name) return;
    if (name.length > 60) return setError("Usa un nombre más corto (hasta 60 letras).");
    const key = name.toLocaleLowerCase("es");
    if ([...taken, ...names].some((n) => n.toLocaleLowerCase("es") === key)) return setError(`«${name}» ya está. Agrega su apellido para distinguirlos.`);
    onChange([...names, name]);
    setValue("");
    setError("");
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          accessibilityLabel="Nombre de la persona"
          value={value}
          onChangeText={(text) => { setValue(text); setError(""); }}
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
      </View>
      {!!error && <Label size={12} color={palette.coral}>{error}</Label>}
      {names.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {names.map((name) => (
            <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, paddingRight: 10, minHeight: 40, borderRadius: 20, backgroundColor: "white", borderWidth: 1, borderColor: palette.line }}>
              <Avatar name={name} size={30} />
              <Label size={14} weight="bold">{name}</Label>
              <Pressable accessibilityRole="button" accessibilityLabel={`Quitar a ${name}`} hitSlop={10} disabled={disabled} onPress={() => onChange(names.filter((n) => n !== name))}>
                <Ionicons name="close" size={18} color={palette.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
