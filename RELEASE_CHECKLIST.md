# JUNTO — controles previos a publicación

## Implementado y verificable localmente

- Inicio distingue cuentas puntuales sin registro de invitados y grupos con cuentas personales.
- Reparto guiado en tres pasos, moneda PEN, enteros en céntimos, confirmación humana de OCR y cancelación/manual.
- Aportes acumulados parciales, protección de partes, historial de cambios y archivo solo sin pendientes.
- Reintentos de creación idempotentes y borradores por cuenta/usuario; ningún mensaje ni movimiento financiero automático.
- Mensaje breve y tabla PNG, previa revisión. Para más de diez personas se exportan páginas separadas.
- Icono 1024, foreground adaptativo, splash y notificación monocromática reales, derivados del logo existente.
- Perfiles EAS APK/AAB y rechazo de distribución sin configuración pública HTTPS/soporte.

## No publicar hasta resolver

1. Decidir responsable del tratamiento, dominio, correo de soporte y política de conservación. La eliminación de cuenta debe tener una implementación real y un canal web operativo; los accesos del perfil no sustituyen ese proceso.
2. Definir cómo anonimizar o conservar registros compartidos sin alterar deudas de terceros, y transferencia de administración cuando se elimina una cuenta. No ejecutar un borrado masivo improvisado.
3. Configurar SMTP sin exponer secretos y probar registro/verificación/recuperación con un correo real, incluyendo spam y reenvíos. Las pruebas locales no prueban entregabilidad.
4. Respaldar la base de producción, revisar/aplicar las migraciones nuevas y generar Prisma/build del backend. No se ha aplicado ninguna de estas migraciones al servidor remoto.
5. Revisar CORS, TLS, límites de requests distribuidos si hay varias instancias, gestión de secretos, backups/restauración y monitorización. Resolver o documentar con evidencia cada hallazgo de npm audit; no usar actualizaciones forzadas de Expo sin validar compatibilidad.
6. Compilar e instalar APK de distribución firmado y producir AAB con credenciales EAS/Android. Validar API objetivo vigente, permisos reales, soporte de páginas 16KB y todas las bibliotecas nativas en el artefacto resultante. Expo Go no valida estos puntos.
7. Probar dos dispositivos reales: invitación, registro, gastos, pago parcial, confirmación concurrente, recuperación de sesión, cierres/interrupciones, imagen compartida, accesibilidad TalkBack y fuente grande. Probar borradores de formularios de grupo/gasto, todavía no cubiertos por el nuevo borrador de cuenta puntual.
8. Publicar política de privacidad y formulario de eliminación, completar Data Safety y declaraciones financieras según el comportamiento real. Verificar requisitos de prueba cerrada aplicables a la cuenta de Play Console.

## Datos necesarios del propietario

- Dominio público y correo de soporte.
- Responsable/identidad de JUNTO y decisiones de conservación de datos.
- Acceso/configuración EAS y publicación Android; no pegar contraseñas en el chat.

Guías oficiales a revisar al publicar: https://support.google.com/googleplay/android-developer/answer/11926878, https://support.google.com/googleplay/android-developer/answer/13327111, https://support.google.com/googleplay/android-developer/answer/10787469 y https://support.google.com/googleplay/android-developer/answer/14151465.
