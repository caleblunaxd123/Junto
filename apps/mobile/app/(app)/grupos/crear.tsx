import React, { useState } from "react";
import { View, TextInput, Pressable, Image, ScrollView, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCrearGrupo } from "../../../src/hooks/useGrupos";
import { useAuthStore } from "../../../src/store/auth.store";
import { api } from "../../../src/lib/api";
import { queryClient } from "../../../src/lib/queryClient";
import { guessGroupType } from "../../../src/lib/groupType";
import { Screen, Label, Button, ErrorBox, palette, design } from "../../../src/components/ui/Design";
import { FormField } from "../../../src/components/ui/Reference";
import { art } from "../../../src/components/ui/Artwork";

const types = [
  { id: "roomies", label: "Depa", image: art.home },
  { id: "pareja", label: "Pareja", image: art.couple },
  { id: "viaje", label: "Viaje", image: art.travel },
  { id: "amigos", label: "Amigos", image: art.group },
  { id: "otro", label: "Otro", image: art.other },
];

export default function CreateGroup() {
  const user = useAuthStore((s) => s.usuario);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const type = picked ?? guessGroupType(name) ?? "amigos";
  const [error, setError] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [createdId, setCreatedId] = useState("");
  const [busy, setBusy] = useState(false);
  // Whoever creates the group usually organizes and collects: they may approve uploaded vouchers too.
  const [adminApproves, setAdminApproves] = useState(true);
  const create = useCrearGrupo();

  function addPerson() {
    const value = identifier.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(value) && !/^(?:\+51\s*)?9\d{8}$/.test(value)) {
      setError("Escribe un correo o un celular peruano de 9 dígitos.");
      return;
    }
    if (value === user?.email || people.includes(value)) {
      setError("Esta persona ya está en la lista.");
      return;
    }
    setPeople((p) => [...p, value]);
    setIdentifier("");
    setError("");
  }

  async function submit() {
    if (busy) return;
    if (name.trim().length < 2 || name.trim().length > 100) {
      setError("Ponle un nombre de 2 a 100 letras, por ejemplo «Depa Miraflores».");
      return;
    }
    if (identifier.trim()) {
      setError("Toca «Agregar» para sumar a esa persona, o borra el campo.");
      return;
    }
    let groupId = createdId;
    try {
      setBusy(true);
      setError("");
      if (!groupId) {
        const group = await create.mutateAsync({ nombre: name.trim(), tipo: type, aprobacionPagos: adminApproves ? "administrador" : "receptor" });
        groupId = group.id;
        setCreatedId(groupId);
      }
      const results = await Promise.all(
        people.map((identificador) => api.post(`/grupos/${groupId}/invitar`, { identificador }).then((r) => r.data)),
      );
      await queryClient.invalidateQueries({ queryKey: ["grupos"] });
      // The next useful step is almost always inviting: go straight there unless everyone is already in.
      // Invited people still have to accept, and anyone without an account needs the link.
      const invited = results.filter((r) => !r.alreadyMember).length;
      router.replace(`/(app)/grupos/agregar-personas?grupoId=${groupId}&nuevo=1${invited ? `&invitados=${invited}` : ""}`);
    } catch {
      setError(
        groupId
          ? "Tu grupo ya está creado, pero no pudimos agregar a todos. Reintenta: no se creará otro grupo."
          : "No pudimos crear el grupo. Revisa tu conexión; tus datos siguen aquí.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Nuevo grupo"
      back
      footer={
        <>
          {!!error && <ErrorBox message={error} />}
          <Button
            title={createdId ? "Reintentar invitaciones" : "Crear grupo"}
            onPress={submit}
            loading={busy}
            disabled={name.trim().length < 2}
          />
        </>
      }
    >
      <FormField
        label="¿Cómo se llama?"
        icon="people-outline"
        accessibilityLabel="Nombre del grupo"
        maxLength={100}
        value={name}
        onChangeText={setName}
        editable={!createdId && !busy}
        autoFocus
        placeholder="Ej. Depa Miraflores, Viaje a Cusco"
        onSubmitEditing={submit}
      />
      <View style={{ gap: 8 }}>
        <Label weight="bold" size={14}>Tipo</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {types.map((t) => {
            const selected = type === t.id;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="radio"
                accessibilityLabel={t.label}
                accessibilityState={{ checked: selected }}
                disabled={!!createdId || busy}
                onPress={() => setPicked(t.id)}
                style={{ width: 76, borderRadius: 16, borderWidth: 1.5, borderColor: selected ? palette.primary : palette.line, backgroundColor: selected ? palette.mint : "white", paddingVertical: 8, alignItems: "center", gap: 2 }}
              >
                <Image source={t.image} style={{ width: 52, height: 44 }} resizeMode="contain" />
                <Label size={12} weight="bold" color={selected ? "#007B60" : palette.ink}>{t.label}</Label>
              </Pressable>
            );
          })}
        </ScrollView>
        {!picked && !!guessGroupType(name) && (
          <Label size={12} color={palette.muted}>Lo elegimos por el nombre; puedes cambiarlo.</Label>
        )}
      </View>

      <View style={[design.row, { gap: 12, padding: 12, borderRadius: 16, backgroundColor: palette.lilac }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label weight="bold" size={14}>Yo también apruebo los pagos</Label>
          <Label size={12} color={palette.muted}>
            Cada integrante sube la captura de su Yape o Plin y tú (o quien recibe el dinero) la apruebas. Puedes cambiarlo después.
          </Label>
        </View>
        <Switch
          accessibilityLabel="Yo también apruebo los pagos del grupo"
          value={adminApproves}
          disabled={!!createdId || busy}
          onValueChange={setAdminApproves}
          trackColor={{ true: palette.primary }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: manual }}
          onPress={() => setManual((v) => !v)}
          style={[design.row, { minHeight: 44, gap: 8 }]}
        >
          <Ionicons name="person-add-outline" size={18} color={palette.purple} />
          <Label size={14} weight="bold" color={palette.purple} style={{ flex: 1 }}>
            {manual ? "Ocultar" : "¿Ya usan JUNTO? Invítalos por correo o celular"}
          </Label>
        </Pressable>
        {manual && (
          <>
            <View style={design.row}>
              <TextInput
                accessibilityLabel="Correo o celular de la persona"
                style={[design.input, { flex: 1 }]}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="ana@correo.com o 999888777"
                placeholderTextColor="#8B98AE"
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!busy}
                onSubmitEditing={addPerson}
              />
              <Pressable accessibilityRole="button" disabled={busy} onPress={addPerson} style={{ backgroundColor: palette.mint, borderRadius: 16, minHeight: 54, paddingHorizontal: 16, justifyContent: "center" }}>
                <Label color="#078B70" weight="bold" size={14}>Agregar</Label>
              </Pressable>
            </View>
            {people.map((p) => (
              <View key={p} style={[design.row, { backgroundColor: palette.lilac, borderRadius: 16, paddingHorizontal: 12, minHeight: 44 }]}>
                <Ionicons name="person-outline" color={palette.purple} size={18} />
                <Label size={13} style={{ flex: 1 }} numberOfLines={1}>{p}</Label>
                <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${p}`} disabled={busy} hitSlop={12} onPress={() => setPeople((items) => items.filter((v) => v !== p))}>
                  <Ionicons name="close" size={20} color={palette.muted} />
                </Pressable>
              </View>
            ))}
          </>
        )}
        <Label size={12} color={palette.muted}>
          Al crear el grupo te daremos un enlace para invitar a los demás por WhatsApp.
        </Label>
      </View>
    </Screen>
  );
}
