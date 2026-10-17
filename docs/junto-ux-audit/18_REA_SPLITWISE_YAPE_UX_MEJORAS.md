# 18 · Análisis REA (Splitwise · Yape · JUNTO) y Mejoras Profundas de UX

> Registro previo a la distribución elegida después por el dueño. La implementación
> vigente está en [19 · Cuentas y chat](19_DISTRIBUCION_CUENTAS_CHAT_20261017.md):
> Crear grupo permanente, cuentas primero y voz/boleta desplegables después del
> formulario. Las cifras de toques y evidencias de este registro no se repitieron
> como medición en la publicación 1.7.0; no describen su distribución final.

## 1. Evidencia recolectada con REA (Reverse Engineering Assistant v6.5.0)

Se ejecutó **REA v6.5.0** (`https://github.com/morluto/rea`) junto con las herramientas del Android SDK (`adb` 37.0.0 y `aapt2` build-tools 36.0.0) sobre el emulador activo (`emulator-5554`), el APK local de Splitwise y el código fuente móvil de JUNTO:

| Objetivo | Operación REA / SDK | Evidence ID / Hash | Hallazgos principales |
|---|---|---|---|
| **Emulador Android (`emulator-5554`)** | `rea inspect-adb-device emulator-5554` | `ev_b2d340c4b531850f5c92caa77055b7eb8e840a24f8badcd73e1ff5532130ff84` | Android 16 (SDK 36), `sdk_gphone64_x86_64`, parche `2026-01-05`. |
| **JUNTO instalado (`com.junto.app`)** | `rea inspect-adb-package emulator-5554 com.junto.app` | `ev_46a7f2594a383547eefe78549809afa1222625fafd0962dc7b50a3d3d6439f90` | `versionName: 1.6.0`, `versionCode: 11`, 34 permisos declarados (`CAMERA`, `RECORD_AUDIO`, etc.). |
| **Splitwise instalado (`com.Splitwise.SplitwiseMobile`)** | `rea inspect-adb-package emulator-5554 com.Splitwise.SplitwiseMobile` | `ev_6f7ad56ee87b9d247a7518dc414a56905bf16f9d1b5cd86ae3dc4531547c394d` | `versionName: 26.9.1`, `versionCode: 963`, 18 permisos declarados. |
| **APK de Splitwise (`splitwise-26-9-1.apk`)** | `rea inspect-artifact` + `aapt2 dump xmltree` | `ev_f2dd4f0a44947d3f303cc4465b56980452a5c2be6d976dcf5bae7124da1a08f4` (`sha256: 348cc3a1...6dcfc0cfb3`) | 3,108 nodos en el grafo de artefacto. Actividades clave: `AddExpenseScreen`, `AddPaymentActivity`, `SelectPeopleWizard`, `ImageCaptureScreen`, `CropImageActivity`, `LiveSplitsFlow`, y metadatos ML Kit Vision (`ocr, ica`). |
| **Captura en vivo del emulador** | `rea capture-adb-screen emulator-5554` | `ev_19f018c33ba803908c5ac7a662668f3f3e1e3a3b90e5cc2f2ab4336eb06e340f` | Resolución `1080x2400`, SHA-256 `f045ddf4...125345e2f`. |
| **Código fuente móvil (`apps/mobile`)** | `rea analyze-javascript-application` | `ev_771de30e43e5bbf2679b1a3ee50b39f591b0fc50f6d3ac36f0bb4e32c1bbd924` | Reconstrucción estática del grafo (`agm_56d847ec...`, 1,444 nodos) sobre `app/(app)/gastos/agregar.tsx`, `app/(app)/cuentas/rapida.tsx` y `src/components/BalanceSummary.tsx`. |
| **Yape (`com.bcp.innovacxion.yapeapp`)** | Verificación de entorno + integración en `pagos/pagar.tsx` | *Sin APK local en disco ni en el emulador* | No existe APK de Yape en el equipo ni en `emulator-5554`. Se analizó la integración nativa en `pagos/pagar.tsx` (`expo-intent-launcher` hacia `com.bcp.innovacxion.yapeapp`, copiado de celular y lectura OCR en `/pagos/comprobantes`) junto con los principios UX de Yape (monto gigante al centro, acciones de 1 toque y confirmación visual inmediata). |

---

## 2. Comparativa de Patrones UX: Splitwise vs. Yape vs. JUNTO

1. **Entrada rápida de gastos (`AddExpenseScreen` + `ImageCaptureScreen` + `LiveSplitsFlow` en Splitwise)**:
   - En Splitwise, la cámara y la división en una frase («Pagaste tú y se divide en partes iguales») están en el primer nivel de `AddExpenseScreen`. Sin embargo, el escaneo de recibos e itemización en Splitwise suele estar restringido a Splitwise Pro.
   - En JUNTO, el dictado por voz (`ExpenseDictation`) estaba oculto dentro de «Más opciones» → «Escribir o dictar un gasto» → «Dictar gasto con voz» (hasta 8 toques para guardar), y el lector de boletas (`useReadReceipt`) solo existía en «Dividir una cuenta rápida» (`cuentas/rapida.tsx`), pero **no** dentro de «Agregar gasto» de un grupo (`gastos/agregar.tsx`).
2. **Claridad visual para cualquier edad (inspiración Yape)**:
   - Yape destaca por tener **un solo foco visual por pantalla**, montos grandes, estado al día evidente y botones con verbos cotidianos («Yapear», «Escanear QR»).
   - En el Inicio de JUNTO (`BalanceSummary.tsx`), cuando el usuario tenía `Te deben S/ 0.00` y `Debes S/ 0.00`, no había una insignia visible que confirmara de inmediato `✓ Estás al día`, ni un acceso directo de 1 toque para `Dividir boleta`.
   - En «Crear grupo» (`grupos/crear.tsx`), el selector completo de país y moneda aparecía antes que `¿Quiénes participan?`, empujando la lista de personas hacia abajo cuando se abría el teclado.

---

## 3. Mejoras de UX Implementadas

### A. Barra de Llenado Rápido en 1 Toque en «Agregar gasto» (`apps/mobile/app/(app)/gastos/agregar.tsx` + `ExpenseDictation.tsx`)
- **Acceso directo arriba del monto** (sin entrar a «Más opciones»):
  - **🎤 Dictar con voz**: Abre `ExpenseDictation` en 1 toque.
  - **📷 Foto a boleta**: Toma foto de la boleta desde el formulario de gasto del grupo, propone el total con `useReadReceipt` (`/cuentas-rapidas/leer-boleta`), muestra candidatos si hay ambigüedad y permite **anotar los productos leídos en la nota del gasto** o cambiar en 1 toque a **Repartir por consumo de cada uno**.
  - **🖼️ Subir boleta**: Permite elegir una foto o captura de boleta desde la galería.
  - **✨ Escribir o dictar un gasto**: Despliega el asistente de frase natural directamente en la parte superior.
- **Autocompletado en 1 toque desde el dictado (`ExpenseDictation.tsx`)**:
  - Se añadió el botón principal **«Completar formulario con esta frase»** (`onUseAndPrepare`), que toma el texto dictado y ejecuta `prepare(value)` inmediatamente para rellenar monto, descripción, quién pagó y participantes en un solo paso (conservando «Usar este texto» para quienes prefieran editar la frase antes).

| Flujo del usuario | Antes (pasos) | Ahora (pasos) | Reducción |
|---|---|---|---|
| **Dictar un gasto por voz en un grupo** | 8 toques (Scroll → Más opciones → Escribir o dictar → Dictar con voz → Empezar → Usar texto → Completar formulario → Guardar) | **3–4 toques** (Dictar con voz → Empezar → Completar formulario con esta frase → Guardar) | **−50 % de pasos** |
| **Escanear una boleta dentro de un grupo** | No disponible en `gastos/agregar.tsx` | **3 toques** (Foto/Subir boleta → Revisar total/productos propuestos → Guardar) | **Nuevo flujo directo** |
| **Crear un grupo con amigos** | Nombre → Scroll pasando País y Moneda → Agregar personas → Crear | **Nombre → Agregar personas (arriba del pliegue) → Crear** | **0 scroll inicial** |

### B. Tarjeta de Cuentas en Inicio (`apps/mobile/src/components/BalanceSummary.tsx` y `CreateSheet.tsx`)
- **Insignia `✓ Estás al día`**: Cuando `owed === 0`, `owes === 0` y no hay pagos pendientes de confirmar, `BalanceSummary` muestra claramente `✓ Estás al día` junto a «Tus cuentas».
- **Acción directa `Dividir boleta`**: Tanto en la barra inferior de `BalanceSummary` como en el botón flotante `+` (`CreateSheet.tsx`), se incluye acceso en 1 toque a **«Dividir boleta»** (`/(app)/cuentas/rapida`).

### C. Creación de Grupo Más Limpia (`apps/mobile/app/(app)/grupos/crear.tsx` y `GroupCurrencyPicker.tsx`)
- Se reordenó `¿Quiénes participan?` inmediatamente debajo de `Nombre del grupo`, para que las dos preguntas esenciales (nombre del plan y nombres de las personas) estén juntas en la primera pantalla.
- Se compactó `GroupCurrencyPicker` en una fila adaptable de dos tarjetas (`País del plan` y `Moneda del grupo`) manteniendo intactas todas las etiquetas de accesibilidad y el soporte multimoneda.

### D. Claridad al Subir Comprobante desde el Chat (`apps/mobile/app/(app)/pagos/pagar.tsx`)
- Cuando el usuario entra desde el clip del chat del grupo (`subir=1`), el botón principal destaca como acción primaria **«Subir comprobante del pago»**, mientras que en la entrada estándar se mantiene como **«Adjuntar comprobante (opcional)»**.
