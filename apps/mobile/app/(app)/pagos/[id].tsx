import { errorMessage } from "../../../src/lib/errorMessage";
import React from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { Screen, Card, Label, Button, ErrorBox, Avatar, palette, design } from "../../../src/components/ui/Design";
import { IconBubble } from "../../../src/components/ui/Reference";
import { Comments } from "../../../src/components/Comments";
import { useComprobanteImagen, useGrupo, usePago, useResolverPago } from "../../../src/hooks/useGrupos";
import { useAuthStore } from "../../../src/store/auth.store";
import { memberLabels } from "../../../src/lib/people";
import { paymentHeadline } from "../../../src/lib/payment";
import { centavosASoles } from "../../../src/types";

const money = (value: number) => `S/ ${centavosASoles(value)}`;
const apps: Record<string, string> = { yape: "Yape", plin: "Plin", transferencia: "Transferencia", efectivo: "Efectivo" };
const tones = {
  waiting: { background: palette.yellow, border: "#F1DFA8", icon: "time-outline" as const, color: "#B07700" },
  ok: { background: palette.mint, border: "#BDEBD9", icon: "checkmark-circle" as const, color: "#007B60" },
  bad: { background: palette.blush, border: "#F6D8DD", icon: "close-circle" as const, color: palette.coral },
};

export default function PaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.usuario);
  const qc = useQueryClient();
  const focused = useIsFocused();
  const { data: pago, isLoading, isError, refetch, isRefetching } = usePago(id, focused);
  const { data: group } = useGrupo(pago?.grupoId || "");
  const canSee = !!pago?.permisos.verComprobante && !!pago.comprobante?.imagenDisponible;
  const image = useComprobanteImagen(id, canSee);
  const resolve = useResolverPago();
  const [zoom, setZoom] = React.useState(false);
  const [error, setError] = React.useState("");
  const { width, height } = useWindowDimensions();

  const people = group?.miembros.map((m) => ({ ...m.usuario, id: m.usuarioId })) ?? [];
  const labels = memberLabels(people, user?.id);
  const nombre = (personId: string) => {
    if (personId === user?.id) return "tú";
    const fromPayment = [pago?.pagador, pago?.receptor, pago?.resolutor].find((p) => p?.id === personId)?.nombre;
    return labels.get(personId) ?? (fromPayment || "Alguien").split(" ")[0];
  };
  const Nombre = (personId: string) => { const value = nombre(personId); return value.charAt(0).toUpperCase() + value.slice(1); };

  function decide(approve: boolean) {
    if (!pago) return;
    const asReceiver = pago.receptorId === user?.id;
    const receiver = Nombre(pago.receptorId);
    Alert.alert(
      approve ? (asReceiver ? "¿Ya tienes el dinero?" : "¿Apruebas este pago?") : asReceiver ? "¿No te llegó este pago?" : "¿Rechazas este pago?",
      approve
        ? asReceiver
          ? `Aprueba solo si ya ves ${money(pago.monto)} en tu Yape, Plin, cuenta o lo recibiste en efectivo. La deuda bajará por ese monto.`
          : `Apruébalo solo si el comprobante es claro y coincide. ${receiver} recibirá un aviso y podrá indicar si no le llegó.`
        : `${Nombre(pago.pagadorId)} verá que no se aprobó y la deuda seguirá igual. Pueden conversarlo en los comentarios.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: approve ? "Sí, aprobar" : asReceiver ? "No lo recibí" : "Rechazar",
          style: approve ? "default" : "destructive",
          onPress: async () => {
            try {
              setError("");
              await resolve.mutateAsync({ pagoId: pago.id, confirmar: approve });
              await refetch();
            } catch (err) {
              setError(errorMessage(err, "No pudimos guardar tu decisión. Revisa tu conexión y reintenta."));
              refetch();
            }
          },
        },
      ],
      { details: [{ label: "Monto", value: money(pago.monto) }, { label: "De", value: Nombre(pago.pagadorId) }, { label: "Para", value: receiver }] },
    );
  }

  function notReceived() {
    if (!pago) return;
    Alert.alert(
      "¿No te llegó este dinero?",
      `La deuda de ${Nombre(pago.pagadorId)} contigo volverá a subir ${money(pago.monto)}. Le avisaremos a ${Nombre(pago.pagadorId)} y a quien lo aprobó.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "No me llegó",
          style: "destructive",
          onPress: async () => {
            try {
              setError("");
              await resolve.mutateAsync({ pagoId: pago.id, confirmar: false });
              await refetch();
            } catch (err) {
              setError(errorMessage(err, "No pudimos guardar tu respuesta. Reintenta."));
            }
          },
        },
      ],
    );
  }

  const imageUri = image.data ? `data:${image.data.mime};base64,${image.data.imagen}` : null;
  // Real proportions of the voucher for the full-screen view.
  const [ratio, setRatio] = React.useState(2.2);
  React.useEffect(() => {
    if (imageUri) Image.getSize(imageUri, (w, h) => { if (w > 0 && h > 0) setRatio(h / w); }, () => undefined);
  }, [imageUri]);

  if (isLoading) return <Screen title="Pago" back><ActivityIndicator color={palette.primary} /></Screen>;
  if (isError || !pago)
    return (
      <Screen title="Pago" back>
        <ErrorBox message="No pudimos abrir este pago. Puede que ya no pertenezcas al grupo o que no haya conexión." />
        <Button title="Reintentar" onPress={() => refetch()} />
      </Screen>
    );

  const headline = paymentHeadline(pago, user?.id, Nombre);
  const tone = tones[headline.tone];
  const voucher = pago.comprobante;
  const amountMismatch = voucher?.montoLeido != null && voucher.montoLeido !== pago.monto;
  const approvers = pago.aprobadores.map((a) => `${Nombre(a.id)}${a.rol === "administrador" ? " (administración)" : " (quien recibe)"}`);

  // The decision stays on screen while the approver looks at the voucher.
  const footer = pago.permisos.aprobar ? (
    <>
      <Label size={13} weight="bold">{pago.receptorId === user?.id ? "¿Te llegó este dinero?" : "¿El comprobante coincide con lo que se debía?"}</Label>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button title={pago.receptorId === user?.id ? "Sí, lo recibí" : "Aprobar"} loading={resolve.isPending} onPress={() => decide(true)} /></View>
        <View style={{ flex: 1 }}><Button title={pago.receptorId === user?.id ? "No llegó" : "Rechazar"} secondary disabled={resolve.isPending} onPress={() => decide(false)} /></View>
      </View>
    </>
  ) : pago.permisos.marcarNoRecibido ? (
    <Button title="No me llegó este dinero" secondary loading={resolve.isPending} onPress={notReceived} />
  ) : undefined;

  return (
    <Screen title="Pago" subtitle={pago.grupo.nombre} back footer={footer} onRefresh={() => { refetch(); qc.invalidateQueries({ queryKey: ["comentarios"] }); }} refreshing={isRefetching}>
      <Card style={{ backgroundColor: tone.background, borderColor: tone.border, gap: 10 }}>
        <View style={design.row}>
          <IconBubble name={tone.icon} background="white" color={tone.color} size={44} />
          <View style={{ flex: 1 }}>
            <Label weight="extra" size={19}>{headline.title}</Label>
            <Label size={13}>{headline.body}</Label>
          </View>
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={[design.row, { justifyContent: "space-between" }]}>
          <View style={{ alignItems: "center", flex: 1, gap: 4 }}>
            <Avatar name={pago.pagador.nombre} photo={pago.pagador.fotoUrl} seed={pago.pagadorId} size={48} />
            <Label size={13} weight="bold" numberOfLines={1}>{Nombre(pago.pagadorId)}</Label>
            <Label size={11} color={palette.muted}>pagó</Label>
          </View>
          <View style={{ alignItems: "center", gap: 2 }}>
            <Label weight="extra" size={26}>{money(pago.monto)}</Label>
            <Ionicons name="arrow-forward" size={20} color={palette.muted} />
            <Label size={12} color={palette.muted}>{pago.metodo ? apps[pago.metodo] ?? pago.metodo : "—"}</Label>
          </View>
          <View style={{ alignItems: "center", flex: 1, gap: 4 }}>
            <Avatar name={pago.receptor.nombre} photo={pago.receptor.fotoUrl} seed={pago.receptorId} size={48} />
            <Label size={13} weight="bold" numberOfLines={1}>{Nombre(pago.receptorId)}</Label>
            <Label size={11} color={palette.muted}>recibe</Label>
          </View>
        </View>
        <Label size={12} color={palette.muted}>
          Registrado el {new Date(pago.fechaPago).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          {pago.fechaResolucion ? ` · resuelto el ${new Date(pago.fechaResolucion).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}` : ""}
        </Label>
        {!!pago.nota && <Label size={14}>“{pago.nota}”</Label>}
      </Card>

      <Card style={{ gap: 10 }}>
        <Label accessibilityRole="header" weight="extra" size={18}>Comprobante</Label>
        {!voucher ? (
          <Label size={13} color={palette.muted}>Sin comprobante adjunto{pago.metodo === "efectivo" ? " (pago en efectivo)" : ""}. Quien aprueba debe revisar su cuenta.</Label>
        ) : !pago.permisos.verComprobante ? (
          <Label size={13} color={palette.muted}>Tiene comprobante. Por privacidad solo lo ven quien pagó, quien recibe y quien aprueba.</Label>
        ) : !voucher.imagenDisponible ? (
          <Label size={13} color={palette.muted}>La imagen ya no está guardada (se borra 180 días después de resolver el pago). Quedan los datos leídos.</Label>
        ) : image.isLoading ? (
          <ActivityIndicator color={palette.primary} />
        ) : image.isError || !imageUri ? (
          <Button title="Reintentar cargar la imagen" secondary compact onPress={() => image.refetch()} />
        ) : (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel="Ver el comprobante completo" onPress={() => setZoom(true)}>
            <Image source={{ uri: imageUri }} accessibilityIgnoresInvertColors style={{ width: "100%", height: 320, borderRadius: 14, backgroundColor: "#F2F3F5" }} resizeMode="contain" />
            <Label size={12} weight="bold" color={palette.purple} style={{ textAlign: "center", marginTop: 4 }}>Toca para verla completa</Label>
          </Pressable>
        )}
        {voucher && pago.permisos.verComprobante && (
          <View style={{ gap: 4 }}>
            <Label size={12} weight="bold" color={palette.muted}>LEÍDO DEL COMPROBANTE (REVÍSALO EN LA IMAGEN)</Label>
            {[
              ["Monto", voucher.montoLeido != null ? money(voucher.montoLeido) : "No se pudo leer"],
              ["App", voucher.app ? apps[voucher.app] ?? voucher.app : "—"],
              ["N.º de operación", voucher.operacion || "—"],
              ["Para", voucher.destinatarioLeido || "—"],
              ["Fecha", voucher.fechaLeida ? new Date(`${voucher.fechaLeida}T12:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "—"],
              ...(voucher.codigoSeguridad ? [["Código de seguridad", voucher.codigoSeguridad]] : []),
            ].map(([label, value]) => (
              <View key={label} style={[design.row, { justifyContent: "space-between" }]}>
                <Label size={13} color={palette.muted}>{label}</Label>
                <Label size={13} weight="bold" selectable>{value}</Label>
              </View>
            ))}
            {amountMismatch && (
              <Label size={12} weight="bold" color="#8A5B05">El comprobante dice {money(voucher.montoLeido!)} y se registró {money(pago.monto)}.</Label>
            )}
            {voucher.codigoSeguridad && pago.receptorId === user?.id && pago.estado === "reportado" && (
              <Label size={12} color={palette.muted}>Para verificarlo: abre tu Yape, busca este movimiento y compara el código de seguridad.</Label>
            )}
          </View>
        )}
      </Card>

      {!!error && <ErrorBox message={error} />}
      {pago.estado === "reportado" && (
        <Label size={12} color={palette.muted}>Pueden aprobarlo: {approvers.join(" o ")}. Nunca quien pagó.</Label>
      )}

      <Comments pagoId={pago.id} hint={pago.estado === "reportado" ? "¿Falta algo? Pregunta aquí, por ejemplo «¿Me envías el número de operación?»." : undefined} />
      <Button title="Ver el grupo" secondary onPress={() => router.push(`/(app)/grupos/${pago.grupoId}`)} />

      <Modal visible={zoom && !!imageUri} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000000EE" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar comprobante" onPress={() => setZoom(false)} style={{ alignSelf: "flex-end", padding: 16, minHeight: 48 }}>
            <Ionicons name="close" size={30} color="white" />
          </Pressable>
          {/* Full width at its real proportions: a tall screenshot is read by scrolling (Android has no
              pinch zoom in a ScrollView); iOS can still zoom. */}
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: 24 }}>
            {imageUri && <Image source={{ uri: imageUri }} accessibilityLabel="Comprobante del pago" style={{ width, height: Math.max(width * ratio, height * 0.5) }} resizeMode="contain" />}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
