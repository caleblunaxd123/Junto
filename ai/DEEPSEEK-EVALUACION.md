# Evaluación preliminar de DeepSeek para JUNTO

Prueba autorizada con datos exclusivamente ficticios y un límite de US$1 de
saldo existente. No recargas, SMS, correos, escritura en cuentas reales ni
integración de usuarios de producción. La clave solo está en el archivo local
privado ignorado `apps/api/.env.deepseek.local`.

## Resultado inicial

- Modelo solicitado: `deepseek-flash`; salida JSON, pensamiento desactivado,
  máximo 512 tokens de salida y sin reintento automático.
- 12 casos intentados, 8 aprobados con el contrato del prototipo.
- Mediana de latencia observada: 1,120 ms.
- Estimación superior por tokens de las respuestas con uso registrado:
  US$0.0023352, usando precios pico y sin descontar caché.
- Un intento no dejó uso registrado utilizable. No afirmar una factura exacta:
  su reserva conservadora local de US$0.05 se mantiene contabilizada.
- Las 12 reservas conservadoras suman US$0.60; **no son un cobro ni una reserva
  de dinero en DeepSeek**. Son el control local previo de la prueba.
- No se consumió todo el presupuesto autorizado ni se repetirá el lote solo
  para mejorar el porcentaje.

Casos aprobados: cena igual, redondeo, explicación de saldo, reparto incompleto,
nombre ambiguo, pago pendiente, pago parcial y pagador faltante.

No aprobados: consumos distintos, porcentajes (respuesta sin validación completa),
total faltante (el modelo preparó una propuesta) y cumpleaños (pagador omitido).

La evaluación de aclaraciones exige una pregunta y ausencia de confirmación;
no demuestra que cada pregunta sea ideal. Los saldos se proporcionan como datos
verificados por el motor: estos resultados NO prueban aritmética libre del modelo.
Una muestra de 12 frases no representa toda la precisión ni latencia de producción.

## Qué falta para habilitarlo en la app

1. Contrato y validadores del motor: propuesta imposible si faltan total, pagador
   o personas; invitados, consumos, porcentajes y extras comprobados en céntimos.
2. Especialización mediante instrucciones y ejemplos más claros. Mantener un
   conjunto de evaluación nuevo, no entrenar ni ajustar mirando solo los mismos 12 casos.
3. Presupuesto de uso de producción y autorización para enviar texto de usuarios
   a un proveedor externo. La autorización actual cubre solo pruebas ficticias.
4. Aviso de privacidad, reducción de datos, clave exclusivamente del servidor,
   límite de gasto persistente, límites por usuario y alternativa manual.
5. Pruebas de permisos, concurrencia, cancelación, mala conexión y respuestas
   incompletas. Ninguna respuesta del modelo puede guardar o confirmar un pago.

No se entrenaron pesos ni se desplegó DeepSeek en Contabo. La fuente candidata
del gateway local y su nuevo contrato tampoco equivalen a activación de producción:
deben desplegarse junto con la API compatible tras pasar sus pruebas.

## Herramientas

- `node ops/deepseek-benchmark.cjs`: validación en seco, cero llamadas de red.
- `node --test ops/test-deepseek-benchmark.cjs`: guardas de presupuesto y contrato.
- `--send`: genera cargos; solo ejecutar con autorización y destinatario de API oficial.
- `--continue-unattempted`: no repite casos ya reservados ni inciertos.
- Registros detallados ignorados en `ai/deepseek-benchmark-*.local.json`.

Documentación consultada: [precios](https://api-docs.deepseek.com/quick_start/pricing/),
[JSON](https://api-docs.deepseek.com/guides/json_mode/),
[pensamiento](https://api-docs.deepseek.com/guides/thinking_mode/).
