# Voz y comprobantes en chat — candidata 1.4.0

## Implementado

- En Agregar gasto, «Escribir o dictar un gasto» → «Dictar gasto con voz». El micrófono se pide solo al pulsar Empezar; una sesión dura como máximo 30 segundos y se detiene al cerrar/cambiar pantalla o pasar al fondo. No se persiste audio. El servicio del teléfono/navegador puede procesarlo fuera de JUNTO; aviso visible antes del permiso y política actualizada. No se contrató transcripción ni se añadieron claves de IA a la app.
- Texto editable, uso explícito y conservación de la frase anterior al cancelar. Usar el texto no llama a la API. Completar formulario propone monto, pagador y participantes; Guardar es otra acción. Sin servicio/permiso/conexión siempre queda escritura manual. El dictado y asistente del gasto se ofrecen por ahora solo en grupos PEN; otras monedas continúan con formulario manual, sin convertirlas.
- Se rechazan varios importes o fragmentos decimales ambiguos. No se asumen todos los participantes si falta el reparto o se mencionan nombres desconocidos. Invitados, excepciones, consumos distintos y propinas remiten al formulario especializado.
- Clip al lado del mensaje del chat → explicación → captura de Yape/Plin/transferencia → OCR en servidor → revisión → Avisar que ya pagué. Tarjeta de pago en chat, aviso persistente al receptor y confirmación/rechazo existentes. Imagen solo para pagador/receptor/administración autorizada; chat no expone operación, códigos, bytes ni enlaces públicos de capturas. Quien pagó nunca se autoaprueba.
- La lectura puede cancelarse y reintentarse; respuestas tardías no cambian otro grupo/pantalla. No se envía un reporte que aparenta adjuntar una captura cuya subida no terminó. En web el selector se abre por un clic real, no desde un efecto de navegación que el navegador puede bloquear.
- Corregida etiqueta del campo de monto: muestra la moneda del grupo, no PEN fijo.

## Validación

Base nueva local `junto_voice_receipt_qa_20261011`, 22 migraciones. Siete pruebas del controlador de voz (permiso negado, respuesta tardía, doble tap, error/red, duración máxima, texto Unicode y permiso Android idempotente). Voz simulada con intérprete real y subida/OCR de captura ficticia desde chat en Chrome/WebKit 390/1440: revisión explícita, borrador conservado, sin guardado/reporte automático ni envíos externos. Pruebas API de comprobantes/permisos/duplicados, pagos/notificaciones, chat y registro con usuarios ficticios. Voz física aún no acreditada.

APK 1.4.0/code 9, mismo firmante beta y Google, bundle incluido y permiso de micrófono comprobado. Los proyectos Android previos conservaban un marcador de bloqueo del micrófono: plugin acotado elimina solo ese marcador; WRITE_CONTACTS sigue bloqueado. No se declara recepción push FCM.

## Prioridades siguientes

1. Dos celulares físicos: invitación → gasto → captura → confirmación, y dictado en restaurante con ruido. Outlook y TalkBack/letra grande. No marcarlos completos con simulaciones.
2. Push real FCM/EAS con la app cerrada; todavía depende de configuración y prueba física. Avisos internos no equivalen a entrega push.
3. Borradores offline y recuperación clara ante mala señal, sin sincronizar dos gastos iguales ni confirmar pagos offline.
4. Lectura por productos de boleta y selección de quién consumió cada uno; siempre comparar el reparto con el total original.
5. Varios pagadores por gasto, solo tras diseñar y probar su efecto en el libro; no simularlo como pagos de devolución.

Publicación requiere CI verde y respaldo/restauración; registrar la activación por separado. No está listo para tienda solo por compilar.
