# Monedas y pagos externos — candidata 1.3.0

Estado: código y export local QA, no desplegados en Contabo. No se anuncia APK nuevo publicado ni recepción push física.

## Recorrido

1. Elegir país del plan y confirmar moneda. País solo sugiere: Colombia puede tener un grupo COP, USD o EUR. Sin GPS. Grupos antiguos conservan PEN; moneda y país no cambian después de crear el libro.
2. Registrar cuenta, quién pagó y quién participa. Un cumpleañero/invitado excluido no adquiere deuda al unirse: prueba de S/ 180 conserva cinco partes de S/ 36 y una excluida de S/ 0.
3. Pagar externamente, pulsar «Ya pagué», indicar receptor, fecha real, importe y opcionalmente comprobante.
4. En otra moneda: revisar referencia histórica diaria o introducir cambio acordado. La unidad es moneda del grupo por una unidad de origen. Referencia y tasa aplicada quedan por separado; el servidor recalcula exactamente y bloquea excedentes.
5. Reportar deja pendiente, no baja la deuda. Confirma o rechaza quien recibe tras comprobar el dinero. El creador no aprueba automáticamente si otra persona recibe. La política puede permitir administración; un receptor añadido por nombre requiere representación administrativa. Quien pagó nunca se autoaprueba.
6. Resolución avisa al pagador y actualiza saldos/chat. Un pago pendiente se revisa, no se duplica. El receptor conserva «No me llegó» sobre aprobación administrativa reciente.

Personas añadidas por nombre no tienen credenciales ni reciben correos/push. Unirse/reclamar parte conserva cantidades, no redistribuye gastos anteriores.

## Referencias y comprobantes

- [Frankfurter v2](https://frankfurter.dev/): referencia diaria combinada, no precio ejecutable ni comisión bancaria. Se envían solo par de monedas y fecha, nunca identidades, importes o imágenes. Sin clave ni nuevo plan de pago.
- Referencia no posterior al pago, antigüedad máxima siete días; timeout seis segundos, caché acotada y consultas simultáneas deduplicadas. Fallo permite cambio manual; nunca tasa inventada.
- OCR local propone monedas explícitas de las seis admitidas. `$` ambiguo y varios importes/monedas requieren revisión. Mantiene propietario, bloqueo de hash/operación reutilizados, imagen privada y retención existentes.
- Subir desde grupo/chat abre el formulario seguro del pago. No analiza automáticamente cualquier imagen como mensaje ni confirma dinero por captura.
- Yape/Plin solo moneda de origen PEN; puede convertirse al grupo. Otras monedas: efectivo/transferencia.
- Avisos internos en la misma transacción financiera; push después de confirmar la transacción. FCM/Expo y recepción real con app cerrada siguen pendientes.

## Validación

Base local aislada `junto_payment_flow_qa_20261011`, dotenv privado desactivado, secretos/cuentas ficticios y sin correos a amigos.

- 17 migraciones aplicadas y `prisma migrate diff` vacío; API build y 79 pruebas de dominio; TypeScript/lint móvil.
- `ops/test-payment-flow.cjs`: reporte parcial, confirmación/rechazo, invitado excluido, receptor distinto del creador, permisos/avisos de receptor sin cuenta, referencia/tasa aplicada, comprobante extranjero y errores de fecha/par/equivalente.
- `ops/test-currency-api.cjs`: moneda inmutable, APK antiguo protegido, conversión exacta y deuda intacta antes de aprobar.
- `ops/test-payment-flow-web.cjs`: Chrome/WebKit, 390/1440 px y dos sesiones; país/moneda independiente, tasa inválida bloqueada, aviso al receptor, aprobación y aviso al pagador. Referencia ficticia interceptada, sin llamadas externas del navegador.
- Regresiones: importación, integrantes por nombre, pagos recibidos, avisos de unión, concurrencia y comprobantes/comentarios con OCR real.

Navegador no sustituye Google, WhatsApp, accesibilidad ni push en teléfonos físicos. La interpretación IA de gastos en otras monedas aún está bloqueada: no se anuncia IA financiera general.

## Publicación y reversión

Exige CI verde, respaldo privado restaurado/validado, migraciones según `ops/contabo/README.md`, imágenes de etiqueta nueva y APK Google con mismo firmante. Nunca publicar `.env` o claves FCM/SSH/SMTP/IA.

Después de existir grupos extranjeros **no volver a una API antigua que asuma PEN**: corregir hacia adelante o conservar API compatible. Migraciones aditivas no hacen compatible una semántica antigua. APKs sin soporte reciben indicación de actualizar en vez de mostrar pesos como soles.
