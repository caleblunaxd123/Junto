# 11 · Prueba lado a lado: Splitwise vs JUNTO (emulador Android, 14–15 oct 2026)

Método: misma tarea en las dos apps, como persona nueva, en el emulador `emulator-5554`.
**Tarea:** «Pagué una cena de S/ 120 para 4; luego Andrea pagó un taxi de S/ 30. ¿Quién le debe a quién?»

- **Splitwise 26.9.1:** APK aportada por el dueño, firma verificada como auténtica. El dueño inició sesión
  con su cuenta. Solo se observó: se creó un grupo vacío «Prueba QA borrar» sin miembros y no se guardó ningún
  gasto ni se invitó a nadie. El grupo queda en la cuenta del dueño para que lo borre él. No se guardan
  capturas de Splitwise en el repositorio.
- **JUNTO:** variante local `com.junto.app.qa` (convive con la beta), API y base locales, cuentas ficticias.
  Capturas en `screens/native/`.

## Lo que hace mejor Splitwise (observado)

1. **Tour de 3 pantallas deslizables.** Cada una tiene una idea, una frase y un trozo de la interfaz real
   («Overall, you are owed…», el campo de gasto, «You paid…»). Se entiende mirando, sin leer párrafos.
2. **Una pregunta después del tour:** «¿Qué quieres hacer primero?» con dos botones concretos (viaje u hogar).
3. **Habla de personas, no de totales:** «David owes you $100», «You owe Brooklyn S.».
4. **Formulario de gasto mínimo.** Descripción y monto, y una frase: «Paid by **you** and split
   **equally**». Las palabras en negrita abren el detalle. Fecha, foto y nota son iconos abajo.
5. **Estados vacíos con una sola acción principal** («You're the only one here!» → «Add group members»).

Donde JUNTO ya era mejor: se puede probar **sin cuenta** (Splitwise exige registrarse antes de ver nada),
admite personas solo por nombre, usa Yape/Plin con confirmación del receptor, y el cálculo y la explicación
son más transparentes.

## Qué mareaba en JUNTO (antes) y qué se cambió

| Antes | Después |
|---|---|
| Bienvenida: 1 pantalla con 3 párrafos | **Tour de 3 pantallas** propias (quién debe a quién · anota un gasto · quedan a mano), cada una con vista previa real (`native/01–03`) |
| Grupo: «Total gastado», barra, «Deudas pagadas: S/ 100 de S/ 495.01», «Te deben S/ 395.01» | **«Marco te debe S/ 182.51», «Lucía te debe S/ 182.50», «y 1 más»**; el total queda en una línea pequeña (`native/08`) |
| Burbuja de gasto: «Pagó tú» + «Tu parte: S/ 20.00» (hay que restar) | **Una línea con el efecto:** «Pagaste · te deben S/ 90.00» / «Pagó Andrea · le debes S/ 7.50» / «no te toca» |
| Agregar gasto: aviso de borrador, monto, descripción, fecha, pagador, personas, 4 modos y cuadrícula a la vista | **Monto + descripción + una frase:** «Pagaste tú y se divide en partes iguales entre 4 personas · S/ 30.00 cada uno · te deben S/ 90.00» y «Cambiar quién pagó o cómo se divide» (`native/05–06`). Fecha, categoría y nota en «＋ Hoy · Categoría y nota». El aviso de borrador solo aparece si se recuperó un borrador o hay un problema. |
| Tarjeta morada grande «Marco, Lucía deben y aún no tienen JUNTO» en cada visita | Una línea discreta: «Marco y Lucía no tienen JUNTO · Enviar su enlace» |
| Icono de cubierto incluso para «Taxi» | El icono sigue la categoría sugerida |

Medición de la tarea en JUNTO después del cambio: cena = monto, descripción y guardar (**3 interacciones**
desde el grupo); taxi pagado por otra persona = monto, descripción, «Cambiar», elegir a Andrea y guardar
(**5**). Ningún paso exige entender porcentajes ni cuadrículas.

## Defectos nativos encontrados en el emulador (solo visibles en Android)

NativeWind 4 descarta el `style` en forma de función de `Pressable` en Android. Efectos:

- La hoja «¿Qué quieres agregar?» de la **beta publicada** perdía la fila, el borde y el relleno de cada
  opción: icono, texto y flecha quedaban apilados (`native/12` → `native/13`). **Corregido.**
- Las reacciones con emoji del menú de un mensaje perdían su tamaño. **Corregido.**
- La tarjeta de balance nueva tenía el mismo problema antes de corregirse (`native/14` → `native/04`).
- Regla nueva del sistema de diseño: en `Pressable`, estilo estático con estado de pulsación o hover manual,
  nunca `style={({ pressed }) => …}`.

## Validado en el emulador (nativo, API local)

Tour · Inicio con balance · participaciones (vista previa y guardado exacto: 100.01 → 40.01/20.00×3, comprobado
en la base) · «Cuentas explicadas» con Simplifica y gastos por categoría (netos comprobados a mano) · confirmar
un pago (queda `exitoso`, resuelto por el receptor) · «Registrar pago» directo al único grupo con deuda ·
gasto simple y gasto con otro pagador.

## Pendiente

- Una sola pregunta al terminar el tour («¿Viaje, depa o salida?») que cree el grupo con su tipo.
- Icono por categoría en las burbujas del chat (requiere que la API envíe la categoría).
- Pruebas con 3–5 personas reales (lo de hoy es una evaluación heurística, no un estudio con usuarios).

## Recorrido desde cero y decisión «persona a persona» (15 oct 2026)

El dueño creó con JUNTO un grupo nuevo («Paseo a Lunahuaná»: Sofía, Ana, Luis y Marta) como usuario. Sofía
pagó un almuerzo de S/ 200 y Ana una gasolina de S/ 80, ambos entre 4.

**Lo que confundió y se corrigió:**

1. «Ana te debe S/ 50» se leyó como «Ana gastó 50». Ahora el encabezado dice el **por qué**: «Pagaste S/ 200.00
   · a cada uno le toca S/ 50.00», y agrupa las deudas iguales: «Ana, Luis y Marta te deben S/ 50.00 cada uno».
2. Con el segundo gasto, JUNTO mostraba el plan **simplificado**: «Luis te debe 70, Marta te debe 60» (y Marta le
   paga 10 a Ana). El dueño razonó **persona a persona**: «Ana me debía 50 y yo le debo 20 → Ana me debe 30».
   Los dos planes mueven el mismo dinero, pero el simplificado no se entiende.
   **Decisión del dueño:** persona a persona por defecto, simplificar como opción del grupo (como Splitwise).
3. La burbuja «Pagó Ana · le debes S/ 20» contradecía el saldo compensado. Ahora cada gasto dice solo
   «Pagó Ana · tu parte S/ 20.00» y lo que se debe al final está en el encabezado.
4. «Creaste el grupo» + tres «Se agregó a X por su nombre» → una línea: «Creaste el grupo con Ana, Luis y Marta».
5. El grupo vacío repetía «Agregar gasto» tres veces; se quitó el del encabezado.
6. Inicio con grupos ya no muestra la tarjeta grande «Dividir gastos» (está en «+») ni «Mis borradores» si no hay borradores.
7. La tarjeta del grupo en Inicio decía solo el neto («Te deben S/ 10») a quien debe y le deben a la vez; ahora
   dice ambas cosas («Te deben S/ 40 · debes S/ 30»).

**Cómo funciona ahora (implementado y probado):**

- `Grupo.simplificarDeudas` (migración `20261017000000_group_simplify_debts`): los grupos **existentes quedan en
  `true`** (no cambian deudas ya conversadas); los **nuevos, `false`** (persona a persona).
- `calculateAccounts(..., simplify)`: `saldos` es el plan del grupo; además devuelve `deudasDirectas` y
  `saldosSimplificados`. Ambos liquidan exactamente el saldo neto de cada persona.
- Pagos: en grupos persona a persona, el límite de un pago es la deuda **con ese receptor** (`payableLimit(...,
  pairs)`, mismo código en API y app). Ana, que en neto «le deben», puede pagarle a Sofía sus S/ 30, no 30.01.
- «Editar grupo» → «Simplificar pagos» (solo administración); bloqueado mientras haya pagos por confirmar.
- «Cuentas explicadas» ofrece «¿Menos pagos?» con cuántos se ahorrarían.

**Validado en vivo con dos perspectivas a la vez** (misma API y base locales): Sofía en el emulador y Ana en la
web (navegador del panel). Ana vio «Marta y Luis te deben S/ 20.00 cada uno / Le debes S/ 30.00 a Sofía»,
registró un Yape de S/ 30 (el monto mal escrito «30.0030» fue rechazado por la app), Sofía lo vio al instante
como «Esperando tu confirmación», lo aprobó y «Ana te debe S/ 30.00» desapareció en ambas pantallas.

Pruebas: `apps/api` 90/90 (incluye el ejemplo del dueño), `ops/test-mobile-ux.cjs` 17/17 (límite por pareja),
`ops/test-shares-simplify.cjs` con el caso completo por HTTP, y las 10 integraciones de dinero en verde
(`test-redesign` ahora crea su grupo con `simplificarDeudas: true`, porque verifica justamente ese plan).

**Para producción:** requiere aplicar la migración y desplegar API y app juntas (una app antigua contra la API nueva
mostraría el plan persona a persona, pero validaría los pagos con la regla neta en el teléfono; la API manda).
