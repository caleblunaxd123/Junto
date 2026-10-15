# Perfil y acceso — revisión del 15 de octubre de 2026

## Cambios

- La bienvenida de tres pantallas se conserva. La guía de cuatro pasos deja de abrirse automáticamente y se ofrece solo desde «Guía rápida» o «Mis avisos».
- El resumen previo a eliminar la cuenta separa las deudas y los cobros por moneda. Los campos antiguos conservan únicamente soles para no mostrar dólares como soles en clientes anteriores.
- Un saldo neto cero no indica que todo esté pagado cuando todavía existen pagos entre personas. El resumen, las cuentas explicadas y los participantes muestran esas obligaciones por separado; el ejemplo educativo coincide con el reparto habitual.
- Las solicitudes de una sesión anterior no pueden reintentarse con las credenciales de una cuenta nueva. La renovación de credenciales se comparte únicamente dentro de la misma sesión y descarta respuestas antiguas.
- Las contraseñas nuevas se validan en cliente y servidor antes del límite de 72 bytes de bcrypt, incluyendo tildes y emojis. El acceso con contraseñas existentes conserva su compatibilidad.
- La carga de foto bloquea el guardado simultáneo del perfil y actualiza solo la foto. Los errores del selector se muestran dentro de la app.
- Las opciones de notificaciones distinguen web, app sin configuración push y app configurada. La ayuda refleja el estado de cuenta, las exportaciones y el cierre de grupos actuales.

## Comprobaciones reproducibles

- `npm run test --workspace=apps/api`: lógica de cuentas, dinero y validación de credenciales.
- `node --test ops/test-profile-account.cjs ops/test-session-isolation.cjs ops/test-mobile-ux.cjs ops/test-first-steps-chat.cjs`: contrato de eliminación con monedas y cuentas con neto cero, respuestas tardías, renovaciones concurrentes y guía opcional.
- `npm run build:api`, `npm run typecheck --workspace=apps/mobile` y `npm run lint --workspace=apps/mobile`.
- Exportar la web con configuración pública de producción y ejecutar `node ops/test-profile-web.cjs <directorio-exportado>`: login inválido y reintento, correo normalizado, guía manual, avisos web, seguridad, edición y foto simultánea, eliminación con contraseña o Google, cancelación, cuentas y recuperación. Anchos: 320, 390 y 1280 píxeles. Todos los servicios remotos se interceptan con datos ficticios; no se envían correos ni se modifican cuentas reales.
- GitHub Actions ejecuta además los flujos completos en PostgreSQL de pruebas: eliminación, acceso Google, correos con SMTP de prueba, códigos vencidos/reutilizados, límite de intentos, recuperación y revocación de sesiones. La eliminación comprueba que se conservan las deudas PEN/USD y se transfiere la administración.

## Revisión en el emulador

Se abrió la APK de distribución instalada y su sesión existente para revisar las pantallas de perfil, edición, ejemplo, asistente, seguridad, avisos, eliminación, confirmación de cierre de sesión y el enlace de privacidad. Las acciones destructivas se cancelaron; la cuenta real se conserva. El envío de soporte y los permisos del sistema no se modificaron.

La APK instalada presenta una versión anterior del diseño. Estas correcciones se validan en el código y en la exportación web compilada; esta revisión no equivale a instalar una APK nueva ni a desplegar la API o web públicas. El inventario de 39 rutas se revisó en código, pero no todas se recorrieron visualmente en esta sesión.
