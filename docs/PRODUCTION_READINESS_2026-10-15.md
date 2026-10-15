# JUNTO: revisión de la candidata del 15 de octubre de 2026

La revisión parte de la rama `feat/junto-2-persona-a-persona` y del estilo actual aprobado: esmeralda, menta y papel blanco. Incluye los cambios de identidad visual que ya estaban en el directorio de trabajo. No se importaron instrucciones del APK de referencia ni se realizaron pruebas con cuentas reales.

## Correcciones de esta revisión

- **Periodicidad:** «cada 15 días» suma 15 días. La búsqueda de una próxima fecha salta directamente al período solicitado, conservando el día mensual y el ajuste de meses cortos. Los presupuestos futuros ya no omiten gastos semanales por superar 40 ocurrencias desde su origen.
- **Registro automático:** cada gasto recurrente y su próxima fecha se guardan en la misma transacción. La regla se vuelve a comprobar bajo el bloqueo del grupo; pausar, eliminar o cerrar no puede dejar entrar un trabajador con información anterior. Un error a mitad de la recuperación conserva el avance confirmado y el reintento agrega solo lo que falta.
- **Reintentos y permisos:** una clave de envío se contrasta con la huella del contenido revisado, incluida su primera fecha. Reutilizarla con otros datos o en otro grupo devuelve conflicto; cambiar o borrar una programación exige que pertenezca al grupo indicado en la URL. Las reglas antiguas sin huella se rechazan de forma conservadora al reutilizar su clave, sin crear otra automáticamente.
- **Finalizar gastos:** cerrar o eliminar un grupo pausa inmediatamente las programaciones. Reabrir no las reactiva por sorpresa. No se admite reanudar gastos ni editar presupuestos durante la liquidación o tras el cierre. La interfaz explica este estado y conserva la consulta de cuentas.
- **Configuración:** el arranque de producción rechaza orígenes CORS mal formados, rutas, comodines y credenciales embebidas. La API termina las solicitudes en curso al recibir SIGTERM y desconecta la base con espera limitada. TypeScript de la API usa tipos de Node, evitando que declaraciones globales de React Native alteren la compilación del servidor.
- **Presentación:** «Te deben» y «Debes» se muestran por separado; importes grandes y presupuestos se acomodan a 320 px. El botón oficial de Google sigue el ancho del formulario. Se conservan la nueva bienvenida y el splash aportados por el propietario. La tipografía importa únicamente los cuatro pesos usados, evitando exportar el resto de la familia y manteniendo su apariencia.
- **Verificación continua:** CI incorpora estado de cuenta/exportaciones, cierre/historial, pagos recibidos con captura, recurrentes, presupuesto y correo de cuenta. Construye la web de producción, audita la imagen de API y prueba migraciones y arranque en contenedores efímeros. El test simulado de lectura de chat ya no puede recurrir a la base configurada en el equipo.
- **Repositorio:** se amplían exclusiones de entornos y firmas. Se revisan los archivos versionados y nuevos antes de subirlos; capturas, logs, tar de Docker y datos QA permanecen en `ops/artifacts/`, fuera de Git.

## Evidencia local

| Control | Resultado |
| --- | --- |
| Compilación API | Correcta |
| Pruebas de dominio | 104/104 |
| Pruebas de UX/configuración y servidor web | 115 correctas; 1 omitida porque no se publica un APK en este export |
| Integración con PostgreSQL local | 27 suites correctas: autenticación/eliminación, permisos, idempotencia, concurrencia, pagos, OCR/comprobantes, notificaciones simuladas, invitaciones, monedas, cuentas directas/simplificadas, PDF/Excel, ciclo de grupo, recurrentes, presupuesto y SMTP loopback |
| TypeScript y ESLint móvil | Correctos |
| Compatibilidad de paquetes con Expo | `expo install --check`: correcta |
| Export web de producción | Correcto; sin source maps y solo configuración pública |
| Interfaz del grupo finalizado | Export real revisado a 320, 390 y 1280 px: presupuesto consultable y recurrentes pausados, sin acciones de edición o reanudación ni desbordes |
| Imagen Docker de producción | Construida con Node 22 y el lockfile del repositorio |
| `npm audit` dentro de esa imagen | 0 vulnerabilidades |
| Migraciones desde base vacía | 27 aplicadas; `prisma migrate diff` vacío |
| Runtime | UID 1000, raíz de solo lectura, sin capabilities ni puertos publicados; rol `junto_app` con CRUD de tablas de aplicación, sin modificar migraciones ni crear esquema |
| Readiness y apagado | Base disponible → `/ready` 200; base detenida → 503 sin detalles; `/health` sigue vivo; SIGTERM termina con código 0 |

Las integraciones usaron cuentas ficticias y una base QA en loopback. El correo se capturó en SMTP local; las notificaciones se simularon. El test de imagen crea una red interna, una base nueva y una API, y retira únicamente esos contenedores al terminar. No se modificaron bases ni servicios de producción.

Para repetir los controles: `npm run build:api`, `npm test --workspace=apps/api`, `npm run typecheck --workspace=apps/mobile`, `npm run lint --workspace=apps/mobile`; las invocaciones exactas de pruebas y export están en `.github/workflows/quality.yml`. Las integraciones requieren una `DATABASE_URL` explícita a una base QA local migrada y un `JWT_SECRET` ficticio. Nunca cargar el entorno de producción para ejecutar pruebas.

La imagen se prueba con `docker build -f ops/contabo/Dockerfile -t junto-api:ci .` y `node ops/test-production-image.cjs junto-api:ci`. El audit del monorepo puede incluir avisos de herramientas Expo/Tailwind/observadores de archivos que no están en esta imagen; el control de producción audita los paquetes efectivamente enviados. No se aplicaron actualizaciones forzadas que cambien el SDK de Expo. El aviso de `braces` sin parche está documentado en [GitHub Advisory Database](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

## Alcance pendiente fuera de esta revisión local

El código y las construcciones técnicas no acreditan una publicación en tiendas. Siguen requiriendo ejecución real los recorridos físicos ya descritos en `RELEASE_CHECKLIST.md`: Google con el certificado de la build, adjuntos PDF/Excel y capturas en WhatsApp/correo, letra grande/TalkBack, dictado y recepción de push con la app cerrada. Tampoco se certifica aquí la entrega del proveedor de correo ni las declaraciones de Play Console.

El despliegue web/API debe utilizar respaldo restaurable, migraciones por el propietario de la base, revisión de CRUD de las tablas nuevas y smoke test del dominio, según `ops/contabo/README.md`. El push de GitHub conserva la candidata; no cambia el servidor ni distribuye una nueva APK.
