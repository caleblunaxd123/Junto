export const firstSteps = [
  { icon: "people-outline", title: "Crea un grupo", text: "Para un viaje, una salida o el depa. Agrega a tu gente por su nombre, aunque todavía no tengan JUNTO: después cada uno entra con su enlace.", example: "«Paseo a Lunahuaná» con Ana, Luis y Marta." },
  { icon: "receipt-outline", title: "Anota cada gasto", text: "Tres preguntas: ¿cuánto?, ¿quién pagó? y ¿entre quiénes? Si alguien no paga, como el cumpleañero, lo desmarcas y su parte se reparte entre los demás.", example: "Almuerzo de S/ 200 entre 4: S/ 50 cada uno. El cumpleañero, S/ 0." },
  { icon: "swap-horizontal-outline", title: "JUNTO hace las cuentas", text: "Suma todos los gastos y te dice quién le debe a quién, con la menor cantidad de pagos. Cada uno paga por Yape, Plin o efectivo y quien recibe lo confirma.", example: "Pagaste S/ 300 entre 4: cada uno te debe S/ 75. JUNTO no transfiere dinero: solo lleva la cuenta." },
  { icon: "notifications-outline", title: "No te pierdas lo nuevo", text: "Activa los avisos del celular para gastos, pagos y mensajes. Puedes decir que no y seguir usando JUNTO; en Inicio verás tus novedades.", example: "El celular te pedirá permiso. Tú decides; puedes cambiarlo después en sus ajustes." },
] as const;

export const tourStorageKey = (userId: string) => `junto.firstSteps.v2.${userId}`;
