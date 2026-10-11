export const firstSteps = [
  { icon: "receipt-outline", title: "¿Pagaste por todos?", text: "Crea un grupo de cobranza, escribe el total que ya pagaste y cuántas partes tendrá. JUNTO calcula cuánto te devuelve cada persona.", example: "Pagaste S/ 500 · 5 partes = S/ 100 por persona." },
  { icon: "person-add-outline", title: "Invita a tu gente", text: "Comparte el enlace por WhatsApp o correo. Pueden entrar desde la web sin instalar la app y revisar su parte antes de unirse.", example: "Una cena rápida, sin grupo: elige «Una cuenta de hoy» en +." },
  { icon: "chatbubbles-outline", title: "Conversen y confirmen", text: "El chat reúne mensajes, la cuenta y los pagos. Cada integrante paga por Yape, Plin u otro medio y lo registra. Quien recibe confirma solo después de comprobarlo.", example: "Registrar un pago no transfiere dinero. Confirmarlo sí actualiza el pendiente." },
  { icon: "notifications-outline", title: "No te pierdas lo nuevo", text: "Activa los avisos del celular para mensajes, invitaciones y pagos. Puedes decir que no y seguir usando JUNTO; en Inicio verás tus novedades.", example: "El celular te pedirá permiso. Tú decides; puedes cambiarlo después en sus ajustes." },
] as const;

export const tourStorageKey = (userId: string) => `junto.firstSteps.v1.${userId}`;
