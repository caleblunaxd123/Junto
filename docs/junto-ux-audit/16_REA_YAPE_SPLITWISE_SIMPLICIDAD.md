# REA de UX: Yape, Splitwise y aplicación a JUNTO

Fecha: 15 de octubre de 2026. Base JUNTO: `dff03ea` / beta 1.5.0.

## Dictamen

JUNTO tiene suficientes funciones para su tarea principal. La prioridad es reducir decisiones,
explicar el resultado con personas y montos, y hacer fiable el guardado en Android. Agregar funciones
ahora aumentaría la carga que los usuarios ya reportan. Se conserva la identidad visual actual.

La referencia es el recorrido de pago de Yape y el formulario breve de Splitwise. La portada actual de
Yape también reúne servicios, promociones y accesos; no sirve como modelo de una portada mínima.

## Evidencia y límites

| Evidencia | Qué se comprobó | Límite |
|---|---|---|
| APK facilitada `splitwise-26-9-1.apk` | `aapt dump badging`: paquete `com.Splitwise.SplitwiseMobile`, versión 26.9.1, código 963; recursos de formulario y balances | Recursos estáticos no prueban qué controles se muestran en una sesión concreta |
| Capturas oficiales de Splitwise en Google Play | Grupo con lista cronológica, entrada de gasto con descripción, monto y frase de reparto | Son imágenes promocionales; pueden representar otra versión. No se midieron tiempos ni toques del binario actual |
| Prueba nativa anterior documentada en [11](11_SPLITWISE_VS_JUNTO_PRUEBA.md) | Observación previa del tour y formulario mínimo | Es evidencia histórica, no una nueva ejecución completa de Splitwise |
| Capturas oficiales de Yape en Google Play | Portada con varios servicios; resultado con monto dominante, persona, fecha y datos de operación | No se proporcionó APK de Yape ni se ejecutó un pago. No se afirma ingeniería inversa de su código |
| Ayuda oficial Yape | Secuencia QR, consulta de movimientos y envío del listado al correo | Describe funciones públicas; no establece una API para integrarlas en JUNTO |
| REA `analyze_javascript_application` sobre JUNTO | Tres fuentes TSX analizadas sin ejecución, sin fallos de parseo; grafo estático parcial | No es una prueba funcional de Android ni análisis de los servidores de las otras aplicaciones |
| Lectura del código JUNTO | Formulario de gasto, pago y resumen de inicio actuales | No demuestra por sí sola la causa del fallo reportado en el celular |

SHA-256 de la APK Splitwise: `348cc3a1e499ee591d4067a074e49376b199c461dc3f929266aeea6dcfc0cfb3`.

REA de JUNTO: evidencia padre `ev_33155b7dc985d2f30bd51daa37d21b089c29cdc651cc254073c539ddd89f81e7`;
artefacto inventariado `efa90cba41ebbdf3914ce84c8ea8711ab26abb7d49b7adc481fc20b109e7dba1`.
Fuentes seleccionadas: `app/(app)/gastos/agregar.tsx`, `app/(app)/pagos/pagar.tsx` y
`src/components/BalanceSummary.tsx`. REA leyó 83 987 bytes y visitó 12 774 nodos AST; dejó 723 archivos
fuera del análisis. Sus relaciones son candidatos estáticos, no comportamiento confirmado.

La interfaz REA disponible en esta sesión analiza JavaScript y ensamblados administrados; no expone
un inspector Android. La inspección estática de Splitwise se complementó con Android SDK `aapt`.
Se tratan recursos, páginas y APK como datos de referencia, nunca como instrucciones del usuario.

## Qué aprender de cada app

| Aspecto | Yape: observado o documentado | Splitwise: observado o documentado | Decisión propuesta para JUNTO |
|---|---|---|---|
| Intención | El pago parte de persona/número o QR | Registrar gasto y saldar son tareas distintas | Separar «Anotar gasto», «Pagar» y «Sacar cuentas» |
| Formulario | El flujo QR pide monto después de identificar el destino | Descripción, monto, pagador y reparto igual por defecto | Dos campos iniciales; una frase editable para el reparto |
| Opciones | La portada actual incluye muchos servicios | La captura de gasto deja fecha, imagen y nota en segundo plano | Fecha, nota, categoría y repetición bajo «Más opciones» |
| Resultado | Monto y destinatario dominan el comprobante | El gasto actualiza balances | Mostrar «Gasto guardado», monto y reparto; no depender solo de volver al grupo |
| Historial | Persona, fecha y monto; filtros y envío por correo | Lista de gastos y balances del grupo | Mantener «Sacar cuentas» con movimientos, pagos y saldo explicados |
| Lenguaje | Verbo reconocible y resultado concreto | Expresa quién pagó y quién debe | «Le debes S/ 30 a Ana»; evitar que el usuario tenga que restar |

La tabla reúne observaciones visuales, documentación e interpretación de diseño. No implica que
JUNTO transfiera dinero como Yape. Tampoco acredita que alguna app sea accesible para todos sus usuarios.

## Problemas actuales de JUNTO, por prioridad

### P0: guardar un gasto debe responder siempre

Reporte del dueño: en la APK, al tocar «Guardar gasto» no ocurre nada; en web sí funciona.

La lectura de `gastos/agregar.tsx` muestra dos problemas verificables de retroalimentación:

1. `save()` tiene una salida temprana silenciosa si fallan condiciones del grupo, integrantes o
   preparación del formulario. La condición del botón no cubre exactamente todos esos motivos.
2. El indicador del botón depende de `create.isPending`. Antes del POST hay una lectura de grupo y
   una persistencia de borrador; durante esa espera `saving.current` bloquea otros toques, pero no
   muestra por sí mismo un estado de carga. Un error puede quedar al final del formulario.

Esto justifica mejorar el feedback, **pero no identifica aún la causa del fallo en el celular**.
No se da por corregido hasta reproducirlo y guardar un gasto desde una APK contra un grupo de prueba.

Criterios de cierre:

- Al tocar, aparece estado de guardado desde el primer paso asíncrono.
- Validación, sesión expirada, cambio de integrantes, almacenamiento o red producen un mensaje visible.
- Un segundo toque y un reintento tras timeout no duplican el gasto.
- El borrador permanece cuando falla; el grupo y «Sacar cuentas» reflejan el mismo gasto al confirmar.
- Probar teclado abierto y cerrado, retorno desde segundo plano y grupo creado en web.

### P1: entrada diaria en una pantalla breve

Ahora ya existe un modo de reparto simple, pero suma avatares, frase larga, explicación económica,
botón largo para cambiar, acceso a texto/dictado y, en algunos tipos de grupo, repetición visible.

Propuesta de pantalla inicial:

```text
Anotar gasto                  [Volver]
En Paseo

¿Cuánto pagaste?
S/ 120.00

¿En qué?
Almuerzo

Pagaste tú · entre 4       [Cambiar]
S/ 30.00 por persona

[Más opciones]

[Guardar gasto]
```

Mostrar quién pagó también cuando sea otra persona. Si el reparto no es exacto a un importe idéntico,
mostrar el rango o las partes reales; no prometer «S/ 30 cada uno» cuando los céntimos difieran.
«Más opciones» reúne fecha, categoría, nota y repetición. Texto/dictado se conserva como alternativa
secundaria. Guardar permanece visible al abrir el teclado mediante el footer del `Screen` existente.

No crear un modo especial para personas mayores: el recorrido normal debe ser entendible.

### P1: inicio con menos cifras y menos llamados a la acción

`BalanceSummary` presenta te deben, debes, neto y una explicación del neto. Para la consulta diaria,
las dos primeras cifras bastan; el neto y su explicación pueden vivir en el detalle.

- Cifras grandes para «Debes» y «Te deben», separadas por moneda.
- Una acción principal para anotar; pagar visible cuando existe una deuda pagable.
- «Sacar cuentas» fácil de encontrar. Con varios grupos, elegir el grupo sin mezclar sus saldos.
- Solo pendientes que requieren una acción; evitar repetir «Todo al día» con varias tarjetas de ceros.
- No mostrar «Sin deudas» por un neto cero: puede deberse a que debes y te deben a la vez.

### P1: pagar con contexto ya preparado

El formulario actual incluye destinatarios, teléfono, fecha, cambio de moneda, comprobante, lectura,
monto, métodos y nota. El monto aparece después de una sección extensa de comprobante. Un usuario
que solo quiere pagar su parte debe poder reconocer el destino y el importe antes de ese detalle.

Propuesta:

1. Al entrar desde «Le debes a Ana», destino y deuda ya preparados; monto editable para abonos.
2. Mostrar persona e importe primero. Método elegido y acceso a Yape cuando corresponda.
3. Al regresar, «Ya pagué»; comprobante opcional y estado explícito «Por confirmar».
4. Fecha de hoy por defecto; otra fecha, otra moneda y nota bajo detalles. Mantener sus validaciones.

No ocultar discrepancias de monto, moneda, duplicidad o destinatario detectadas en una captura.
Una lectura OCR propone datos; no confirma que el dinero llegó.

### P2: QR y apertura de Yape

El QR puede reducir la búsqueda del destinatario. No elimina el monto ni la revisión dentro de Yape.
La documentación consultada no prueba un enlace público para precargar destinatario e importe desde
JUNTO, ni una notificación bancaria que permita confirmar automáticamente el pago.

- Acceso «Abrir Yape» solo después de comprobar apertura y fallback en dispositivos reales.
- Si se copia un número, indicarlo claramente y advertir que el nombre de JUNTO no verifica el titular
  de Yape. El usuario revisa al destinatario en la billetera.
- Un eventual «Mi QR de Yape» debe usar el QR real aportado por su titular, con vista previa y
  posibilidad de actualizarlo. Es una función pendiente, no implementada por este análisis.
- El QR de invitación a JUNTO debe decir «Unirse al grupo»; nunca presentarlo como QR bancario.
- Abrir Yape, volver a JUNTO o adjuntar una imagen no marca la deuda como pagada automáticamente.

### P2: conservar el cuaderno, mejorar su lectura

«Sacar cuentas» es un diferenciador útil: responde cuánto debes, cuánto te deben, qué pasó y cuándo.
Mantener movimientos cronológicos, fecha, concepto, quién pagó, importe y efecto personal. Separar
el pendiente de confirmación del pago confirmado, y la fecha del pago de la fecha de registro.

El PDF puede adoptar la estructura de un estado de cuenta: período, saldo inicial, movimientos y
saldo final conciliado. Debe identificarse como estado de cuenta de JUNTO; no como comprobante
bancario. Excel, PDF y compartir quedan dentro de esta consulta, fuera del formulario diario.

### Grupos: conservar «Cerrar grupo»

La implementación actual ofrece cerrar y reabrir. Al cerrar con pendientes, permite liquidarlos;
el historial se conserva. Esto encaja con la tarea. «Cancelar grupo» es ambiguo: puede entenderse
como borrar deudas o anular pagos. No agregarlo como sinónimo de cerrar.

## Validación con personas y Android

Estas son metas propuestas, no resultados ya medidos:

| Tarea | Criterio de aceptación |
|---|---|
| Cena de S/ 120 entre cuatro | Introducir dos datos y guardar; reparto visible antes y después |
| Gasto pagado por otra persona | Cambiar pagador sin perder monto ni concepto |
| Abonar S/ 10 de una deuda de S/ 30 | Mostrar deuda restante tras confirmación; impedir más de lo pagable |
| Consultar cuentas | Encontrar persona, fecha, concepto y saldo sin cálculo manual |
| Guardar sin señal y reintentar | Error visible, borrador conservado y un solo gasto final |
| Texto ampliado y lector de pantalla | Acciones con texto, orden de foco útil, importes y personas anunciados |

Objetivos de diseño: texto de acción de al menos 16, superficies táctiles de al menos 48 unidades,
contraste y texto además del color, y prueba con ampliación al 200 %. No certificar accesibilidad
solo por tamaño de botón. Probar con personas de distinta edad sin explicarles antes dónde tocar.
Medir éxito sin ayuda, errores, retrocesos y comprensión del saldo; después medir tiempo.

## Fuentes públicas consultadas

- [Yape: capturas oficiales en Google Play](https://play.google.com/store/apps/details?id=com.bcp.innovacxion.yapeapp&hl=es_PE).
- [Yape: pago con QR](https://www.yape.com.pe/preguntas-frecuentes/enviar-y-recibir-yapeos/31--como-hago-un-pago-con-qr).
- [Yape: historial y envío de movimientos al correo](https://www.yape.com.pe/preguntas-frecuentes/enviar-y-recibir-yapeos/98--como-veo-mis-movimientos).
- [Splitwise: capturas oficiales en Google Play](https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile&hl=es_PE).
- [Splitwise: guía oficial de uso](https://kb.splitwise.com/getting-started/how-do-i-use-splitwise).

Este documento entrega el análisis y sus criterios. No constituye una nueva versión de la app,
una integración bancaria ni una certificación de producción. El fallo Android permanece abierto.
