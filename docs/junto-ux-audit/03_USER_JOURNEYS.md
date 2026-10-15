# 03 · Recorridos de usuario (JUNTO)

Interacciones contadas a partir del código y de las capturas (toques y campos escritos; abrir el teclado
no cuenta). «Después» refleja lo implementado en esta iteración.

## 1. Anotar un gasto común («Pagué la cena, somos 4, partes iguales»)

| Paso | Antes | Después |
|---|---|---|
| Entrada | Grupo → chip «Agregar gasto», o «+» → hoja → «Agregar un gasto» | Además: «Agregar gasto» en la tarjeta de balance de Inicio |
| Monto | escribir | escribir |
| Descripción | escribir (la categoría se sugiere sola) | igual |
| Pagador, personas, división, fecha | ya resueltos por defecto (tú, todos, iguales, hoy) | igual |
| Guardar | 1 toque | 1 toque |
| **Total** | **4 interacciones desde el grupo** | **4**; desde Inicio con un solo grupo, también 4 |

Fortaleza: valores por defecto inteligentes y vista previa por persona en vivo; no se puede guardar una
suma inconsistente. Fricción restante: el formulario es largo cuando se abren opciones avanzadas.

## 2. Dividir por participaciones (nuevo)

Monto → «Por participaciones» (todos empiezan con 1) → cambiar el 1 de quien corresponda (p. ej. 2 para una
pareja) → Guardar. La vista previa muestra al céntimo lo que guardará la API (mismo algoritmo, probado).

## 3. Pagar lo que debo (Yape/Plin/transferencia/efectivo)

Inicio → «Registrar pago» (si debes en un solo grupo va directo; si no, al resumen por grupo) → elegir a quién
(preseleccionado si es uno) → monto (sugerido) → método → «Hoy» por defecto → registrar. Queda **«Esperando
confirmación»**: nunca se muestra como pagado hasta que el receptor confirma. JUNTO no abre ni simula la
transferencia.

## 4. Confirmar un pago recibido

Inicio «Pago por confirmar» → «Revisar pago», o la tarjeta en el chat → «Sí, lo recibí» → diálogo de
confirmación explícito («Confirma solo si ya ves S/ 50.00 en tu cuenta»). 2–3 interacciones. Confirmar dos
veces no descuenta dos veces (la API rechaza el segundo intento).

## 5. Me pagaron en efectivo y quiero anotarlo (antes: callejón sin salida)

Antes: «Registrar pago» decía «No le debes nada a nadie» y solo ofrecía volver.
Después: tarjeta «¿Te pagaron a ti?» → «Registrar un pago que recibí» abre las cuentas del grupo, donde cada
deudor tiene su acción de registro. 2 toques hasta el formulario.

## 6. Entender quién debe a quién

Grupo → «Ver cuentas» → paso a paso (total, tu parte, lo que pagaste, tu resultado) → «¿Quién debe a quién?».
Nuevo: «JUNTO Simplifica» (p. ej. «Sin simplificar serían 5 pagos. JUNTO los reduce a 3») con la lista de
deudas originales desplegable, y «En qué se gastó» por categoría y por quién adelantó el dinero.

## 7. Unirse a un grupo por invitación

Enlace → (inicio de sesión o registro, la invitación se conserva) → «¿Eres alguno de ellos?» → «Unirme como
Ana». Corregido: tras unirse «como» un nombre, ese nombre ya no aparece duplicado con S/ 0.00 en las cuentas.

## 8. Ver mi situación general

Antes: Inicio mostraba pendientes y grupos; el total estaba en «Ver cuentas».
Después: la primera tarjeta dice «Te deben S/ 315.00 · Debes S/ 40.00 · Balance neto +S/ 275.00», aclara que
el neto **no es dinero disponible**, separa monedas y recuerda que la deuda de un grupo no se paga con el
saldo de otro.
