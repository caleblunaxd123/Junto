import React from "react";
import { Pressable, View } from "react-native";
import { Card, Label, Button, palette } from "./ui/Design";
import { FormField } from "./ui/Reference";
import { parseMoney } from "../lib/expensePreview";
export interface ProductDraft { id: string; nombre: string; importe: string; personas: string[]; }
export const newProduct = (): ProductDraft => ({ id: `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`, nombre: "", importe: "", personas: [] });
export function ReceiptProducts({ items, people, total, onChange, disabled }: { items: ProductDraft[]; people: { id: string; nombre: string; invitado?: boolean }[]; total: number | null; onChange: (items: ProductDraft[]) => void; disabled?: boolean }) {
  const assigned = items.reduce((sum, p) => sum + (parseMoney(p.importe) || 0), 0);
  const patch = (id: string, fields: Partial<ProductDraft>) => onChange(items.map((p) => p.id === id ? { ...p, ...fields } : p));
  return <>
    <Card style={{ backgroundColor: palette.lilac, gap: 6 }}>
      <Label weight="bold">¿Quién consumió cada producto?</Label>
      <Label size={13}>Usa el importe total de la línea, no el precio unitario. Puedes elegir varias personas: comparten ese producto por partes iguales.</Label>
      <Label size={13} weight="bold">Productos: S/ {(assigned / 100).toFixed(2)} · Boleta: {total === null ? "sin total" : `S/ ${(total / 100).toFixed(2)}`}</Label>
      {total !== null && <Label size={12} color={assigned === total ? palette.primary : palette.coral}>{assigned === total ? "✓ Los importes coinciden. Revisa también los nombres y las personas." : `${assigned < total ? "Falta asignar" : "Asignaste de más"}: S/ ${(Math.abs(total - assigned) / 100).toFixed(2)}`}</Label>}
      <Label size={11} color={palette.muted}>La lectura puede omitir productos. Corrige o añade líneas. Un cargo incluido en la boleta se añade aquí; los extras del final son solo los NO incluidos.</Label>
    </Card>
    {items.map((p, i) => <Card key={p.id} style={{ padding: 14, gap: 8 }}>
      <FormField label={`Producto ${i + 1}`} accessibilityLabel={`Nombre del producto ${i + 1}`} value={p.nombre} editable={!disabled} maxLength={100} placeholder="Ej. Pizza para compartir" onChangeText={(nombre) => patch(p.id, { nombre })} />
      <FormField label={`Importe de la línea ${i + 1} (S/)`} accessibilityLabel={`Importe del producto ${i + 1}`} value={p.importe} editable={!disabled} maxLength={10} keyboardType="decimal-pad" placeholder="0.00" onChangeText={(importe) => patch(p.id, { importe })} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{people.map((person) => <Pressable key={person.id} accessibilityRole="checkbox" accessibilityLabel={`${p.nombre || `Producto ${i + 1}`} para ${person.nombre}`} aria-checked={p.personas.includes(person.id)} aria-disabled={disabled} disabled={disabled} onPress={() => patch(p.id, { personas: p.personas.includes(person.id) ? p.personas.filter((id) => id !== person.id) : [...p.personas, person.id] })} style={{ minHeight: 44, padding: 12, borderRadius: 14, backgroundColor: p.personas.includes(person.id) ? palette.mint : "#F4F3F8", borderWidth: 1, borderColor: p.personas.includes(person.id) ? palette.primary : palette.line }}><Label size={12} weight="bold">{p.personas.includes(person.id) ? "✓ " : ""}{person.nombre || "Sin nombre"}{person.invitado ? " (invitado)" : ""}</Label></Pressable>)}</View>
      {!p.personas.length && <Label size={12} color={palette.coral}>Elige quién lo consumió.</Label>}
      {p.personas.some((id) => !people.some((person) => person.id === id)) && <Label size={12} color={palette.coral}>Una persona fue retirada. Vuelve a asignar este producto.</Label>}
      <Button compact secondary title={`Quitar producto ${i + 1}`} disabled={disabled} onPress={() => onChange(items.filter((item) => item.id !== p.id))} />
    </Card>)}
    <Button secondary title="＋ Añadir producto o cargo incluido" disabled={disabled || items.length >= 100} onPress={() => onChange([...items, newProduct()])} />
  </>;
}
