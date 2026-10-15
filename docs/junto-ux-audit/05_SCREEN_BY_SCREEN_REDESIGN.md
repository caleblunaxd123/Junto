# 05 · Pantalla por pantalla

Capturas: `screens/before/` y `screens/after/`, mismo código React Native exportado a web, 390×844 (y
1440×900), API local con datos ficticios del «Viaje a Cusco». **No son capturas nativas**: la app instalada en
el emulador es la beta release que usa la API de producción, y no se reemplazó (ver `10_QA_RESULTS.md`).

## 4.1 Onboarding — sin cambios

Ya cumple: tres ideas (arma tu grupo, anota quién pagó, quedan a mano), «Probar sin cuenta», Google y correo.
Pendiente propuesto: mencionar explícitamente «Registrar pagos de Yape/Plin» y viajes/hogar en las tarjetas.

## 4.2 Inicio — **implementado**

| Antes | Después |
|---|---|
| `before/01-home-completo.png` | `after/01-home.png`, `after/01-home-completo.png` |

- Nueva tarjeta «Tu balance en grupos»: **Te deben**, **Debes** y **Balance neto** con signo, por moneda.
- Texto fijo: «El neto no es dinero disponible: es lo que te deben menos lo que debes. Las deudas de un
  grupo no se pagan con saldos de otro». Toda la tarjeta lleva al detalle por grupo.
- Accesos rápidos **Agregar gasto** y **Registrar pago** (directo al grupo si debes en uno solo).
- La lista de grupos carga con skeletons en lugar de un spinner.
- Pendiente: decidir si «Dividir gastos» (tarjeta grande) baja de nivel cuando ya hay grupos; mostrar
  «Mis borradores» solo cuando existan borradores.

## 4.3 Mis grupos — parcial

Las tarjetas ya muestran portada por tipo, avatares, número de personas, balance personal, pagos por
confirmar y no leídos. Falta: filtro activos/archivados (no existe archivo de grupos) y «última actividad».

## 4.4 Detalle de grupo (chat) — **skeleton al abrir**

Diseño tipo WhatsApp elegido por el dueño: se respeta. Cambios: importes con separador de miles
(`S/ 1,080.00`) y carga con la silueta del encabezado y burbujas en lugar de un spinner.

## «Cuentas explicadas» — **implementado**

| Antes | Después |
|---|---|
| `before/03-cuentas-explicadas-completo.png` | `after/03-cuentas-explicadas-completo.png` |

- Corregido: desaparece la persona fantasma con S/ 0.00 (defecto D1).
- **JUNTO Simplifica:** «Sin simplificar serían 5 pagos. JUNTO los reduce a 3, y cada persona paga o recibe
  exactamente lo mismo», con las deudas originales desplegables y la aclaración de que los pagos confirmados no se tocan.
- **En qué se gastó:** barras por categoría (importe, %, número de gastos) y «Quién adelantó el dinero».

## 4.5 Nuevo gasto — **implementado: participaciones**

| Antes | Después |
|---|---|
| `before/04-nuevo-gasto-completo.png` | `after/09-gasto-participaciones.png` |

- Cuarta forma de dividir, **Por participaciones**, con descripción corta en cada opción (rejilla 2×2,
  `radiogroup` accesible). Todos empiezan con 1; teclado numérico entero.
- Ejemplo de la captura: S/ 100.01 con Marco 2 y los demás 1 → S/ 40.01 / 20.00 / 20.00 / 20.00, «✓ La suma
  coincide hasta el último céntimo». No se puede guardar si alguna participación es inválida o todas son 0.
- Borradores offline aceptan el nuevo modo.
- Pendiente: varios pagadores (requiere cambio de modelo), divisiones por defecto por grupo.

## 4.6 Balance y deudas

«¿Quién debe a quién?» ya usaba avatares, importe y flecha («Lucía paga S/ 125.00 → Tú»). Se añadió la
comparación con las deudas sin simplificar. Pagos parciales y pendientes ya existían y se mantienen.

## 4.7 Registrar pago — **implementado para quien cobra**

| Antes | Después |
|---|---|
| `before/08-registrar-pago.png` | `after/08-registrar-pago.png` |

Si no debes pero te deben, aparece «¿Te pagaron a ti?» con el importe pendiente y «Registrar un pago que
recibí»; «Volver al grupo» pasa a botón secundario. Se mantiene la regla: un pago reportado se muestra como
**esperando confirmación**, nunca como «pago realizado».

## Actividad y Perfil — sin cambios

`after/06-actividad.png`, `after/07-perfil.png`. Pendiente: búsqueda y filtros en Actividad.
