import React from "react";
import { FormField } from "./ui/Reference";

export const todayLocal = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export const validDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date && date >= "2000-01-01" && date <= new Date().toISOString().slice(0, 10);
};
export function PaymentDate({ value, onChange, disabled }: { value: string; onChange: (date: string) => void; disabled?: boolean }) {
  return <FormField label="¿Qué día pagaste?" accessibilityLabel="Fecha real del pago, año mes día" icon="calendar-outline" value={value} onChangeText={onChange} editable={!disabled} maxLength={10} placeholder="AAAA-MM-DD" error={validDate(value) ? undefined : "Escribe una fecha válida, sin días futuros: AAAA-MM-DD."} />;
}
