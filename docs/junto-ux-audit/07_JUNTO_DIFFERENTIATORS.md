# 07 · Diferenciadores JUNTO y modelo freemium

Estado real de cada propuesta de la misión. «Existía» = ya estaba en el código antes de esta iteración.

| | Propuesta | Estado | Detalle |
|---|---|---|---|
| A | **SmartSplit** (lenguaje natural) | Existía | `/ia/gastos/interpretar`: reglas locales deterministas para notas explícitas (monto, pagador «yo», personas mencionadas, categoría) y IA solo como respaldo; siempre propuesta editable; nunca guarda sola. Pendiente: «somos cuatro» sin nombres en grupos más grandes; aviso de consentimiento antes de enviar texto a la IA. |
| B | **Scan** (boleta) | Existía + en curso | OCR Tesseract en la API (sin IA para sumar), propuesta de total y, en curso, líneas de productos asignables. Captura manual gratis siempre. Pendiente: impuestos/propina por línea; OCR en el dispositivo (como hace Splitwise con ML Kit) para privacidad y velocidad. |
| C | **Simplifica** | **Mejorado** | El algoritmo conserva exactamente el neto por persona y moneda (probado con 400 libros aleatorios: ≤ n − 1 transferencias y nunca más que sin simplificar). Ahora se muestra «sin simplificar N pagos → con JUNTO M» y las deudas originales. Los pagos confirmados no se alteran. |
| D | **Hogar** | Pendiente | Requiere gastos recurrentes (modelo en `08`). Después: presupuesto compartido y calendario de vencimientos (reutilizando `fechaLimite`). |
| E | **Viajes** | Parcial | Grupo tipo viaje, moneda propia, pagos en otra moneda con tasa acordada y fecha de referencia (no hay conversión automática sin tasa verificada). Nuevo: gasto por categoría y por persona. Pendiente: presupuesto y gasto diario. |
| F | **Recordatorios** | Existía | Tono suave, máximo cada 12 h por persona, avisos automáticos por fecha límite. Pendiente: pantalla de frecuencia y consentimiento por persona. |
| G | **Offline** | En curso | Borradores por usuario en el dispositivo; guardar exige conexión y reutiliza el mismo `solicitudId` (la API devuelve el mismo gasto ante reintentos). Pendiente: cola de envío automática al reconectar con resolución de conflictos. |
| H | **Insights** | **v1 hecho** | «En qué se gastó» por categoría y «Quién adelantó el dinero», por grupo. Pendiente: evolución mensual y comparación entre periodos. |

## Modelo freemium propuesto (Perú)

Hipotético para evaluación; **no se implementó cobro** (revisar antes las políticas vigentes de Google Play
y App Store: bienes digitales deben usar su facturación).

**Gratis, siempre y sin límites artificiales:** grupos, gastos ilimitados, todas las divisiones (incluidas
participaciones), balances, simplificación explicada, registro y confirmación de pagos externos, recordatorios,
historial, OCR del total.

**JUNTO Plus — S/ 5.90/mes (o ~S/ 49/año):** itemización avanzada de boletas, reportes y estadísticas
históricas (mensual, comparativas, exportación), gastos recurrentes avanzados y presupuestos de Hogar/Viajes,
personalización (portadas, temas), automatizaciones (recordatorios programados).

Regla: nada necesario para **entender o saldar** una deuda queda detrás de un pago. Ese es el contraste con
el límite diario que terceros reportan en el plan gratis de Splitwise.
