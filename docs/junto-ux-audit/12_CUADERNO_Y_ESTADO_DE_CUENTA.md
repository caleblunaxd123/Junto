# Cuaderno y estado de cuenta (14 de octubre de 2026, Lima)

## Alcance y comparación

Se continuó el avance existente de «Sacar cuentas», sin reemplazar los flujos de grupos, gastos o pagos.
El objetivo es responder cuánto consumiste, cuánto adelantaste, cuándo pagaste y quién le debe a quién.

Se aplicó REA al JavaScript compilado del cálculo de cuentas y del estado de cuenta. La evidencia es
estática, de alcance seleccionado; no demuestra ejecución ni equivale a una auditoría completa de la app.
El recibo completo y sus límites están en `ops/artifacts/statement/rea-summary.json` (local, ignorado por Git).

La sesión de REA expone analizadores JavaScript y .NET, sin un decodificador APK/DEX disponible. Por eso
no se atribuye a REA una descompilación de Splitwise. La APK aportada se inspeccionó adicionalmente con
`aapt/aapt2` del SDK Android, sin copiar código, imágenes ni diseños del producto:

- Paquete `com.Splitwise.SplitwiseMobile`, versión 26.9.1, código 963, SDK mínimo 28 y objetivo 36.
- SHA-256 `348cc3a1e499ee591d4067a074e49376b199c461dc3f929266aeea6dcfc0cfb3`.
- Recursos con referencias a balances, pagos, fechas, exportación, comprobantes y simplificación de deudas.
  Los nombres de recursos por sí solos no prueban comportamiento, disponibilidad o precio de una función.
- El recorrido observado anteriormente está documentado en `11_SPLITWISE_VS_JUNTO_PRUEBA.md`.

| Referencia | Resultado en JUNTO |
| --- | --- |
| Splitwise comunica balances por persona en el recorrido previo | El cuaderno conserva las deudas por persona y muestra por cobrar y por pagar simultáneamente |
| La APK contiene recursos de pagos, fechas y exportación | JUNTO ofrece un estado personal fechado que permite seguir cada efecto hasta el saldo final |
| La comparación requiere distinguir consumo de transferencias | Las categorías suman solo tu parte de los gastos; los pagos no inflan el consumo |
| Compartir cuentas debe permitir revisarlas | PDF y Excel se generan desde el servidor y se rechazan si las cuentas cambiaron desde la revisión |

El valor añadido implementado es un cuaderno explicable y un estado de cuenta portátil, adecuado a los
grupos con personas por nombre y a los pagos externos ya existentes en JUNTO. No se afirma que Splitwise
carezca de estas posibilidades en todos sus planes o plataformas.

## Consistencia del dinero y de las fechas

- La autorización, gastos activos, pagos y plan de liquidación se leen en una transacción `RepeatableRead`.
  Se usa el mismo `calculateAccounts` del grupo, con su modo directo o simplificado.
- Saldo = adelantado en gastos - tu parte + pagos enviados confirmados - pagos recibidos confirmados.
  Los pendientes y rechazados aparecen con efecto cero.
- Neto cero no se anuncia como «a mano» si todavía debes a alguien y otra persona te debe.
- Orden por registro, con desempate estable. Se conserva la fecha del gasto/pago y se indica si se anotó
  otro día. Una fecha de calendario de pago no se convierte desde medianoche UTC al día anterior.
- Las exportaciones usan la zona horaria del teléfono, validada por el servidor. El Excel conserva además
  el instante de registro en una columna identificada como UTC.
- Es un estado actual recalculado con los gastos vigentes. No es un historial inmutable de ediciones.

## Diseño y exportación

El cuaderno mantiene papel cálido, margen y renglones. Los efectos se resaltan en verde o rojo, el cierre
en amarillo, y se incluye el consumo personal por categoría. Cada renglón abre el detalle original.

El PDF tiene formato de estado de cuenta: titular, grupo, moneda, fecha de emisión, resumen, tabla de
fecha/concepto/cargo/abono/saldo, saldo de cierre y pendientes por persona. Se repiten las cabeceras en
documentos largos y hay numeración de páginas. Se aclara qué representa el saldo de cuentas compartidas.

El Excel tiene «Resumen» y «Movimientos», fechas y montos tipados, filtros, cabecera fija y fórmulas de
efecto, acumulado y totales con resultados almacenados. Los textos del usuario son valores literales,
incluido un concepto que empieza por `=`, nunca fórmulas ejecutables aportadas por el usuario.

Android/iOS generan un archivo en caché y abren el menú nativo para compartir, o un borrador de correo
con el archivo adjunto. El usuario elige aplicación, destinatario y envío. En web se descarga el archivo
para adjuntarlo manualmente. No se certifica envío ni entrega por abrir otra aplicación.

La exportación admite hasta 5000 movimientos completos; si se supera, informa del límite sin truncar.
Necesita red y API/app actualizadas juntas. No requiere módulos nativos nuevos.

## Comprobantes

El flujo ya existente permite adjuntar una imagen al registrar el pago: captura de galería o foto de un
comprobante, no PDF ni video. No se puede demostrar por el origen de un archivo que sea una captura
auténtica. La lectura propone datos y la aprobación humana confirma el pago. Los comprobantes conservan
sus permisos dentro de JUNTO y sus imágenes no se incrustan en los archivos exportados.

## Validación

- Dominio API: 93/93. Typecheck API y móvil y ESLint móvil: pasan.
- `node --test ops/test-statement-ui.cjs`: 5/5, incluidas fechas de calendario, neto cero con dos deudas,
  recuperación de exportaciones desactualizadas y explicación correcta después de pagar.
- `ops/test-statement-api.cjs`: autenticación, miembros, no caché, las cuatro perspectivas del ejemplo,
  pendientes/confirmados, categorías, saldos directos/simplificados, neto cero, gastos desactivados,
  grupos inactivos, PDF/Excel válidos, celdas numéricas/fechas/fórmulas, zona horaria y exportación obsoleta.
- `ops/test-vouchers-comments.cjs`: OCR real, duplicados, visibilidad, aprobación, reversión y concurrencia:
  pasa con API local y datos ficticios.
- PDF renderizado y revisado con Poppler; muestra corta de una página y documento largo multipágina.
  Excel reabierto con ExcelJS y recalculado/inspeccionado/renderizado con Artifact Tool.
- Android: cuaderno revisado, menú nativo abierto con el PDF y con el Excel adjuntos. Gmail del emulador abre su bienvenida
  porque no tiene cuenta configurada: no se validó la recepción de correo ni se inició sesión.
  WhatsApp no está instalado en ese emulador; no se afirma entrega por WhatsApp.

El emulador apunta mediante `adb reverse tcp:3005 tcp:3044` a la API QA local nueva, que observa `dist`.
La API anterior de 3005 se conservó. Base local: `junto_ux_qa_20261014` en PostgreSQL 5433.
No se modificó producción ni se envió correo o mensaje a terceros.

Repetición: compilar la API; usar `DATABASE_URL` de QA local y un `JWT_SECRET` ficticio; ejecutar
`node ops/test-statement-api.cjs` y `node ops/preview-statement-exports.cjs`. Las muestras de salida quedan
en `output/` y los intermedios en `ops/artifacts/statement/`, ambos ignorados por Git.

## Continuación: captura nativa y actualización en vivo

Se creó «QA Captura y cuaderno», con cuentas ficticias en la misma base local. Sofía debía S/25 a Marta.
Desde la galería real de Android se eligió una imagen marcada «PRUEBA QA - NO ES UN PAGO REAL».
El OCR leyó monto, Yape, destinataria, operación y fecha del 14 de octubre de 2026. La persona revisó los
datos y registró el pago mediante la interfaz nativa.

- Pendiente: conserva S/25 de deuda. El cuaderno, PDF y Excel muestran efecto cero y el indicador de
  comprobante. Un tercer integrante no puede abrir la imagen ni obtiene ese pago en su propio cuaderno.
- Confirmado por el receptor mediante la API QA: deuda de Sofía S/0. Se rechazó una segunda confirmación
  y el pago se contó una sola vez. Se conserva la fecha original en los dos archivos exportados.

La prueba reveló y corrigió dos defectos:

1. El cuaderno abierto no se actualizaba cuando otra sesión aprobaba un pago. Ahora consulta cada 15
   segundos mientras esa pantalla está visible; se invalidan sus datos al guardar gastos, pagos o cambios
   de grupo. Una modificación ficticia de S/0.01 apareció sin salir de la pantalla y su liquidación volvió
   a dejar a Sofía a mano.
2. El encabezado del grupo decía «No has pagado nada aún» aunque un pago confirmado ya dejaba al usuario
   a mano. Ahora distingue adelantos en gastos, parte asignada, pagos enviados y pagos recibidos.

También se validó en Android la carrera entre revisar y exportar: cambiar el saldo en otra sesión antes
de tocar «Compartir archivo» devuelve el conflicto esperado. La app ofrece «Actualizar y revisar cuentas»,
bloquea exportar hasta revisar y vuelve al inicio del cuaderno con los montos nuevos. No reintenta el envío
automáticamente. Los errores inesperados del dispositivo no se muestran como rutas o detalles técnicos.

Las 22 pruebas de `ops/test-mobile-ux.cjs` y `ops/test-statement-ui.cjs`, el typecheck y ESLint móvil pasan.
`ops/create-voucher-fixture.py` admite monto, destinatario y fecha y funciona con fuentes de Windows o Linux.
`ops/test-statement-voucher.cjs` conserva los pasos `seed`, `pending`, `confirm`, `add-cent`, `settle-cent`.
Para `seed`, se indica `JUNTO_QA_VIEWER_ID` de una cuenta ficticia verificada abierta en el emulador. El script
genera una captura con operación única; se copia desde `ops/artifacts/statement-voucher/captura-qa.png` a la
galería del emulador y se registra por la app antes de `pending`. Los estados, PDFs, Excel y capturas nativas
quedan en `ops/artifacts/statement-voucher/`. No se usaron pagos ni destinatarios reales.
