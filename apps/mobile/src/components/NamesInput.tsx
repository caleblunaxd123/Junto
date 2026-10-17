import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import type { ExistingContact } from "expo-contacts";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Label, palette, design } from "./ui/Design";

type PhoneContact = { id: string; name: string; phone?: string; key: string };
const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

/**
 * Type a name, press Agregar: people who will share expenses, even without JUNTO yet. With the
 * agenda allowed, the same field searches the phone's contacts as you type (like Yape) and one tap
 * adds each person. Contacts are read on the phone only: nothing is uploaded.
 */
export function NamesInput({ names, onChange, taken = [], disabled = false, autoFocus = false, collapsible = false, onPendingChange }: {
  names: string[]; onChange: (names: string[]) => void; taken?: string[]; disabled?: boolean; autoFocus?: boolean;
  collapsible?: boolean; onPendingChange?: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(!collapsible);
  const [picking, setPicking] = useState(false);
  const [contacts, setContacts] = useState<PhoneContact[] | null>(null);
  const pickerLock = useRef(false);
  const input = useRef<TextInput>(null);
  useEffect(() => { if (expanded && collapsible) input.current?.focus(); }, [expanded, collapsible]);
  function add(raw = value) {
    const name = raw.replace(/\s+/g, " ").trim();
    if (!name) return;
    if (name.length > 60) return setError("Usa un nombre más corto (hasta 60 letras).");
    const key = name.toLocaleLowerCase("es");
    if ([...taken, ...names].some((n) => n.toLocaleLowerCase("es") === key)) return setError(`«${name}» ya está. Agrega su apellido para distinguirlos.`);
    onChange([...names, name]);
    setValue("");
    onPendingChange?.("");
    // With the agenda open the field stays ready for the next person, like a contact search.
    if (collapsible && !contacts) setExpanded(false);
    setError("");
  }
  async function loadContacts() {
    if (pickerLock.current || disabled) return;
    pickerLock.current = true; setPicking(true); setError("");
    try {
      const api = await import("expo-contacts");
      if (!(await api.requestPermissionsAsync()).granted) {
        setError("No se habilitó la agenda. Puedes escribir los nombres o permitir Contactos en los ajustes de JUNTO.");
        return;
      }
      const { data } = await api.getContactsAsync({ fields: [api.Fields.Name, api.Fields.FirstName, api.Fields.LastName, api.Fields.PhoneNumbers], sort: api.SortTypes.FirstName, pageSize: 3000 });
      const list = data.map((c: ExistingContact) => {
        const name = (c.name || [c.firstName, c.lastName].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim();
        const phone = c.phoneNumbers?.[0]?.number;
        return { id: c.id ?? name, name, phone, key: fold(`${name} ${phone ?? ""}`) };
      }).filter((c) => c.name);
      setContacts(list);
      setExpanded(true);
      if (!list.length) setError("Tu agenda no tiene contactos con nombre. Escribe los nombres.");
      else setTimeout(() => input.current?.focus(), 50);
    } catch {
      setError("No pudimos abrir la agenda. Puedes seguir agregando nombres manualmente.");
    } finally { pickerLock.current = false; setPicking(false); }
  }
  const chosen = new Set([...taken, ...names].map(fold));
  const query = fold(value.trim());
  const digits = value.replace(/\D/g, "");
  const matches = contacts && query ? contacts.filter((c) => !chosen.has(fold(c.name)) && (` ${c.key}`.includes(` ${query}`) || (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)))).slice(0, 6) : [];
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
          onSubmitEditing={() => add()}
          blurOnSubmit={false}
          returnKeyType="done"
          placeholder={contacts ? "Busca o escribe un nombre" : "Ej. Ana"}
          placeholderTextColor="#8B98AE"
          autoCapitalize="words"
          autoFocus={autoFocus}
          editable={!disabled}
          maxLength={60}
          style={[design.input, { flex: 1 }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Agregar persona" disabled={disabled || picking || !value.trim()} onPress={() => add()}
          style={{ minHeight: 54, paddingHorizontal: 16, borderRadius: 16, justifyContent: "center", backgroundColor: value.trim() ? "#00856A" : palette.line }}>
          <Label weight="bold" size={14} color={value.trim() ? "white" : palette.muted}>Agregar</Label>
        </Pressable>
      </View> : <Pressable accessibilityRole="button" accessibilityLabel="Agregar persona" disabled={disabled} onPress={() => setExpanded(true)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 58, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#69BCA6" }}>
        <Ionicons name="add-circle-outline" size={26} color={palette.positive} /><Label size={16} weight="bold" color={palette.positive}>Agregar persona</Label>
      </Pressable>}
      {matches.length > 0 && <View accessibilityLabel="Contactos que coinciden" style={{ borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: "white", overflow: "hidden" }}>
        {matches.map((c, i) => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Agregar a ${c.name}`} disabled={disabled} onPress={() => add(c.name)}
          style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: palette.line }}>
          <Avatar name={c.name} size={34} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label size={15} weight="bold" numberOfLines={1}>{c.name}</Label>
            {!!c.phone && <Label size={12} color={palette.muted} numberOfLines={1}>{c.phone}</Label>}
          </View>
          <Ionicons name="add-circle" size={26} color={palette.positive} />
        </Pressable>)}
      </View>}
      {!!contacts && !!query && !matches.length && <Label size={12} color={palette.muted}>No está en tu agenda. Toca «Agregar» para sumarlo con ese nombre.</Label>}
      {Platform.OS !== "web" && !contacts && <>
        <Pressable accessibilityRole="button" accessibilityLabel="Buscar en mis contactos" disabled={disabled || picking} onPress={() => { void loadContacts(); }} style={{ minHeight: 52, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: palette.mint }}>
          <Ionicons name="search" size={20} color={palette.positive} /><Label size={15} weight="bold" color={palette.positive}>{picking ? "Abriendo tu agenda…" : "Buscar en mis contactos"}</Label>
        </Pressable>
        <Label size={12} color={palette.muted}>Solo agregamos los nombres que elijas. Tu agenda no sale del celular ni enviamos invitaciones automáticamente.</Label>
      </>}
      {!!contacts && contacts.length > 0 && !query && <Label size={12} color={palette.muted}>Escribe un nombre o número para buscar entre tus {contacts.length} contactos.</Label>}
      {!!error && <Label size={12} color={palette.coral}>{error}</Label>}

    </View>
  );
}
