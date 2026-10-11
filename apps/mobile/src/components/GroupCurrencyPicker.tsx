import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { countries, currencies, currencyInfo, type CountryCode, type CurrencyCode } from "@junto/shared/currency";
import { Button, Label, palette } from "./ui/Design";

/** Destination is explicit; the suggestion never overrides a chosen currency silently. */
export function GroupCurrencyPicker({ country, currency, onChange, disabled }: {
  country: CountryCode; currency: CurrencyCode;
  onChange: (country: CountryCode, currency: CurrencyCode) => void; disabled?: boolean;
}) {
  const [picking, setPicking] = useState<"country" | "currency" | null>(null);
  const selectedCountry = countries.find((item) => item.code === country)!;
  const info = currencyInfo(currency);
  const options = picking === "country" ? countries : currencies;
  return (
    <View style={{ backgroundColor: palette.mint, borderRadius: 20, padding: 16, gap: 12, borderWidth: 1, borderColor: "#A5EBD7" }}>
      <Label size={17} weight="bold">¿Dónde es el plan?</Label>
      <Label size={13} color={palette.muted}>El país sugiere una moneda. Puedes usar dólares o euros aunque viajes a otro país.</Label>
      <View style={{ gap: 10 }}>
        {(["country", "currency"] as const).map((field) => (
          <Pressable key={field} accessibilityRole="button" accessibilityLabel={field === "country" ? `País del plan: ${selectedCountry.name}` : `Moneda del grupo: ${info.name}, ${currency}`}
            disabled={disabled} onPress={() => setPicking(field)}
            style={{ minHeight: 62, borderRadius: 14, padding: 12, backgroundColor: "white", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Label size={12} color={palette.muted}>{field === "country" ? "País del plan" : "Moneda de todos los gastos"}</Label>
              <Label size={15} weight="bold">{field === "country" ? selectedCountry.name : `${info.symbol} · ${info.name} (${currency})`}</Label>
            </View>
            <Label color="#007B60">⌄</Label>
          </Pressable>
        ))}
      </View>
      <Label size={12} color="#007B60">{selectedCountry.currency ? `Sugerida para ${selectedCountry.name}: ${selectedCountry.currency}. ` : "Elige la moneda en que pagaron. "}Los saldos se llevarán en {currency}; no se podrá cambiar después. Si alguien paga en otra moneda, registrará el cambio acordado.</Label>
      <Modal visible={!!picking} transparent animationType={Platform.OS === "web" ? "none" : "fade"} onRequestClose={() => setPicking(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(8,38,68,0.45)", justifyContent: "center", padding: 20 }}>
          <View style={{ width: "100%", maxWidth: 480, maxHeight: "85%", alignSelf: "center", backgroundColor: "#FFFCF7", borderRadius: 24, padding: 20, gap: 16 }}>
            <Label size={23} weight="bold">{picking === "country" ? "País del plan" : "Moneda del grupo"}</Label>
            <Label size={13} color={palette.muted}>{picking === "country" ? "No necesitamos tu ubicación. Elegir el país actualizará la sugerencia; revisa la moneda antes de crear." : "Los gastos y saldos usan esta moneda. Los pagos en otra moneda conservan su importe original y el equivalente acordado."}</Label>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {options.map((item) => {
                const checked = item.code === (picking === "country" ? country : currency);
                return <Pressable key={item.code} accessibilityRole="radio" accessibilityState={{ checked }} accessibilityLabel={`${item.name} (${item.code})`}
                  onPress={() => {
                    if (picking === "country") {
                      const selected = countries.find((option) => option.code === item.code)!;
                      onChange(selected.code, selected.currency ?? currency);
                    } else onChange(country, item.code as CurrencyCode);
                    setPicking(null);
                  }}
                  style={{ minHeight: 52, padding: 14, borderRadius: 14, backgroundColor: checked ? palette.mint : "white", borderWidth: 1.5, borderColor: checked ? palette.primary : palette.line, flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Label size={15} weight={checked ? "bold" : "regular"}>{item.name}{picking === "currency" ? ` · ${item.code}` : ""}</Label>
                  {checked && <Label color="#007B60">✓</Label>}
                </Pressable>;
              })}
            </ScrollView>
            <Button title="Cerrar sin cambiar" secondary onPress={() => setPicking(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
