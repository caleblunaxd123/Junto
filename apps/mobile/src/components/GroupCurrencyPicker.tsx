import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { countries, currencies, currencyInfo, type CountryCode, type CurrencyCode } from "@junto/shared/currency";
import { Label, palette } from "./ui/Design";
import { Sheet } from "./ui/Sheet";

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
    <View style={{ backgroundColor: palette.mint, borderRadius: 20, padding: 14, gap: 10, borderWidth: 1, borderColor: "#A5EBD7" }}>
      <Label size={15} weight="bold">¿Dónde es el plan y en qué moneda?</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["country", "currency"] as const).map((field) => (
          <Pressable key={field} accessibilityRole="button" accessibilityLabel={field === "country" ? `País del plan: ${selectedCountry.name}` : `Moneda del grupo: ${info.name}, ${currency}`}
            disabled={disabled} onPress={() => setPicking(field)}
            style={{ flexGrow: 1, flexBasis: 140, minHeight: 54, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "white", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Label size={11} color={palette.muted}>{field === "country" ? "País del plan" : "Moneda del grupo"}</Label>
              <Label size={14} weight="bold">{field === "country" ? selectedCountry.name : `${info.symbol} · ${info.name} (${currency})`}</Label>
            </View>
            <Label color="#007B60">⌄</Label>
          </Pressable>
        ))}
      </View>
      <Label size={12} color="#007B60">{selectedCountry.currency ? `Sugerida para ${selectedCountry.name}: ${selectedCountry.currency}. ` : "Elige la moneda en que pagaron. "}Los saldos se llevarán en {currency}; si alguien paga en otra moneda, registrará el cambio acordado.</Label>
      <Sheet visible={!!picking} onClose={() => setPicking(null)} closeLabel="Cerrar sin cambiar" width={480}
        title={picking === "country" ? "País del plan" : "Moneda del grupo"}
        subtitle={picking === "country" ? "No necesitamos tu ubicación. Elegir el país actualizará la sugerencia; revisa la moneda antes de crear." : "Los gastos y saldos usan esta moneda. Los pagos en otra moneda conservan su importe original y el equivalente acordado."}>
              {options.map((item) => {
                const checked = item.code === (picking === "country" ? country : currency);
                return <Pressable key={item.code} accessibilityRole="radio" aria-checked={checked} accessibilityLabel={`${item.name} (${item.code})`}
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
      </Sheet>
    </View>
  );
}
