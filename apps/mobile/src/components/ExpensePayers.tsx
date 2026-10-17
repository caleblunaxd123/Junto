import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney } from '@junto/shared/currency';
import { centavosASoles } from '../types';
import { parseMoney } from '../lib/expensePreview';
import { Avatar, Label, design, palette } from './ui/Design';

/** Advances are separate from consumption. Never distribute or correct the entered advances silently. */
export function ExpensePayers({ members, values, onChange, concepts = {}, onConcepts, total, currency }: {
  members: { usuarioId: string; usuario: { nombre: string; fotoUrl?: string | null } }[];
  values: Record<string, string>; onChange: (values: Record<string, string>) => void;
  /** What each one paid for ("Tour", "Cena"): answers "¿en qué pusiste?" when the accounts are settled. */
  concepts?: Record<string, string>; onConcepts?: (concepts: Record<string, string>) => void;
  total: number; currency: string;
}) {
  const parsed = Object.values(values).map(parseMoney);
  const sum = parsed.reduce<number>((result, value) => result + (value ?? 0), 0);
  const valid = parsed.length >= 1 && parsed.every(value => value !== null && value > 0) && sum === total && total > 0;
  const money = (value: number) => formatMoney(value, currency);
  const ids = Object.keys(values);
  const missing = members.filter(m => ids.includes(m.usuarioId) && !(parseMoney(values[m.usuarioId]) ?? 0)).map(m => m.usuario.nombre);
  // Only when the person asks: split the total in equal parts among the people marked (remainder cents to the first ones).
  const splitEqually = () => {
    if (!ids.length || total <= 0) return;
    const base = Math.floor(total / ids.length);
    onChange(Object.fromEntries(ids.map((id, i) => [id, centavosASoles(base + (i < total - base * ids.length ? 1 : 0))])));
  };
  const status = valid ? `Adelantaron ${money(sum)} · coincide con el total`
    : missing.length ? `Escribe cuánto puso ${missing.join(' y ')}${sum < total ? ` · faltan ${money(total - sum)}` : ''}`
    : `Adelantaron ${money(sum)} de ${money(total)}${sum < total ? ` · falta indicar ${money(total - sum)}` : sum > total ? ` · sobran ${money(sum - total)}` : ''}`;
  return <View style={{ gap: 10 }}>
    <Label size={13} color={palette.muted}>Marca a quienes pusieron dinero: cuánto y en qué (como «Tour» o «Cena»). Así, al sacar cuentas, todos ven quién pagó qué.</Label>
    {members.map(member => {
      const selected = Object.prototype.hasOwnProperty.call(values, member.usuarioId);
      return <View key={member.usuarioId} style={{ padding: 10, gap: 8, borderRadius: 16, backgroundColor: selected ? palette.mint : 'white', borderWidth: 1, borderColor: selected ? '#68D6B6' : palette.line }}>
        <Pressable accessibilityRole="checkbox" aria-checked={selected} accessibilityLabel={`Adelantó ${member.usuario.nombre}`} onPress={() => {
          const next = { ...values };
          if (selected) {
            delete next[member.usuarioId];
            if (concepts[member.usuarioId] !== undefined && onConcepts) { const rest = { ...concepts }; delete rest[member.usuarioId]; onConcepts(rest); }
          } else next[member.usuarioId] = '';
          onChange(next);
        }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={member.usuario.nombre} photo={member.usuario.fotoUrl} size={32} />
          <Label weight="bold" size={15} style={{ flex: 1 }}>{member.usuario.nombre}</Label>
          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? palette.positive : palette.muted} />
        </Pressable>
        {selected && <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput accessibilityLabel={`Cuánto puso ${member.usuario.nombre}`} keyboardType="decimal-pad" value={values[member.usuarioId]} onChangeText={value => onChange({ ...values, [member.usuarioId]: value })} maxLength={16} placeholder={currency === 'PEN' ? 'S/ 0.00' : `0.00 ${currency}`} placeholderTextColor={palette.muted} style={[design.input, { width: 118, flexGrow: 0 }]} />
          {onConcepts && <TextInput accessibilityLabel={`En qué lo puso ${member.usuario.nombre}`} value={concepts[member.usuarioId] ?? ''} onChangeText={value => onConcepts({ ...concepts, [member.usuarioId]: value })} maxLength={80} placeholder="¿En qué? Ej. Cena" placeholderTextColor={palette.muted} autoCapitalize="sentences" style={[design.input, { flex: 1, minWidth: 0 }]} />}
        </View>}
      </View>;
    })}
    {ids.length > 1 && total > 0 && !valid && <Pressable accessibilityRole="button" onPress={splitEqually} style={{ minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: '#68D6B6', backgroundColor: 'white' }}>
      <Ionicons name="git-compare-outline" size={18} color={palette.positive} />
      <Label size={14} weight="bold" color={palette.positive}>Pusieron lo mismo · {money(Math.floor(total / ids.length))} c/u</Label>
    </Pressable>}
    <Label accessibilityLiveRegion="polite" size={14} weight="bold" color={valid ? palette.positive : palette.coral}>{status}</Label>
  </View>;
}
