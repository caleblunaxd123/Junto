# UX diaria simplificada · JUNTO 1.6.0

15 de octubre de 2026, America/Lima. Continúa el [análisis de Yape y Splitwise](16_REA_YAPE_SPLITWISE_SIMPLICIDAD.md).

## Cambios implementados

- Inicio: «Debes» y «Te deben» con cifras mayores; explicación del neto en el detalle. Se elimina la
  tarjeta repetida de «Todo al día» y el botón flotante que podía cubrir grupos. Crear y unirse tienen
  accesos escritos; la guía sigue siendo voluntaria.
- Grupo: acciones habituales visibles, sin carrusel horizontal. Presupuesto, búsqueda, invitaciones
  y recordatorios permanecen en las opciones. «Sacar cuentas» conserva acceso directo.
- Gasto: «¿Cuánto pagaste?» y «¿En qué gastaste?», reparto preparado y acceso «Cambiar».
  Fecha, nota, categoría, voz/texto y repetición pasan a «Más opciones». Guardar permanece en el footer.
- Pago: persona e importe antes del comprobante; captura opcional, botón de copiar número y detalles
  plegados. En Android se puede abrir el paquete oficial de Yape, con fallback si no está disponible.
  No se precarga un pago ni se confirma una transferencia automáticamente.
- Lectura: acciones y mensajes principales más grandes, botones compactos de al menos 48 unidades,
  texto visible junto al indicador de espera y barra de navegación que crece con la escala de fuente.
  Se limita únicamente la ampliación del logotipo decorativo para que no invada el perfil.

Se mantiene el estilo esmeralda/menta y el cuaderno con PDF/Excel. Los saldos siguen separados por
moneda y grupo; pagar parcialmente, repartir desigual y usar otra fecha o moneda siguen disponibles.

## Guardado de gastos

Se corrigen salidas silenciosas de validación y una espera sin indicador durante la comprobación del
grupo y la persistencia del borrador. Se muestra el progreso desde el primer paso asíncrono y los
errores junto al botón. Al escribir se limpia el error de campo que ya no corresponde.

Un borrador vacío de una visita interrumpida ya no impide inicializar pagador y participantes. Abrir
un formulario vacío no genera otro borrador. Los errores de validación del almacenamiento se
capturan; reintentar su escritura conserva los valores actuales del formulario.

Antes de enviar se vuelve a comprobar estado, moneda e integrantes del grupo. Un resultado incierto
conserva el mismo identificador y contenido para reintentar sin duplicar. «Gasto guardado» aparece al
volver al grupo. Son correcciones verificadas; no se atribuye con certeza el fallo del celular del
dueño a una única causa sin sus registros originales.

## Pruebas realizadas

| Entorno | Evidencia |
|---|---|
| APK nativa con API ficticia local | Variante independiente `com.junto.app.uxqa`, Sofía y Luis ficticios. Desde borrador vacío: S/120, «Almuerzo», Guardar → una solicitud, dos partes de 6000 céntimos, saldo «Luis te debe S/60». Sin escrituras en producción |
| APK de distribución, emulador | Instalación conservando la sesión; formulario nuevo visible. Guardar con teclado abierto responde al primer toque y explica el dato faltante; no se añadió gasto al grupo real |
| Web compilada, 320/390/1280 px | Validaciones, borrador vacío, espera de preflight, guardado, monto y nota exactos, respuesta perdida y reintento idéntico, límites de pago, confirmación pendiente, inicio y simulación de texto ampliado |
| Perfil/login/recuperación, tres anchos | Formularios, errores, guía manual, foto frente a guardado, monedas separadas al eliminar y recuperación con transporte ficticio; sin correos ni eliminación de cuentas reales |
| Dominio | 106 pruebas correctas |
| UX/configuración relacionadas | 59 pruebas correctas, más 4 de configuración de distribución; TypeScript y ESLint correctos |
| APK/web | JS incluido, ARM64/x86_64, sin mapas, entornos, keystores, fixture nativa ni secretos locales conocidos. La distribución exige HTTPS; el paquete de prueba local no se distribuye |

Reproducir la prueba de navegador:

```sh
node ops/test-simple-flows-web.cjs apps/mobile/dist-beta
node ops/test-profile-web.cjs apps/mobile/dist-beta
```

Evidencia local ignorada por Git: `ops/artifacts/simple-ux/`,
`ops/artifacts/release-20261015-beta160/native-save-proof.json` y registros de compilación.
La variante nativa ficticia y su servidor temporal se retiraron al concluir la prueba.

## Alcance de la validación

La ampliación web comprueba desbordes y lectura de esa compilación; no sustituye una sesión de
TalkBack ni pruebas con personas de distintas edades. No se realizaron transferencias bancarias,
autenticación de Yape ni pruebas de una API bancaria. La apertura con Yape instalado en el celular
del dueño y la facilidad real con sus amigos siguen siendo pruebas de campo de la beta.

Esta versión se distribuye como APK de prueba con el mismo firmante anterior; no equivale a una
publicación en Google Play.
