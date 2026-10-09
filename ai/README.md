# Asistente especializado JUNTO

## Decisión de producto

Verificación de cuenta y recuperación mediante correo (Gmail, Outlook u otros
proveedores). Sin SMS por ahora. El celular opcional es un contacto declarado,
no una identidad verificada ni prueba de que tenga Yape/Plin.

JUNTO quiere especializar un modelo existente para entender gastos peruanos,
pedir datos faltantes y explicar cuentas. No entrenar desde cero ni delegar al
modelo los saldos oficiales: la API calcula en céntimos, comprueba permisos y
exige confirmación antes de guardar. Un pago declarado no reduce la deuda
hasta su confirmación por quien tenga permiso.

## Estado real

Véase `DEEPSEEK-EVALUACION.md`: primera prueba externa autorizada solo con datos
ficticios, 8/12 casos aprobados y mediana de 1.12 s. No habilitada para usuarios reales.
La decisión anterior de no contratar servicios se conserva para producción;
la excepción autorizada fue esta prueba acotada, sin recargas.

- Producción: Ollama y Qwen3 1.7B configurados en el gateway privado de Contabo.
  Fuente candidata: Qwen2.5 1.5B, extracción corta sin aritmética del modelo.
  Las pruebas iniciales del candidato no implican despliegue ni certificación completa.
- El texto sencillo con monto explícito puede resolverse mediante reglas locales.
- La última inferencia directa de prueba respondió HTTP 502 tras unos 54 segundos.
  La API tiene un timeout de 15 segundos y el cliente de interpretación 20 segundos.
  No considerar el modelo fiable ni ocultar el problema aumentando únicamente la espera.
- No se ha entrenado un modelo de JUNTO, instalado otra infraestructura ni contratado GPU.
- `seed-cases.json` es una semilla ficticia curada, NO un corpus suficiente para entrenar
  ni una demostración de precisión del modelo. Mantener evaluación separada de entrenamiento.
- `node --test ops/test-ai-corpus.cjs` valida etiquetas numéricas y separación contra
  el motor actual. NO consulta Ollama ni mide la calidad de sus respuestas.

## Orden de trabajo

1. Diagnosticar tiempos, recursos y JSON del gateway con casos ficticios. Medir
   latencia y errores también con solicitudes concurrentes. Mantener entrada manual.
2. Convertir las frases en una propuesta estructurada. Si faltan monto, pagador,
   participantes o existen nombres ambiguos, preguntar; no asumir información.
3. Usar herramientas del motor exacto para repartir, invitados, extras y pagos
   parciales. Generar la explicación desde esos resultados, no desde aritmética libre.
4. Ampliar el corpus con ejemplos variados y revisados: cumpleaños, pareja, viajes,
   consumos distintos, decimales, recibos incompletos, correcciones e instrucciones
   maliciosas. No copiar cuentas, correos, teléfonos o boletas privadas sin consentimiento.
5. Evaluar primero instrucciones y reglas sobre casos reservados. Ajustar con LoRA
   solo si aporta una mejora medible respecto a esa base. Comprobar licencia del modelo
   y compatibilidad de despliegue. Aprobar presupuesto antes de contratar entrenamiento.
6. Versionar modelo y corpus. Exigir importes exactos, participantes válidos,
   ausencia de acciones automáticas, preguntas correctas y latencia aceptable.
   La semilla actual no basta para certificar esos objetivos.

Las respuestas esperadas describen el comportamiento futuro del asistente completo;
no implican que el endpoint actual de interpretar gastos ya soporte todos esos casos.
