import React from "react";
import { Pressable, View } from "react-native";
import { currencies, convertPayment, formatMoney, type CurrencyCode, type PaymentConversion } from "@junto/shared/currency";
import { parseMoney } from "../lib/expensePreview";
import { Button, Card, Label, palette } from "./ui/Design";
import { FormField } from "./ui/Reference";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { validDate } from "./PaymentDate";
import { MoneyText } from "./ui/MoneyText";

export type ExchangeDraft = { monedaOrigen: CurrencyCode; amount: string; rate: string; cotizacionId?: string };
type Quote = { id: string; origen: CurrencyCode; destino: CurrencyCode; tasa: string; fecha: string; fuente: string; consultada: string };
export function resolveExchange(draft: ExchangeDraft | null, target: CurrencyCode): { conversion: (PaymentConversion & { monto: number }) | null; error: string } {
  if (!draft) return { conversion: null, error: "" };
  const amount = parseMoney(draft.amount);
  if (!amount) return { conversion: null, error: "Escribe cuánto pagaste en la otra moneda, con hasta 2 decimales." };
  try { return { conversion: { ...convertPayment({ monedaOrigen: draft.monedaOrigen, montoOrigen: amount, tipoCambio: draft.rate }, target), cotizacionId: draft.cotizacionId }, error: "" }; }
  catch (err) { return { conversion: null, error: err instanceof Error ? err.message : "Revisa el tipo de cambio." }; }
}

/** A daily reference is optional; the applied rate is explicitly agreed, never an executed transfer. */
export function PaymentExchange({ value, onChange, target, disabled, grupoId, fecha, received }: { value: ExchangeDraft | null; onChange: (value: ExchangeDraft | null) => void; target: CurrencyCode; disabled?: boolean; grupoId?: string; fecha?: string; received?: boolean }) {
  const result = resolveExchange(value, target);
  const quote = useQuery<Quote>({ queryKey: ["cambio", grupoId, value?.monedaOrigen, target, fecha], enabled: !!value && !!grupoId && !!fecha && validDate(fecha) && value.monedaOrigen !== target,
    queryFn: () => api.get("/pagos/tipo-cambio", { params: { grupoId, origen: value!.monedaOrigen, fecha }, timeout: 10000 }).then((r) => r.data), retry: false, staleTime: 3600000 });
  return <View style={{ gap: 10 }}>
    <Button compact secondary title={value ? (received ? "Volver a la moneda del grupo" : "Volver a pagar en la moneda del grupo") : received ? "¿Te pagó en otra moneda?" : "¿Pagaste en otra moneda?"} disabled={disabled}
      onPress={() => onChange(value ? null : { monedaOrigen: target === "USD" ? "PEN" : "USD", amount: "", rate: "" })} />
    {value && <Card style={{ backgroundColor: palette.lilac, gap: 12 }}>
      <Label weight="bold">Tipo de cambio acordado</Label>
      <Label size={13}>Elige la moneda que pagaste. La referencia del mercado es orientativa: puedes usarla o escribir el cambio que acordaron. Quien recibe revisará el equivalente en {target}.</Label>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {currencies.filter((currency) => currency.code !== target).map((currency) => <Pressable key={currency.code} accessibilityRole="radio" aria-checked={currency.code === value.monedaOrigen} aria-disabled={disabled} accessibilityLabel={`Pago en ${currency.code}`} disabled={disabled}
          onPress={() => onChange({ ...value, monedaOrigen: currency.code, rate: "", cotizacionId: undefined })}
          style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 14, justifyContent: "center", borderWidth: 1.5, borderColor: currency.code === value.monedaOrigen ? palette.purple : palette.line, backgroundColor: "white" }}>
          <Label size={13} weight="bold">{currency.code}</Label>
        </Pressable>)}
      </View>
      <FormField label={`Monto pagado en ${value.monedaOrigen}`} accessibilityLabel={`Monto pagado en ${value.monedaOrigen}`} icon="cash-outline" keyboardType="decimal-pad" value={value.amount}
        onChangeText={(amount) => onChange({ ...value, amount })} editable={!disabled} maxLength={13} placeholder="0.00" />
      {quote.isFetching && <Label size={12} color={palette.muted}>Consultando referencia para la fecha del pago…</Label>}
      {quote.isError && <View style={{ gap: 6 }}><Label size={12} color={palette.muted}>La referencia no está disponible. Puedes escribir el cambio acordado; no usaremos una tasa inventada.</Label><Button compact secondary title="Reintentar consulta" disabled={disabled} onPress={() => { void quote.refetch(); }} /></View>}
      {!!quote.data && <View style={{ gap: 6, padding: 12, borderRadius: 14, backgroundColor: "white" }}>
        <Label size={13} weight="bold">Referencia: 1 {quote.data.origen} = {quote.data.tasa} {quote.data.destino}</Label>
        <Label size={11} color={palette.muted}>{quote.data.fuente} · Publicada: {quote.data.fecha.slice(0, 10)}{quote.data.fecha.slice(0, 10) !== fecha ? " (última disponible, no es del mismo día)" : ""}. No incluye comisiones ni garantiza el cambio de tu banco.</Label>
        <Button compact secondary title="Usar esta referencia" disabled={disabled} onPress={() => onChange({ ...value, rate: quote.data!.tasa, cotizacionId: quote.data!.id })} />
        {!!value.cotizacionId && value.rate !== quote.data.tasa && <Label size={12} color={palette.purple}>Aplicarás el cambio que ingresaste, no la referencia del mercado.</Label>}
      </View>}
      <FormField label={`1 ${value.monedaOrigen} equivale a cuántos ${target}`} accessibilityLabel={`Tipo de cambio de ${value.monedaOrigen} a ${target}`} icon="swap-horizontal-outline" keyboardType="decimal-pad" value={value.rate}
        onChangeText={(rate) => onChange({ ...value, rate })} editable={!disabled} maxLength={13} placeholder="Tasa acordada, hasta 6 decimales" />
      {result.conversion ? <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
        <Label size={12} color="#6543C4">Equivalente que cubre de la deuda</Label>
        <MoneyText size={25} weight="extra">{formatMoney(result.conversion.monto, target)}</MoneyText>
        <Label size={12}>{formatMoney(result.conversion.montoOrigen, result.conversion.monedaOrigen)} × {result.conversion.tipoCambio}. Redondeado a 2 decimales.</Label>
      </View> : <Label size={12} color={palette.coral} accessibilityLiveRegion="polite">{result.error}</Label>}
      <Label size={12} color={palette.muted}>Acuerden el equivalente recibido, incluidas las comisiones si las hubo. {received ? "Al guardar confirmas que el dinero llegó y se descuenta de la deuda." : "La deuda no cambia hasta que quien recibe confirme el pago."} JUNTO no cambia ni transfiere dinero.</Label>
    </Card>}
  </View>;
}
