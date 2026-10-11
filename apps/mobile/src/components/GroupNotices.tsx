import React from "react";
import { formatMoney, type CurrencyCode } from "@junto/shared/currency";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errorMessage";
import { Button, Card, ErrorBox, Label, palette } from "./ui/Design";

type Notice = { id: string; tipo?: string; leido: boolean; fecha: string; parte: number | null; grupo: { id: string; nombre: string; moneda?: CurrencyCode }; integrante: { nombre: string }; pago?: { id: string; monto: number; estado: string; pagador: { nombre: string }; receptor: { nombre: string } } | null };
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
/** "Ana", "Ana y Luis", "Ana, Luis y Marta". */
const names = (list: string[]) => (list.length < 2 ? list.join("") : `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`);

/** Who joined your groups, one card per group however many people joined. */
export function GroupNotices() {
  const focused = useIsFocused();
  const query = useQuery<Notice[]>({ queryKey: ["notificaciones"], queryFn: () => api.get("/notificaciones").then((r) => r.data), refetchInterval: focused ? 15_000 : false, refetchOnMount: "always" });
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const unread = query.data?.filter((n) => !n.leido) ?? [];
  const joins = unread.filter((n) => !n.pago && (!n.tipo || n.tipo === "integrante_unido"));
  const payments = unread.filter((n) => !!n.pago);
  const groups = [...new Map(joins.map((n) => [n.grupo.id, n.grupo])).values()].map((grupo) => ({ grupo, notices: joins.filter((n) => n.grupo.id === grupo.id) }));
  async function markRead(grupoId: string, notices: Notice[]) {
    if (busy) return;
    setBusy(grupoId); setError("");
    try {
      await Promise.all(notices.map((n) => api.post(`/notificaciones/${n.id}/leida`)));
      await query.refetch();
    } catch (err) { setError(errorMessage(err, "No pudimos marcar el aviso como leído. Reintenta.")); }
    finally { setBusy(""); }
  }
  if (query.isError) return <ErrorBox message="No pudimos actualizar los avisos de tu grupo. Revisa tu conexión o actualiza Inicio." />;
  if (!groups.length && !payments.length) return null;
  return <View style={{ gap: 8 }}>
    {!!error && <ErrorBox message={error} />}
    {payments.map((notice) => {
      const payment = notice.pago!;
      const pending = payment.estado === "reportado";
      const confirmed = payment.estado === "exitoso";
      return <Card key={notice.id} style={{ backgroundColor: pending ? palette.yellow : confirmed ? palette.mint : palette.blush, gap: 8, padding: 14 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Ionicons name={pending ? "time-outline" : confirmed ? "checkmark-circle-outline" : "alert-circle-outline"} size={22} color={pending ? "#8A5A00" : confirmed ? palette.primary : palette.coral} />
          <View style={{ flex: 1, gap: 4 }}>
            <Label weight="bold">{pending ? "Pago por confirmar" : confirmed ? "Pago confirmado" : "Pago no confirmado"}</Label>
            <Label size={13}>{firstName(payment.pagador.nombre)} → {firstName(payment.receptor.nombre)} · {formatMoney(payment.monto, notice.grupo.moneda)}</Label>
            <Label size={12} color={palette.muted}>{notice.grupo.nombre}. {pending ? "La deuda sigue pendiente hasta confirmar que el dinero llegó." : confirmed ? "Este importe ya cuenta como recibido." : "Este importe no reduce la deuda. Revisen el pago antes de reportarlo de nuevo."}</Label>
          </View>
        </View>
        <Button compact title={pending ? "Revisar pago" : "Ver resultado"} onPress={() => { void markRead(notice.id, [notice]); router.push(`/(app)/pagos/${payment.id}`); }} />
      </Card>;
    })}
    {groups.map(({ grupo, notices }) => {
      const people = notices.map((n) => firstName(n.integrante.nombre));
      const parts = notices.filter((n) => n.parte);
      return <Card key={grupo.id} style={{ backgroundColor: palette.mint, gap: 8, padding: 14 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Ionicons name="person-add-outline" size={22} color="#007B60" />
          <View style={{ flex: 1 }}>
            <Label weight="bold">{names(people)} {people.length === 1 ? "se unió" : "se unieron"} a «{grupo.nombre}»</Label>
            <Label size={12} color={palette.muted}>{parts.length
              ? "Revisa en las cuentas cuánto corresponde a cada integrante. Te avisaremos cuando reporte su pago."
              : "Ya puede revisar sus cuentas y reportar pagos desde la web o la app. Unirse no cambia el reparto anterior."}</Label>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button compact title="Abrir chat" onPress={() => { void markRead(grupo.id, notices); router.push(`/(app)/grupos/${grupo.id}`); }} /></View>
          <View style={{ flex: 1 }}><Button compact secondary title="Entendido" loading={busy === grupo.id} disabled={!!busy} onPress={() => { void markRead(grupo.id, notices); }} /></View>
        </View>
      </Card>;
    })}
  </View>;
}
