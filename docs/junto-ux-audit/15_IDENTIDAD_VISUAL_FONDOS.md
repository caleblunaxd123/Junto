# 15 · Identidad visual: fondos con el color de JUNTO (15 oct 2026)

Pedido del dueño: fondos con identidad, del color del logo, modernos y relacionados con el dinero (en la línea
de las apps bancarias peruanas), nunca pantallas sin color.

- **Banda de marca** (`BrandBackdrop` en `Design.tsx`): degradado esmeralda del logo (#00513F → #007A60 →
  #009B76) con círculos suaves que evocan las cabezas del logo y monedas. Texto blanco (contraste AA).
- **Inicio:** logo JUNTO en blanco, «Hola, Sofía», el lema «Las cuentas claras. Los buenos momentos,
  juntos.» y los accesos sobre la banda; la tarjeta de balance «flota» sobre su borde, como en una app de banco.
- **Todas las pantallas con título** (Actividad, Perfil, Dividir gastos, Presupuesto, Gastos que se repiten,
  etc.) usan la banda con el título en blanco y el contenido sobre una hoja redondeada.
- **Fondo general** pasó de marfil (#FFFCF7) a un menta suave del logo (#EEF6F2): las tarjetas blancas
  resaltan y ninguna pantalla queda sin color.
- La barra de estado se pone en blanco sobre la banda y en oscuro en pantallas claras (por pantalla al enfocar).
- Se mantienen a propósito: el chat del grupo (verde tipo WhatsApp) y el cuaderno (papel cálido).

Capturas del emulador: `screens/native/60–63`. Pendiente: llevar la banda a login/onboarding y un tema oscuro.
