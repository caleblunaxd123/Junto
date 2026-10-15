# 15 · Identidad visual: fondos con el color de JUNTO (15 oct 2026)

Pedido del dueño: fondos con identidad, del color del logo, modernos y relacionados con el dinero (en la línea
de las apps bancarias peruanas), nunca pantallas sin color.

- **Banda de marca** (`BrandBackdrop` en `Design.tsx`): degradado esmeralda del logo (#00513F → #007A60 →
  #009B76) con círculos suaves que evocan las cabezas del logo y monedas. Texto blanco sobre la banda.
- **Inicio:** logo JUNTO en blanco, «Hola, Sofía», el lema «Las cuentas claras. Los buenos momentos,
  juntos.» y los accesos sobre la banda; la tarjeta de balance «flota» sobre su borde, como en una app de banco.
- **Todas las pantallas con título** (Actividad, Perfil, Dividir gastos, Presupuesto, Gastos que se repiten,
  etc.) usan la banda con el título en blanco y el contenido sobre una hoja redondeada.
- **Fondo general** pasó de marfil (#FFFCF7) a un menta suave del logo (#EEF6F2): las tarjetas blancas
  resaltan y ninguna pantalla queda sin color.
- La barra de estado se pone en blanco sobre la banda y en oscuro en pantallas claras (por pantalla al enfocar).
- El chat conserva su verde tipo WhatsApp. El cuaderno usa ahora hoja blanca, margen menta y montos
  resaltados, con su resumen sobre la banda esmeralda.

Capturas del emulador: `screens/native/60–63`. Login, onboarding y splash ya usan la misma identidad.

## Pulido sobre el diseño actual (15 oct 2026)

El dueño confirmó que le gusta esta apariencia. Se conserva como base, incluyendo sus cambios locales
en splash, acceso, bienvenida y cuaderno.

- Cuaderno: «Te deben» y «Debes» tienen su propio monto y etiqueta; las cifras grandes se acomodan
  sin mezclarse. En pantallas estrechas, cada movimiento distribuye concepto y monto en vertical.
- Presupuesto: montos, límites y próximos gastos pueden ocupar más de una línea sin salir de las tarjetas.
- Google en web: su botón oficial vuelve a medirse cuando cambia el ancho del formulario.
- Navegación activa: usa el esmeralda oscuro que ya existe en la paleta para mejorar el contraste.
- Gastos recurrentes: «pagas tú» y «lo programaste tú» mantienen el lenguaje de la app.

La revisión visual utiliza respuestas ficticias interceptadas en un navegador aislado contra Metro local;
no modifica cuentas ni movimientos reales.
