import React from "react";
import { Card, Label, palette } from "./ui/Design";
import { type PartesAlUnirse } from "../types";

/** Joining may take a seat in more than one bill: show the complete cost before acceptance. */
import { formatMoney, type CurrencyCode } from "@junto/shared/currency";
import { MoneyText } from "./ui/MoneyText";
export function JoinParts({ parts, division, moneda }: { parts: PartesAlUnirse; division: boolean; moneda?: CurrencyCode }) {
  const money = (value: number) => formatMoney(value, moneda);
  return <Card style={{ backgroundColor: palette.mint, gap: 6 }}>
    <Label size={13} weight="bold" color="#007B60">{division ? "TU APORTE AL UNIRTE" : "TU PARTE AL UNIRTE"}</Label>
    <MoneyText size={28} weight="extra">{money(parts.total)}</MoneyText>
    {parts.cuentas.map((bill, index) => <Label key={index} size={13}>{bill.descripcion}: {money(bill.parte)} {division ? "para" : "a devolver a"} {bill.pagadorNombre}.</Label>)}
    <Label size={12} color={palette.muted}>{parts.cuentas.length ? "JUNTO no cobra al aceptar. Revisa tu parte al entrar; pagarás por fuera y quien recibe lo confirmará." : "No tomarás una parte automáticamente. Quien organiza puede incluirte después."}</Label>
  </Card>;
}
