# Distribución basada en las cuatro capturas del dueño

Estado: publicada en web y APK beta 1.7.0/código 12 el 17/10/2026, después de CI verde,
respaldo restaurado y autorización explícita. Registro: [despliegue 1.7.0](../../ops/web/DEPLOY-20261017-BETA170.md).
Rama: `codex/clear-group-layout-20261017`, sobre `582b896`.

## Decisión de producto

Las capturas priorizan acertadamente el dinero y las personas, no una conversación
vacía. La entrada al grupo pasa a **Cuentas**. **Chat** sigue al lado, a un toque,
con indicador de novedades, mensajes, respuestas, reacciones, emojis y comprobantes.
No se elimina el historial ni cambia el libro de cuentas.

La captura del gasto comunica cinco preguntas en una pantalla, no cinco pasos de
navegación. Se conserva ese formulario continuo: monto, descripción, quién pagó,
participantes y resultado por persona. Se evita ocultar el pagador o el reparto
detrás de «Cambiar». Para grupos de más de seis integrantes, elegir pagador usa el
selector existente; los participantes siguen visibles. Los métodos de reparto
avanzados permanecen disponibles en «Cambiar reparto».

## Aplicación

- Inicio: saldos por moneda, **Crear grupo** grande incluso con grupos existentes,
  tarjetas con total y saldo personal, actividad reciente. No repite botones de
  agregar gasto/pagar/boleta en el balance. Solo los pagos que requieren una
  decisión interrumpen la lista; las deudas ordinarias están en sus grupos.
- Crear grupo: nombre y personas primero. El creador permanece incluido; no se
  reproduce la «X» del creador de la referencia porque crearía una expectativa
  falsa de poder excluirlo del grupo. País, moneda y fecha límite se despliegan en
  Opciones; la moneda elegida queda visible aun plegadas. Una persona escrita sin
  pulsar Agregar bloquea el envío y explica cómo terminar, en vez de perderla.
- Agregar gasto: formulario numerado, pagador y participantes distinguibles
  (radio frente a casillas), resultado por persona y Guardar fijo con adaptación
  al teclado. Voz, lectura de boleta y frase asistida permanecen en un bloque
  opcional después de los datos esenciales. No se cambió el cálculo en enteros,
  validación de sumas, borrador ni la recuperación idempotente de solicitudes.
- Grupo: resumen Total gastado / Tu parte / Pagaste, deudas por persona, gastos
  paginados, Agregar gasto y Sacar cuentas. Reportar pago solo cuando corresponde;
  un reporte pendiente ofrece revisión y no reduce la deuda. El detalle/exportación
  PDF/Excel conserva acceso en Opciones del grupo.
- Terminología: «Aún no se une» sustituye «sin app» en las cuentas: alguien puede
  participar desde la web sin instalar. Crear grupo también es la entrada principal
  en PC y en la guía.

## Chat y avisos

Abrir Cuentas no consulta el endpoint que marca el chat como leído. Solo Chat lo
consulta y realiza su sondeo. Las cuentas siguen actualizando saldos y pagos cada
15 segundos mientras están enfocadas. Una notificación de tipo `mensaje` abre
directamente `?vista=chat`; IDs continúan validados como UUID exactos. Cambiar entre
las dos pestañas conserva el texto del mensaje sin enviarlo. Esto no certifica
entrega push real con la app cerrada.

## Validación de esta ronda

- Mobile TypeScript y ESLint completos.
- API TypeScript y 106 pruebas de dominio aprobadas. Una prueba de páginas públicas
  no pudo conectarse a su servidor de loopback con el sandbox; la suite completa
  pasó al repetirla con permiso para ese servidor local.
- 26 pruebas ops: Inicio, boleta, pagos, destinos de notificaciones, guía y emojis.
- Export web local con `EXPO_NO_DOTENV=1`, API `http://127.0.0.1:3005`, sin publicar.
  Se limpió la caché de Metro al detectar que retenía la URL de un build anterior.
- `ops/test-group-layout-web.cjs`: Chromium con sesión y endpoints ficticios,
  todo tráfico externo bloqueado. Verifica botón principal, opciones/moneda,
  personas sin agregar, lectura del chat solo al abrirlo, borrador de mensaje,
  anchos 320/360/390/768/1024/1440, formulario y reparto exacto, exclusión de todos
  rechazada, 60 frente a total 80 rechazado, 30+50 aceptado, pagos pendientes,
  fallo de listado sin presentarlo como grupo sin gastos y saldos de distintas
  monedas sin sumarlos. Las capturas están en `ops/artifacts/group-layout-*.png`.

Las fixtures comprueban la interfaz y el contrato enviado, no persistencia real en
PostgreSQL, reconocimiento de voz/OCR, entregas de WhatsApp/correo ni push físico.
No se crearon cuentas reales, enviaron mensajes o cambiaron pagos de producción.
No hubo cambios de esquema ni migraciones. Los archivos previamente modificados
del dueño se conservaron; después autorizó publicar todos los pendientes revisados,
incluidos con esta implementación en `3607fb8`, CI verde y main actualizado.

Antes de anunciar validación completa en dispositivos reales: repetir el recorrido
con dos personas, teclado físico/virtual, TalkBack, Google de esta APK y push físico.
La distribución beta firmada no sustituye esas pruebas de campo.
