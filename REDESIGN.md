# JUNTO — implementación basada en referencias

Fecha: 6 de octubre de 2026. Proyecto: `C:/Proyectos/Junto`.

## Alcance visual

Se reconstruyeron componentes nativos editables a partir de las diez capturas del usuario: onboarding, inicio, grupo, agregar gasto, cuentas explicadas, registrar pago, crear grupo, bienvenida vacía, perfil y autenticación. No se usan capturas completas como interfaz. Fondo marfil, tarjetas blancas, verde esmeralda, texto azul marino, lila y coral; tipografía Plus Jakarta Sans.

El diseño está implementado, pero todavía no está certificado como idéntico píxel por píxel en todas las pantallas y tamaños. Los importes, fechas, nombres, estados y número de miembros reflejan datos reales, no los valores decorativos de los mockups. Se corrigieron las inconsistencias financieras de las referencias. Formularios desplazables y controles accesibles tienen prioridad sobre recortar contenido para simular una captura.

Las ilustraciones tienen movimiento decorativo suave. La animación se detiene en segundo plano, en pantallas sin foco y con reducir movimiento. Los importes y controles no se mueven.

## Contrato financiero

- Total gastado: suma de gastos del grupo. Un pago entre personas no aumenta este total.
- Tu parte: suma de las asignaciones individuales de cada gasto, no necesariamente total dividido entre miembros.
- Pagaste: dinero que adelantaste para gastos del grupo.
- Saldo: pagaste menos tu parte, ajustado únicamente por pagos confirmados.
- Reportar un pago no elimina una deuda. Solo el receptor puede confirmar que recibió el dinero.
- JUNTO no almacena ni transfiere dinero. Yape, Plin, efectivo y transferencias se realizan fuera de JUNTO.
- La propuesta del asistente necesita revisión y guardado explícito. Los cálculos usan centavos enteros y conservan el último céntimo.

## Evidencia y comprobaciones

- API: compilación TypeScript y 26 pruebas de dominio/validación aprobadas.
- Mobile: cuatro pruebas de lógica adicionales (`ops/test-mobile-ux.cjs`) sobre soles/centavos, reparto, resumen por grupo y destino de invitación.
- Mobile: typecheck y lint aprobados sin errores ni advertencias de lint.
- `ops/test-redesign.cjs`: prueba de integración local con cuentas ficticias; registro, verificación OTP, restricciones de membresía, invitaciones a usuarios registrados, gastos/divisiones, pago pendiente, autorización exclusiva del receptor, confirmación única, actividad y perfil.
- La integración obtiene el OTP exclusivamente de la base LOCAL de pruebas. No acredita entrega real de correo.
- Android, emulador `emulator-5554`: inicio de sesión manual, bienvenida de usuario nuevo, creación de grupo, selección manual de invitados, gasto manual S/ 120 / tres = S/ 40 cada uno, propuesta de taxi de Ana S/ 60 / tres = S/ 20 y guardado.
- Resultado Android comprobado: total S/ 180, parte S/ 60, pagado S/ 120, por cobrar S/ 60; Ana al día y Luis debe S/ 60.
- Android: perfil y cerrar sesión comprobados; login posterior de Luis sin datos de sesión del propietario. Registro de pago ficticio S/ 60 mostrado como pendiente con línea de estado y deuda aún vigente. La comprobación posterior encontró que la nota escrita no se persistía; se corrigió y se añadió una prueba de persistencia e historial, y otra de rechazo de duplicados aunque cambie la nota.
- Se corrigieron botones sin fondo/tamaño nativo, portada de grupo estirada, formulario reutilizado con el gasto anterior y actualización de grupo al volver.
- `ops/test-security-ux.cjs`: integración LOCAL aprobada para consumo único concurrente de OTP, rotación única concurrente de refresh, recuperación con invalidación de sesiones anteriores, separación entre códigos de registro/recuperación y límite de cinco intentos. También comprueba registro simultáneo de pagos sin duplicados, pagos parciales, edición de monto/fecha/partes/nota y permisos de miembros retirados/comprobantes. La vista previa de invitación exige sesión y devuelve solo nombre, tipo y cantidad de miembros, sin saldos ni datos personales.
- Android de esta iteración: resumen global separa por cobrar y por pagar; reabrir un pago existente muestra su estado pendiente sin otro botón de registro. Corrección manual de `Cena_QA_revisada` conserva el mismo ID, S/ 120 total y S/ 40 para cada persona; el grupo sigue con dos gastos. Reabrir la corrección carga los datos guardados y abrir Agregar gasto deja el formulario nuevo vacío.
- Android: invitación abierta sin sesión, inicio de sesión manual de una cuenta ficticia sin grupos y regreso automático a la invitación original. Antes de aceptar se muestran nombre del grupo y cantidad de integrantes, sin añadir a la persona automáticamente.
- Android: aceptación manual comprobada; el grupo pasa de tres a cuatro personas, conserva sus S/ 180 y las partes anteriores. La persona nueva ve “Tu parte S/ 0.00” junto a una explicación explícita de que entrar no redistribuye gastos anteriores. Las dos integraciones se repitieron después de actualizar las dependencias críticas.
- Nuevo resumen “Tus cuentas, claras”: cada monto conduce a su explicación por grupo. Un fallo de carga no se representa como deuda cero. Los pagos pendientes no descuentan saldos ni se presentan como dinero disponible.
- Invitaciones retenidas durante login, registro y verificación; aceptación explícita, posibilidad de no unirse y vista previa del nombre del grupo antes de aceptar.
- Recuperación con reenvío independiente, espera visible de 60 segundos y confirmación de cierre de sesiones anteriores. Registro informa si el servicio de correo rechazó el envío y mantiene la cuenta sin verificar.
- Asistente: límite de 15 segundos en gateway / 20 segundos en cliente, botón Continuar manualmente y cancelación de propuestas tardías al editar el formulario. No se puede guardar una respuesta tardía automáticamente.
- No se ha completado una certificación visual exhaustiva de todas las pantallas ni pruebas de producción.

Capturas locales de referencia de la ejecución: `emulator-reference-home.png`, `emulator-reference-group.png`, `emulator-reference-empty.png`, `emulator-reference-expense.png`, `emulator-reference-accounts.png`. Pueden corresponder a iteraciones diferentes; no constituyen comparación automática de píxeles.

## Cuenta rápida de restaurante y cumpleaños

- Nueva cuenta independiente de los grupos: personas por nombre o solo cantidad, sin crear cuentas ficticias, consumir contactos ni exigir que todos se registren. Se guarda en PostgreSQL y solo su organizador autenticado puede consultarla y confirmar aportes.
- Reparto por consumos individuales o por partes iguales del total. Invitados no pagan; su consumo se comparte entre quienes aportan. Extras/propina se reparten entre aportantes y se conserva cada céntimo.
- Caso del usuario comprobado: seis platos de S/30 = S/180; Jaime invitado S/0; los otros cinco S/36 (S/30 de consumo + S/6 de invitado). El modo igual produce el mismo resultado sin escribir los platos.
- Cámara/foto JPG o PNG en soles: OCR real con Tesseract en la API, dos lecturas, propuesta editable y revisión explícita obligatoria antes de guardar. No se usa un LLM para sumar ni se infiere el total del mayor número de la imagen. Por ahora no extrae/asigna automáticamente cada plato, no procesa PDF ni verifica validez tributaria.
- La foto no se almacena como comprobante ni se envía a un servicio externo de IA. El primer uso descarga el modelo de idioma español y lo deja en caché temporal; necesita acceso a internet para esa descarga. La imagen se procesa en memoria del servidor. Máximo 4 MB/16 megapíxeles, un trabajo OCR a la vez, 4 intentos/minuto/usuario, plazo de 35 s y alternativa manual cancelable en móvil. Estos límites en memoria son para un proceso; producción con réplicas necesita coordinación compartida.
- Prueba OCR completa con boleta sintética explícitamente QA/no válida: reconoció TOTAL S/180.00, sin confundir subtotal, IGV, efectivo ni vuelto. En pruebas locales con modelo ya cargado, aproximadamente 0.9–1.0 s; no es una garantía de rendimiento de Contabo.
- La captura recortada de la tabla enviada por el usuario se leyó erróneamente como “Total 1820” pese a confianza 90. Se comprobó y endureció la propuesta: entero sin formato monetario no se rellena automáticamente. Esa captura ahora devuelve total nulo y obliga a escoger/corregirlo. La revisión sigue siendo necesaria incluso si la lectura parece clara.
- Android: foto QA seleccionada, S/180.00 rellenado por OCR, revisión, seis nombres de prueba, un invitado y cinco S/36 guardados. El recorte de foto dejó de ser un paso obligatorio. Capturas `emulator-quick-bill-scan-review.png` y `emulator-quick-bill-preview.png`.
- Atajo Android repetido con OCR: indicar únicamente seis personas, calcular S/30 por persona y guardar desde la tarjeta de cantidad sin llenar consumos, nombres ni instrucciones. Los campos opcionales siguen disponibles. Captura `emulator-quick-bill-fast-preview.png`.
- Mensaje con total, desglose por persona, instrucciones opcionales y estado manual, listo para compartir con el selector del sistema. Guardar no envía nada. No se enviaron mensajes ni dinero a terceros durante QA.
- Selector de compartir Android comprobado con el texto íntegro: total S/180 y seis partes de S/30. Se cerró sin escoger destino ni enviar (`emulator-quick-bill-share-chooser.png`).
- Confirmaciones exclusivas del organizador, actualización por versión, rechazo de ediciones con aportes ya confirmados y posibilidad explícita de corregir una confirmación. No hay detección automática de Yape/Plin, aportes parciales, notificaciones a invitados ni enlace público de la cuenta.
- `ops/test-quick-bills.cjs`: integración local aprobada para privacidad, reparto exacto, separación de deudas de grupos, confirmaciones concurrentes, versiones obsoletas/futuras, corrección de estado, validación de fotos y OCR real. Las integraciones anteriores de autenticación/grupos/pagos se repitieron y aprobaron.
- Tabla adicional aplicada solo a PostgreSQL LOCAL mediante `ops/sql/20261006-cuentas-rapidas.sql`; no se desplegó OCR ni esta migración en Contabo.

Referencias técnicas: [Tesseract API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [Expo ImagePicker SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/).

## Ilustraciones: archivos y prompts

Skill utilizada: `imagegen`. Modo: herramienta integrada, no CLI. Edición/extracción y generación guiadas por las capturas del usuario; archivos finales guardados en:

`C:/Proyectos/Junto/apps/mobile/assets/illustrations/`

Prompt común del conjunto: “Use case: background-extraction. Attached JUNTO screenshot is the edit target. Extract ONLY the specified subject. Reproduce the original soft rounded cartoon 3D identity, proportions, colors and materials. Remove UI, text, borders and other objects. Genuine transparent alpha, no invented text or watermark; crisp native app asset.” Las portadas conservan un fondo ilustrado y los sujetos indicados abajo concretan cada prompt.

| Archivo final | Sujeto / referencia / restricción del prompt |
| --- | --- |
| auth-couple.png | Mujer de lila y hombre con gorra beige mirando el teléfono; captura de autenticación; recorte transparente. |
| home-character.png | Hombre de cabello rizado y camiseta esmeralda con teléfono; inicio; transparente. |
| travel-hero.png | Tres amigos a la derecha y Machu Picchu; grupo; composición horizontal con espacio marfil a la izquierda para texto nativo. |
| avatar-caleb.png | Cabeza y hombros del hombre rizado; círculo pastel, transparencia exterior; sin manos ni teléfono. |
| avatar-ana.png | Cabeza y hombros de la mujer de pelo castaño, pendientes dorados y lila; mismo estilo. |
| avatar-luis.png | Cabeza y hombros del hombre con gorra beige al revés; mismo estilo. |
| type-travel.png | Maleta lila con sombrero beige; crear grupo; transparente. |
| type-home.png | Casa blanca con techo verde y planta; crear grupo; transparente. |
| type-other.png | Dados lilas, estrella y símbolo azul de añadir; crear grupo; transparente. |
| welcome-table.png | Trío reunido en mesa con recibo, teléfono y tazas; bienvenida; sin interfaz ni texto. |
| expense-food.png | Tazón de comida 3D redondeado; grupo; transparente. |
| expense-taxi.png | Taxi amarillo 3D redondeado; grupo; transparente. |
| create-group-friends.png | Cuatro amigos con mapa; crear grupo; sin paisaje y con transparencia. |
| cover-cusco.png | Machu Picchu y llama, portada cuadrada ilustrada; inicio; fondo completo. |
| assistant-reference.png | Extracción de la mujer original de la captura de agregar gasto, descrita con el prompt completo siguiente. |
| accounts-paid-receipt.png | Hombre de cabello rizado y hoodie esmeralda sosteniendo el recibo, extraído de paso 3 de cuentas explicadas. Conservar cara, pose, mano y líneas del recibo; eliminar teléfono, texto, burbujas y UI; recorte transparente de cintura arriba. |
| accounts-result-thumb.png | Mismo hombre del paso 4, sonriendo y mostrando pulgar arriba; conservar identidad, proporciones, hoodie y mano; eliminar recibo, teléfono, texto, burbujas y UI; recorte transparente de cintura arriba. |

Prompt final de la asistente: “Use case: background-extraction. Edit target is attached JUNTO add-expense reference. Extract ONLY the large smiling woman in purple pointing at the phone from the left side of the top assistant banner. Reproduce her exact ORIGINAL cartoon 3D face, large eyes, smiling mouth, gold hoop earrings, long brown hair, lilac ribbed sweater, hands, dark purple phone and pose. Preserve her rounded toy-like proportions, NOT realistic or fashion-doll style. Remove all UI, text, stars, panels, speech bubbles and background. Tight waist-up cutout fills canvas, genuine transparent alpha outside her silhouette, no halo or extra props. This asset will be the same assistant in all native screens.”

Las variantes anteriores no se borraron. Los avatares predeterminados son ilustraciones, no fotografías reales de usuarios. Los componentes usan un mapa central de assets en `apps/mobile/src/components/ui/Artwork.tsx`.

## Refinamiento de cuentas rápidas y mensajes · 6 de octubre de 2026

- Inicio separa dividir una cuenta puntual de organizar un grupo continuo. El reparto rápido tiene tres pasos (cuenta, personas, reparto), partes iguales predeterminadas, invitado que no paga y revisión explícita del total leído por OCR.
- Borrador local por usuario y cuenta, recuperación al volver, solicitud idempotente y reintento manual con conexión. Una solicitud sin respuesta no se interpreta como guardada ni se duplica; no hay sincronización automática de dinero.
- Aportes parciales acumulados, pendientes exactos, historial y archivo sin borrar registros. La migración aditiva se aplicó solo a PostgreSQL local. Compartir ofrece mensaje y tabla PNG paginada; se verificó el selector de Android y se canceló sin enviar a destinatarios reales.
- Iconos de marca válidos sustituyen referencias a imágenes de un píxel; configuración de distribución exige API HTTPS y canales reales de privacidad, soporte y eliminación. Esto prepara la configuración, no implementa eliminación de cuentas ni certifica publicación.
- Los avisos propios ya no usan `Alert` nativo: componente común `AppDialog` con tarjeta redondeada, tipografía Jakarta, icono, botones de confirmación/cancelación y coral para acciones destructivas. Ayuda del perfil y errores en línea usan el mismo lenguaje visual. Los permisos del sistema conservan su interfaz de Android.
- La confirmación de aporte destaca persona y total acumulado, importe anterior y pendiente posterior, y aclara que JUNTO no cobra ni transfiere. Cola de mensajes, bloqueo durante acciones asíncronas, manejo de fallos y cancelación con Atrás sin ejecutar la confirmación.
- Android local: cancelación y Atrás conservaron S/10 de Gerson; confirmar S/25 dejó S/11 pendientes de su parte de S/36. Se revisaron avisos informativos y cierre de sesión (cancelado). Capturas: `emulator-dialog-contribution-v2.png`, `emulator-dialog-info-v2.png`, `emulator-dialog-logout-v2.png`.
- Verificación: typecheck y lint sin errores ni advertencias; 28 pruebas de dominio API, 4 de lógica móvil, 1 de configuración de distribución y 5 de diálogos. Las integraciones locales de cuentas rápidas, seguridad/UX y rediseño pasaron antes del cambio puramente visual de mensajes. No se ejecutó CI remoto ni se construyó una distribución firmada.
- La auditoría global más reciente reportó 51 alertas (32 altas, 18 moderadas, 1 baja, ninguna crítica), no una certificación de seguridad. Persisten los bloqueos descritos en `RELEASE_CHECKLIST.md`.
- Expo Go SDK54 en Android16 mostró un fallo nativo intermitente al abrir en frío enlaces a rutas internas. Abrir la URL base y navegar funcionó y conservó el borrador. No se ha resuelto ni comprobado aún en APK independiente; sigue siendo requisito de validación de distribución.

## Validación del total original · 6 de octubre de 2026

- Corregido el caso reproducido: total del paso 1 S/500 y consumos S/100 + S/50 + S/150 + S/70 + S/10 (S/380). Antes, el modo por consumos descartaba el total original y validaba solo su propia suma. Ahora muestra S/120 faltantes y bloquea revisión/guardado; no reduce el total ni distribuye diferencias sin autorización.
- Tarjeta de comparación con total original, consumos asignados, diferencia y progreso. Resumen fijo junto al botón durante los pasos de personas/reparto: el total no desaparece al desplazarse. Extras explícitos aparte, sin permitir usarlos para cubrir consumos faltantes.
- Validación reutilizable de total/consumos/extras, céntimos exactos, nombres vacíos/repetidos (acentos y espacios normalizados), todos invitados, campos pendientes, límites, metadatos y revisión de OCR. Errores junto al campo y bloqueo por paso, también al guardar; mutex durante persistencia/envío evita la ventana de doble envío.
- Servidor exige total original en escrituras nuevas y valida la misma igualdad independientemente del cliente. Registros antiguos sin total original siguen legibles: no se fabricó ni modificó una boleta histórica.
- Refuerzo de porcentajes (0–100, máximo 2 decimales, sin convertir vacíos a cero), gastos por montos/porcentajes explícitos, pagos acotados, edición vacía rechazada, registro sin nombres de espacios y guardas de perfil/grupo. La fecha predeterminada de cuentas nuevas usa Lima; no se reescriben nombres de borradores existentes.
- Android: diferencia S/120 y botón deshabilitado comprobados; prueba temporal de Persona 5 S/130 permitió reparto de S/500; se restauró su valor S/10 y quedaron intactos los cinco consumos originales. No se guardó ni envió ese reparto. Capturas `emulator-validation-500-vs-380.png`, `emulator-validation-500-valid.png`, `emulator-validation-total-fixed.png`.
- 12 pruebas de regresión nuevas (7 móvil, 5 API). El total de pruebas unitarias es 50; typecheck, lint y compilación API pasan. Integraciones locales comprueban rechazo HTTP400 sin crear cuentas/gastos inválidos, además de privacidad, concurrencia, autenticación y pagos de prueba. No equivale a una auditoría completa ni a validación de producción/Play Store.

## Pendientes y limitaciones conocidas

1. SMTP configurado rechazaba credenciales (`535-5.7.8`): la entrega real de códigos de registro/recuperación no está verificada. No se deshabilitó la verificación para ocultar el problema. En esta ronda, la API LOCAL se inició con SMTP apuntando deliberadamente a un puerto local cerrado para probar el error sin enviar correos reales; no se modificó el SMTP de producción. Cambiar a credenciales válidas y comprobar entregas reales es requisito antes de publicar.
2. Parches de Prisma aplicados únicamente a PostgreSQL LOCAL. Producción requiere respaldo, revisión de duplicados y migración controlada; no se desplegó ni se modificó Cloudflare/Contabo.
3. Se actualizaron de forma compatible `proxy-addr` (2.0.7 → 2.0.8) y `shell-quote` (1.8.3 → 1.12.0). Antes del OCR, `npm audit --omit=dev` pasó de 60 alertas / 2 críticas a 56 alertas / 0 críticas. La comprobación global posterior a instalar las dependencias del OCR reporta 58 alertas / 0 críticas (36 altas, 20 moderadas y 2 bajas); las cifras de la instalación limitada a un workspace no sustituyen esta comprobación global. Persisten dependencias del ecosistema Expo/React Native y otras; no es una certificación de seguridad ni implica que todas las alertas sean explotables en la app publicada. La simulación `npm audit fix --dry-run` encontró un conflicto de resolución Expo/linear-gradient (`ERESOLVE`); no modificó paquetes. No se aplicó `audit fix --force` ni una actualización mayor de Expo sin pruebas de compatibilidad.
4. No hay Google OAuth configurado, carga de comprobantes/OCR en producción ni miembros ficticios con nombre que puedan operar como usuarios registrados. La corrección de gastos está disponible desde su detalle; los administradores activos pueden editar nombre, tipo y descripción del grupo sin cambiar el libro de cuentas. No se implementaron transferencia de administración, eliminación/archivo de grupos ni gestión completa de roles.
5. Ubicación, apariencia y algunas preferencias del perfil son información, no opciones persistentes que aparenten funcionar.
6. Falta certificación de invitaciones con enlaces HTTPS universales y APK instalado, además de regresión en iOS y tamaños de pantalla distintos. Expo Go y pruebas locales no sustituyen producción.
7. Rate limit de autenticación en memoria de un proceso; despliegue con réplicas requiere almacenamiento compartido. Consumo OTP/refresh atómico e invalidación inmediata de JWT después de cambiar contraseña ya se probaron localmente. Falta una auditoría de seguridad de producción y pruebas de carga.
8. Las pruebas locales usan cuentas `@example.invalid`, sin pagos reales. No se publicaron APK, commits ni cambios remotos.
