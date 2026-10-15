# 01 · Auditoría de la app actual (JUNTO, 14 oct 2026)

Base auditada: `main` en `eb9f504` más el trabajo sin commitear de la rama `codex/offline-items-push-20261011`
(productos de boleta y borradores offline), sobre el que se trabajó «encima». Método: lectura del código,
ejecución de todas las pruebas disponibles y capturas del mismo código React Native renderizado en web
a 390 px contra una API local con datos ficticios (`screens/before/`). No se usó la app de producción.

## 1. Stack y estructura

| Capa | Tecnología | Notas |
|---|---|---|
| App | Expo SDK 54, React Native 0.81.5, React 19.1, expo-router 6 | Rutas por archivos; 39 pantallas `.tsx` en `apps/mobile/app` |
| Web | react-native-web 0.21.4, export estático en `/app/` | Servido por `ops/web/server.cjs` con CSP estricta |
| Estado | @tanstack/react-query 5 (datos del servidor), zustand 4 (sesión) | Polling: chat 4 s, inicio 15 s, presencia 15 s |
| UI | `src/components/ui/Design.tsx` (paleta, `Label`, `Button`, `Card`, `Screen`, `Avatar`, `FeedbackBox`) | Plus Jakarta Sans; estilos en línea; NativeWind solo en 3 archivos |
| API | Express + Prisma + PostgreSQL | 11 routers, 22 servicios, 22 módulos de dominio con pruebas |
| Dinero | Céntimos enteros (`Int`), resto mayor, `packages/shared` compartido app/API | Sin flotantes para importes guardados |
| OCR | Tesseract en la API (sin IA externa para sumar) | Propuesta editable; revisión obligatoria |
| IA | `/ia/gastos/interpretar`: reglas locales deterministas primero, IA opcional | Nunca guarda sola |

Navegación: 3 pestañas (Inicio, Actividad, Perfil) + botón flotante «+» (hoja «¿Qué quieres agregar?»).
El grupo es una conversación tipo WhatsApp (decisión de producto reciente del dueño) con resumen fijado,
chips de acción y hojas para cuentas, recordatorios y pagos.

## 2. Funcionalidades existentes (operativas)

- Registro, verificación por correo, recuperación, Google (app y web), eliminación de cuenta.
- Grupos con tipo (viaje, roomies, pareja, amigos, trabajo, deporte, otro), moneda inmutable (PEN, COP, USD, EUR, MXN, BRL), fecha límite, modo cobranza/división, aprobación de pagos (receptor o admin).
- Integrantes por nombre sin cuenta, enlace personal, unirse «como» un nombre, vincular.
- Gastos: igual, por montos, por porcentajes, «cuenta por partes»; categoría, fecha, nota, foto; idempotencia por `solicitudId`; edición y borrado lógico.
- Pagos externos (Yape, Plin, transferencia, efectivo): reportado → confirmado/rechazado por el receptor; pagos parciales; registro de dinero recibido; comprobante con lectura; pago en otra moneda con tasa acordada y fecha de referencia.
- Simplificación de deudas por grupo (neto por persona, emparejamiento voraz).
- Chat del grupo con respuestas, reacciones, fijar, presencia, avisos durables.
- Recordatorios amables (tono suave, límite de frecuencia), push.
- Cuentas de un día (restaurante/cumpleaños) con OCR del total, invitados y extras; pasar a grupo.
- Asistente de texto/dictado; «Probar sin cuenta».
- Borradores offline de gastos y cuentas (trabajo en curso, integrado aquí).

## 3. Defectos encontrados en esta auditoría

| # | Defecto | Evidencia | Estado |
|---|---|---|---|
| D1 | «Cuentas explicadas» mostraba una persona fantasma («Andrea S/ 0.00») cuando alguien se unía *como* un integrante por nombre: el libro incluía al integrante inactivo sin movimientos. 5 personas en un grupo de 4. | `screens/before/03-cuentas-explicadas-completo.png` | **Corregido** (`accounts.ts`) |
| D2 | Importes sin separador de miles: «S/ 1080.00». | `screens/before/02-grupo-chat.png` | **Corregido** (`formatMoney`: `S/ 1,080.00`) |
| D3 | En la web, react-native-web 0.21 ignora `accessibilityState`: 41 radios/pestañas/expandibles no anunciaban «seleccionado», «expandido» ni «deshabilitado» a lectores de pantalla. Hacía fallar `ops/test-payment-flow-web.cjs` en `main`. | aria-checked = null | **Corregido** (migrado a `aria-*`, válido en nativo y web) |
| D4 | «Registrar pago» era un callejón sin salida para quien cobra: solo decía «No le debes nada a nadie». | `screens/before/08-registrar-pago.png` | **Corregido** (ruta a «Registrar un pago que recibí») |
| D5 | Inicio no mostraba el balance general; estaba escondido tras «Ver cuentas». | `screens/before/01-home-completo.png` | **Corregido** (tarjeta de balance) |
| D6 | La simplificación era invisible: no se explicaba cuántos pagos ahorra ni cuáles eran las deudas originales. | — | **Corregido** («JUNTO Simplifica») |
| D7 | 7 componentes UI muertos duplicaban los de `Design.tsx` (`Button`, `Card`, `Input`, `GlassCard`, `GradientButton`, `MontoDisplay`, `Welcome`). | 0 importaciones | **Eliminados** |
| D8 | Dos pruebas web desactualizadas respecto a textos actuales (`test-web-beta`, `test-group-contribution-web`). | Fallan igual antes y después | Pendiente (actualizar pruebas) |

## 4. Funciones incompletas o ausentes

Gastos recurrentes, varios pagadores por gasto, archivo de grupos, búsqueda de gastos, tema oscuro,
háptica, exportación CSV, presupuesto de viaje/hogar, historial de ediciones visible. Detalle y prioridad
en `06_FEATURE_GAP_ANALYSIS.md`.

## 5. Modelo de gastos y balances

`Gasto` (un pagador `pagadoPor`, `montoTotal` en céntimos) + `GastoParticipante` (`montoAsignado` por persona;
la suma se valida igual al total). `Pago` con estados `reportado` → `exitoso` | `rechazado`; solo `exitoso`
cambia saldos. Neto por persona = pagaste − tu parte + pagos enviados − pagos recibidos. La confirmación usa
`updateMany` condicionado al estado (`where: { id, estado: "reportado" }`), por eso confirmar dos veces no
descuenta dos veces (probado). Monedas nunca se suman entre sí: el balance personal es por moneda.

Redondeo (explícito): método del mayor resto en céntimos; empates al primero en el orden de la lista.
La suma de partes es siempre exactamente el total (probado con 400 libros aleatorios).

## 6. Consistencia visual

Identidad sólida y propia: fondo marfil `#FFFCF7`, verde esmeralda, azul marino, lila y coral, Plus
Jakarta Sans, ilustraciones 3D. Inconsistencias: verdes en hex sueltos (`#007B60`, `#078B70`, `#00856A`)
en lugar de tokens; 3 escalas de radio cercanas (14/16/18/20/22/24); estados de carga con spinners
sueltos; botones primarios repetidos en una misma pantalla (p. ej. «Registrar pago»).

## 7. Responsive, accesibilidad y rendimiento

- Responsive: navegación lateral desde 1024 px, columnas en inicio, máximo de ancho en formularios. Bien resuelto.
- Accesibilidad: buenas etiquetas y objetivos táctiles ≥ 44 px; D3 rompía el estado en web; animaciones decorativas respetan «reducir movimiento».
- Rendimiento: `GET /grupos` calcula el libro de **cada** grupo por separado (N+1 consultas); el chat sondea cada 4 s. Aceptable en beta; ver `08_TECHNICAL_ARCHITECTURE.md`.

## 8. Deuda técnica

Dependencia `lucide-react-native` sin uso; NativeWind instalado para 3 archivos; pantallas largas
(`agregar.tsx` ~900 líneas, `grupos/[id].tsx` ~580) que mezclan lógica y vista; `react-native-reanimated`
instalado pero sin uso (las animaciones usan `Animated`). Muchas capturas `emulator-*.png` en la raíz del repo.
