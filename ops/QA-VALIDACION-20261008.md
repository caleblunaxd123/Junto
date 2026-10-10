# Validaciones y preparación de IA — 8 de octubre de 2026 (Lima)

## Cambios de UX

- Mensajes con título, icono, color semántico y texto de corrección.
- Validación por campo en registro, login, recuperación y datos personales.
- Prevención de doble toque en registro y códigos; contraseña visible opcional
  al recuperar; teclado sin doble contenedor de ajuste en autenticación.
- Errores del servidor identifican el campo en español, no textos técnicos.
- Ante una respuesta incierta de guardado se pide comprobar el resultado antes
  de repetir. El correo incierto conserva su clave: consultar no duplica el envío.
- Registro/recuperación explican que el código llega por correo, compatible con
  Gmail, Outlook y otros proveedores. No se activó SMS ni ningún cargo nuevo.
- Celular opcional marcado como contacto no verificado.

## Pruebas

- TypeScript y lint de mobile pasan.
- Compilación de API y 65 pruebas de dominio pasan.
- 28 pruebas de mensajes, diálogos, reparto y semilla IA pasan. Las pruebas de
  semilla son etiquetas matemáticas, no respuestas de un modelo.
- Integración de cuenta/correo y compartir probadas con SMTP loopback y base QA:
  ningún envío externo adicional en esta validación.
- Inspección visual en emulador del perfil y edición personal. El usuario también
  estaba interactuando; no se introdujeron ni guardaron cambios en su cuenta.

## IA: no confundir conexión con funcionamiento

Gateway anuncia Qwen3 1.7B. La inferencia ficticia directa terminó HTTP 502,
`model_unavailable`, tras 53,911 ms. El límite de la API es 15 s y el cliente 20 s.
Diagnosticar y medir antes de presentar este camino como listo. No se entrenó
un modelo; véase `ai/README.md` y la semilla ficticia con separación train/evaluation.

## Alcance de despliegue

Imagen candidata `junto-api:20261009-validation` construida en Contabo; no
equivale a activación ni a una nueva APK distribuida. El código mobile se valida
localmente. Los pendientes de firma/EAS, dispositivos externos, Outlook real,
monitoreo y respaldo externo siguen en `CONTABO-CORREO.md` y `RELEASE_CHECKLIST.md`.
