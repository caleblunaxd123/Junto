import React from "react";
import { ActivityIndicator, BackHandler, Image, Pressable, Switch, TextInput, View } from "react-native";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useEditarGrupo, useGrupo } from "../../../src/hooks/useGrupos";
import { Screen, Card, Label, Button, ErrorBox, design, palette } from "../../../src/components/ui/Design";
import { FormField, ReferenceHero } from "../../../src/components/ui/Reference";
import { art } from "../../../src/components/ui/Artwork";
import type { AprobacionPagos, GrupoTipo } from "../../../src/types";

const types: { id: GrupoTipo; label: string; image: typeof art.travel }[] = [
  { id: "viaje", label: "Viaje", image: art.travel },
  { id: "pareja", label: "Pareja", image: art.couple },
  { id: "roomies", label: "Departamento", image: art.home },
  { id: "amigos", label: "Amigos", image: art.group },
  { id: "trabajo", label: "Trabajo", image: art.other },
  { id: "deporte", label: "Deporte", image: art.other },
  { id: "otro", label: "Otro", image: art.other },
];

export default function EditGroup() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();
  const query = useGrupo(grupoId);
  const focused = useIsFocused();
  const update = useEditarGrupo(grupoId);
  const [draft, setDraft] = React.useState<{ id: string; nombre: string; tipo: GrupoTipo; descripcion: string; aprobacionPagos: AprobacionPagos }>();
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (focused && query.data && draft?.id !== grupoId) {
      setDraft({ id: grupoId, nombre: query.data.nombre, tipo: query.data.tipo, descripcion: query.data.descripcion || "", aprobacionPagos: query.data.aprobacionPagos ?? "receptor" });
      setError("");
    }
  }, [focused, query.data, grupoId, draft?.id]);
  React.useEffect(() => { if (!focused) setDraft(undefined); }, [focused]);
  const group = query.data;
  const dirty = !!group && !!draft && (draft.nombre.trim() !== group.nombre || draft.tipo !== group.tipo || draft.descripcion.trim() !== (group.descripcion || "") || draft.aprobacionPagos !== (group.aprobacionPagos ?? "receptor"));
  const leave = React.useCallback(() => {
    if (update.isPending) return;
    function goBack() {
      setDraft(undefined);
      if (router.canGoBack()) router.back();
      else router.dismissTo(`/(app)/grupos/${grupoId}`);
    }
    if (!dirty) { goBack(); return; }
    Alert.alert("¿Salir sin guardar?", "El grupo conservará sus datos anteriores. Tus gastos y pagos no cambiarán.", [
      { text: "Seguir editando", style: "cancel" },
      { text: "Descartar cambios", style: "destructive", onPress: goBack },
    ]);
  }, [dirty, update.isPending, grupoId]);
  useFocusEffect(React.useCallback(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { leave(); return true; });
    return () => listener.remove();
  }, [leave]));
  async function save() {
    if (!draft || !dirty || update.isPending || draft.nombre.trim().length < 2) return;
    setError("");
    try {
      await update.mutateAsync({ nombre: draft.nombre.trim(), tipo: draft.tipo, descripcion: draft.descripcion.trim(), aprobacionPagos: draft.aprobacionPagos });
      router.dismissTo(`/(app)/grupos/${grupoId}`);
    } catch (err) {
      const response = (err as { response?: { data?: { error?: string } } }).response;
      setError(response?.data?.error || "No pudimos guardar los cambios. Tus datos siguen aquí; revisa tu conexión y reintenta.");
    }
  }
  return (
    <Screen title="Tu grupo, a tu manera" subtitle="Corrige los detalles sin cambiar las cuentas." back onBack={leave} resetOnFocus>
      {query.isLoading ? <ActivityIndicator color={palette.primary} /> : !group ? <>
        <ErrorBox message="No pudimos abrir el grupo para editarlo." />
        <Button title="Reintentar" onPress={() => query.refetch()} />
      </> : group.rolUsuario !== "admin" ? <Card>
        <Label weight="bold">Solo los administradores pueden editar el grupo</Label>
        <Label>Puedes seguir revisando sus gastos y tus cuentas.</Label>
        <Button title="Volver al grupo" secondary onPress={() => router.dismissTo(`/(app)/grupos/${grupoId}`)} />
      </Card> : draft?.id === grupoId && <>
        <ReferenceHero title="El mismo plan, más claro" subtitle="Un nombre fácil de reconocer ayuda a todo el grupo." image={art.group} height={150} />
        <FormField label="Nombre del grupo" icon="people-outline" accessibilityLabel="Nombre del grupo" value={draft.nombre} maxLength={100} editable={!update.isPending} onChangeText={(nombre) => setDraft({ ...draft, nombre })} placeholder="Ej. Gastos de nuestro depa" />
        <Label weight="extra" size={20}>Tipo de grupo</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {types.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: draft.tipo === item.id }} disabled={update.isPending} onPress={() => setDraft({ ...draft, tipo: item.id })} style={{ width: "31%", minHeight: 100, padding: 8, alignItems: "center", borderRadius: 18, borderWidth: 1.5, borderColor: draft.tipo === item.id ? palette.primary : palette.line, backgroundColor: draft.tipo === item.id ? palette.mint : "white" }}>
            <Image source={item.image} style={{ width: "100%", height: 62 }} resizeMode="contain" />
            <Label size={11} weight="bold" style={{ textAlign: "center" }}>{item.label}</Label>
          </Pressable>)}
        </View>
        <Label weight="bold">Descripción (opcional)</Label>
        <TextInput accessibilityLabel="Descripción del grupo" value={draft.descripcion} onChangeText={(descripcion) => setDraft({ ...draft, descripcion })} editable={!update.isPending} maxLength={500} multiline placeholder="Ej. Alquiler, compras y servicios del mes" style={[design.input, { minHeight: 90, textAlignVertical: "top" }]} />
        <Label size={12} color={palette.muted}>{draft.descripcion.length}/500 caracteres</Label>
        <Label weight="extra" size={20}>¿Quién aprueba los pagos?</Label>
        <Card style={{ gap: 10 }}>
          <View style={[design.row, { gap: 12 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Label weight="bold">La administración también aprueba</Label>
              <Label size={12} color={palette.muted}>
                {draft.aprobacionPagos === "administrador"
                  ? "Quien recibe el dinero o un administrador aprueba cada pago con su comprobante. Nadie aprueba su propio pago."
                  : "Solo quien recibe el dinero aprueba cada pago."}
              </Label>
            </View>
            <Switch
              accessibilityLabel="La administración del grupo también aprueba los pagos"
              value={draft.aprobacionPagos === "administrador"}
              disabled={update.isPending}
              onValueChange={(on) => setDraft({ ...draft, aprobacionPagos: on ? "administrador" : "receptor" })}
              trackColor={{ true: palette.primary }}
            />
          </View>
          <Label size={12} color={palette.muted}>
            Yape y Plin no permiten que una app verifique transferencias entre personas: por eso alguien revisa la captura. Si un administrador aprueba un pago que no llegó, quien debía recibirlo puede marcar «No me llegó» y la deuda vuelve.
          </Label>
        </Card>
        <Card style={{ backgroundColor: palette.mint }}>
          <Label weight="bold">Tus cuentas quedan intactas</Label>
          <Label size={13}>Cambiar estos datos no cambia integrantes, invitaciones, gastos, pagos ya aprobados ni la parte de cada persona.</Label>
        </Card>
        {!!error && <ErrorBox message={error} />}
        <Button title="Guardar cambios" loading={update.isPending} disabled={!dirty || draft.nombre.trim().length < 2} onPress={save} />
        {!dirty && <Label size={12} color={palette.muted}>Modifica un detalle para guardar cambios.</Label>}
      </>}
    </Screen>
  );
}
