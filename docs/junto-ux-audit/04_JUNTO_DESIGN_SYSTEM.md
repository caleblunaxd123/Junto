# 04 · Sistema de diseño JUNTO

JUNTO ya tiene una identidad propia y reconocible (marfil, esmeralda, azul marino, lila, coral; Plus Jakarta
Sans; ilustraciones 3D cálidas). Se **conserva y se formaliza**; no se reemplaza. Fuente de verdad en código:
`apps/mobile/src/components/ui/Design.tsx`.

## 1. Color

| Token (`palette.*`) | Valor | Uso |
|---|---|---|
| `background` | `#FFFCF7` | Fondo cálido de todas las pantallas |
| `surface` | `#FFFFFF` | Tarjetas, hojas |
| `ink` | `#082644` | Texto principal (contraste 15:1 sobre blanco) |
| `muted` | `#64748B` | Texto secundario (4.8:1) |
| `primary` | `#00AD83` | Marca, pestaña activa, progreso |
| `positive` **(nuevo)** | `#007B60` | «Te deben», confirmado, éxito (texto AA) |
| `negative` **(nuevo)** | `#D9404C` | «Debes», errores (AA en texto grande) |
| `purple` / `lilac` | `#8055ED` / `#F2EDFF` | Acciones secundarias, explicaciones |
| `mint` / `yellow` / `blush` | `#E7FBF3` / `#FFF4D7` / `#FFF0F1` | Fondos de estado: éxito, pendiente, error |
| `line` | `#E6EAF0` | Bordes y separadores |
| `skeleton` **(nuevo)** | `#E9EEF3` | Placeholders de carga |

Reglas: el dinero a favor usa `positive`, en contra `negative`, el neto `ink` con signo explícito (+/−);
nunca solo color: siempre texto «Te deben» / «Debes». Migrar gradualmente los hex sueltos (`#007B60`,
`#078B70`, `#00856A`) a tokens.

## 2. Tipografía (Plus Jakarta Sans, `Label`)

| Rol | Tamaño / peso | Ejemplo |
|---|---|---|
| Título de pantalla | 27 (móvil) · 30–34 (escritorio) / extra | «Hola, Caleb» |
| Importe destacado | 26–28 / extra | «S/ 315.00» |
| Título de tarjeta | 15–18 / extra | «Tu balance en grupos» |
| Cuerpo | 13–15 / regular | explicaciones |
| Etiqueta | 12 / bold | «Te deben» |
| Nota | 11 / regular, `muted` | aclaraciones legales y de cálculo |

Interlineado 1.45×. Importes con separador de miles y dos decimales: `S/ 1,080.00` (`formatMoney`).

## 3. Espaciado, radios y elevación

Espaciado 4 · 8 · 12 · 16 · 24 · 32 (pantallas: 16 móvil / 32 escritorio). Radios: 14 (chips, botones
compactos), 16 (campos), 20 (botones), 24 (tarjetas), 999 (avatares, píldoras). Elevación por borde de 1 px
(`#EDF0F2`) en lugar de sombras; el botón flotante es el único elemento con sombra.

## 4. Componentes

| Componente | Dónde | Estados |
|---|---|---|
| `Button` (primario con degradado / secundario lila / compacto) | Design.tsx | normal, presionado, cargando (`aria-busy`), deshabilitado |
| `Card`, `Screen`, `Avatar`, `FeedbackBox`/`ErrorBox` | Design.tsx | info, éxito, aviso, error |
| `Skeleton`, `SkeletonRow` **(nuevos)** | Design.tsx | pulso suave; quieto con «reducir movimiento» |
| `BalanceSummary` **(nuevo)** | components/ | cargando (skeleton), una o varias monedas |
| `GroupInsights` y `SimplifyExplained` **(nuevos)** | components/ | barras horizontales con valor y %; lista desplegable |
| `Sheet` (bottom sheet), `AppDialog` (confirmación) | ui/ | — |
| Chips de acción del chat, burbujas de gasto/pago | chat/ | pendiente, confirmado, rechazado |

Botones: **un solo primario por pantalla**; las salidas («Volver») son secundarias.

Reglas de simplicidad (tras la prueba con Splitwise, `11`): una frase por idea; hablar siempre de personas
(«Marco te debe S/ 45.00») antes que de totales; el caso habitual en una frase y el detalle tras «Cambiar»;
avisos como una línea discreta, no tarjetas grandes repetidas.

`Pressable`: estilo estático más estado de pulsación/hover propio. **Nunca** `style={({ pressed }) => …}`:
NativeWind 4 lo descarta en Android y el componente pierde su diseño (defecto visto en la hoja «+» de la beta).

## 5. Gráficos

Barras horizontales de un solo tono (`#00856A`) sobre pista `#EEF2F5`, con etiqueta, importe y % siempre
visibles (sin leyenda ni dependencia del color). Mínimo visible 2 % para no ocultar categorías pequeñas.
Sin librería de gráficos: Views nativas, misma apariencia en Android, iOS y web.

## 6. Movimiento y háptica

Las ilustraciones se mueven suavemente y se detienen fuera de foco y con «reducir movimiento»; el skeleton
igual. Los importes y controles nunca se animan. La háptica requiere `expo-haptics` (módulo nativo, nueva
compilación): queda en el roadmap con un contenedor que no haga nada si el módulo no existe.

## 7. Accesibilidad

- Estados con props `aria-*` (`aria-checked`, `aria-selected`, `aria-expanded`, `aria-disabled`,
  `aria-busy`): funcionan en React Native nativo y en react-native-web 0.21. **No usar `accessibilityState`**:
  react-native-web 0.21 lo ignora (defecto D3).
- Objetivos táctiles ≥ 44 px; etiquetas que leen el importe completo («Te deben: S/ 315.00. Por cobrar en tus grupos»).
- Grupos de opciones con `accessibilityRole="radiogroup"` y cada opción con su descripción.

## 8. Tema oscuro (diseñado, no implementado)

Hoy los colores son constantes. Plan: convertir `palette` en `light`/`dark` con los mismos nombres semánticos,
servirlos por un `ThemeProvider` que lea `useColorScheme()` y la preferencia del perfil, y migrar pantalla por
pantalla los hex sueltos a tokens. Valores oscuros propuestos: fondo `#0E1A26`, superficie `#16263A`, texto
`#EAF1F8`, `muted` `#9FB0C3`, `positive` `#3DD6A8`, `negative` `#FF7A85`. Implementarlo a medias produciría
pantallas mixtas, por eso no se activó en esta iteración.
