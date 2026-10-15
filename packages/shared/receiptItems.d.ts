export interface ReceiptItem { id: string; nombre: string; monto: number; personas: string[]; }
export function allocateReceiptItems(items: ReceiptItem[], people: string[], total: number): Record<string, number>;
