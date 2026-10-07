import React, { useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { router } from "expo-router";
import { useCrearGrupo } from "../../../src/hooks/useGrupos";
import { useAuthStore } from "../../../src/store/auth.store";
import { api } from "../../../src/lib/api";
import { queryClient } from "../../../src/lib/queryClient";
import {
  Screen,
  Card,
  Label,
  Button,
  ErrorBox,
  Avatar,
  palette,
  design,
} from "../../../src/components/ui/Design";
import {
  ReferenceHero,
  IconBubble,
  SectionTitle,
  FormField,
} from "../../../src/components/ui/Reference";
import { art } from "../../../src/components/ui/Artwork";
const types = [
  { id: "viaje", label: "Viaje", image: art.travel },
  { id: "pareja", label: "Pareja", image: art.couple },
  { id: "roomies", label: "Departamento", image: art.home },
  { id: "amigos", label: "Amigos", image: art.group },
  { id: "otro", label: "Otro", image: art.other },
];
export default function CreateGroup() {
  const user = useAuthStore((s) => s.usuario);
  const [name, setName] = useState("");
  const [type, setType] = useState("viaje");
  const [error, setError] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [createdId, setCreatedId] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (name.trim().length < 2 || name.trim().length > 100) { setError("El nombre del grupo debe tener entre 2 y 100 caracteres."); return; }
    if (identifier.trim()) {
      setError("Pulsa Agregar para incluir el correo o celular que escribiste, o borra ese campo para continuar sin esa persona.");
      return;
    }
    let groupId = createdId;
    try {
      setBusy(true);
      setError("");
      if (!groupId) {
        const group = await create.mutateAsync({
          nombre: name.trim(),
          tipo: type,
        });
        groupId = group.id;
        setCreatedId(groupId);
      }
      const results = await Promise.all(
        people.map((identificador) =>
          api
            .post(`/grupos/${groupId}/invitar`, { identificador })
            .then((r) => r.data),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: ["grupos"] });
      if (results.some((r) => !r.found)) {
        Alert.alert(
          "Tu grupo está creado",
          "Algunas personas aún no tienen cuenta. Comparte el enlace para que se registren y se unan.",
        );
        router.replace(`/(app)/grupos/agregar-personas?grupoId=${groupId}`);
      } else router.replace(`/(app)/grupos/${groupId}`);
    } catch {
      setError(
        groupId
          ? "Tu grupo ya está creado. No completamos todas las invitaciones; reintenta sin crear otro grupo."
          : "No pudimos crear el grupo. Tus datos siguen aquí; reintenta.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Crear grupo"
      subtitle="Organiza tus gastos y vive mejores momentos, juntos."
      back
    >
      <ReferenceHero
        title="Un grupo para cada plan"
        subtitle="Comparte gastos con las personas que hacen tus momentos especiales."
        image={art.group}
        height={155}
      />
      <SectionTitle title="Tipo de grupo" />
      <Label size={12} color={palette.muted}>
        Elige el tipo que mejor se ajuste a tu plan.
      </Label>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {types.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityState={{ selected: type === t.id }}
            disabled={!!createdId || busy}
            onPress={() => setType(t.id)}
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: type === t.id ? palette.primary : palette.line,
              backgroundColor: type === t.id ? palette.mint : "white",
              paddingVertical: 8,
              alignItems: "center",
            }}
          >
            <Image
              source={t.image}
              style={{ width: "100%", height: 57 }}
              resizeMode="contain"
            />
            <Label size={t.id === "roomies" ? 8 : 10} weight="bold">
              {t.label}
            </Label>
            {type === t.id && (
              <View style={{ position: "absolute", right: 3, top: 3 }}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={palette.primary}
                />
              </View>
            )}
          </Pressable>
        ))}
      </View>
      <FormField
        label="Nombre del grupo"
        icon="people-outline"
        accessibilityLabel="Nombre del grupo"
        maxLength={100}
        value={name}
        onChangeText={setName}
        editable={!createdId && !busy}
        placeholder="Ej. Escapada a Cusco"
      />
      <SectionTitle title="Invitar personas" />
      <Label size={12} color={palette.muted}>
        Por correo, celular o enlace. No necesitas acceder a tus contactos.
      </Label>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(
              "Compartir enlace",
              "El enlace estará listo cuando crees el grupo. Podrás copiarlo o compartirlo desde “Invitar personas”.",
            )
          }
          style={{ flex: 1 }}
        >
          <Card
            style={{
              backgroundColor: palette.mint,
              padding: 14,
              minHeight: 135,
            }}
          >
            <IconBubble name="link" size={34} />
            <Label weight="extra" size={14}>
              Compartir enlace
            </Label>
            <Label size={11} color={palette.muted}>
              Invita para que se unan al grupo.
            </Label>
          </Card>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setManual(true)}
          style={{ flex: 1 }}
        >
          <Card
            style={{
              backgroundColor: palette.lilac,
              padding: 14,
              minHeight: 135,
            }}
          >
            <IconBubble
              name="person-add-outline"
              size={34}
              color={palette.purple}
              background="#E3D6FF"
            />
            <Label weight="extra" size={14}>
              Agregar personas manualmente
            </Label>
            <Label size={11} color={palette.muted}>
              Añade por correo o celular.
            </Label>
          </Card>
        </Pressable>
      </View>
      <Card
        style={{
          padding: 12,
          backgroundColor: "#EEF6FF",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="information-circle-outline" size={24} color="#398BE5" />
        <Label size={12} color={palette.muted} style={{ flex: 1 }}>
          Quienes ya tengan cuenta se agregarán al crear el grupo. Para los
          demás, comparte el enlace de invitación.
        </Label>
      </Card>
      <SectionTitle
        title={`Tú + ${people.length} ${people.length === 1 ? "invitación" : "invitaciones"}`}
        action="Agregar más"
        onPress={() => setManual(true)}
      />
      {!people.length && <Label size={12} color={palette.muted}>Puedes crear el grupo ahora e invitar a los demás después.</Label>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        <View
          style={[
            design.row,
            { backgroundColor: "white", borderRadius: 30, padding: 8 },
          ]}
        >
          <Avatar name={user?.nombre || "Tú"} size={36} />
          <Label size={12} weight="bold">
            {user?.nombre.split(" ")[0]} (Tú)
          </Label>
        </View>
        {people.map((p) => (
          <View
            key={p}
            style={[
              design.row,
              { backgroundColor: palette.lilac, borderRadius: 30, padding: 8 },
            ]}
          >
            <Ionicons name="person-outline" color={palette.purple} size={22} />
            <Label size={11}>{p}</Label>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${p}`}
              disabled={busy}
              hitSlop={12}
              onPress={() => setPeople((items) => items.filter((v) => v !== p))}
            >
              <Ionicons name="close" size={20} color={palette.muted} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      {manual && (
        <View style={design.row}>
          <TextInput
            accessibilityLabel="Correo o celular de la persona"
            style={[design.input, { flex: 1 }]}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Correo o celular"
            autoCapitalize="none"
            editable={!busy}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={addPerson}
            style={{
              backgroundColor: palette.mint,
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Label color="#078B70" weight="bold" size={12}>
              Agregar
            </Label>
          </Pressable>
        </View>
      )}
      {!!error && <ErrorBox message={error} />}
      <Button
        title={createdId ? "Completar invitaciones →" : "Crear grupo →"}
        onPress={submit}
        loading={busy}
        disabled={name.trim().length < 2}
      />
      {!!createdId && (
        <Button
          title="Abrir mi grupo creado"
          secondary
          disabled={busy}
          onPress={() => router.replace(`/(app)/grupos/${createdId}`)}
        />
      )}
    </Screen>
  );
}
