# Beta web para amigos — iPhone y Android

La misma interfaz Expo se exporta como SPA en `/app/`, en el dominio HTTPS de JUNTO.
No requiere Apple Developer, no es TestFlight y no instala una app nativa.
Puede añadirse a la pantalla de inicio. Requiere internet; no hay service worker ni
caché offline de datos financieros. Login Google y push nativo no se muestran en web.

La web es un canal independiente: publicar las apps nativas en las tiendas no la
desactiva. Las tres usan la misma API, cuentas y base de datos. En navegador desde
1024 px hay navegación lateral; los formularios tienen ancho máximo, inicio usa
columnas y las ventanas de compartir quedan centradas. En tamaños menores se
mantiene navegación móvil. Reducir/ampliar la ventana no remonta el navegador de
rutas ni borra una sesión o formulario. Participar en grupos sigue requiriendo
cuenta y correo verificado: no se ha habilitado un invitado anónimo con alias.

## Construir

En `apps/mobile`, configurar `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL` y URLs
legales/soporte públicas; `EXPO_PUBLIC_APP_ENV=preview`, `JUNTO_WEB_BASE_PATH=/app`.
Dejar `JUNTO_QA_KEYSTORE_PATH` vacío: un export web no usa firma Android de QA.

```sh
npx expo export --platform web --output-dir dist-beta
node ../../ops/web/prepare.cjs
```

Exportar solo variables públicas: nunca SMTP, JWT ni claves IA. El contexto del
Dockerfile permite únicamente el export y el servidor estático. Las credenciales
de web van a `sessionStorage` y se eliminan al cerrar sesión; no es almacenamiento
cifrado nativo. Mantener CSP y no añadir scripts analíticos externos.

## Comprobar antes de compartir

`node ops/web/server.cjs` sirve en loopback 8090. `node --test ops/web/test-server.cjs`
comprueba recarga SPA, límites de rutas, archivos ausentes y cabeceras de seguridad.
Con una base QA local migrada y JWT secreto ficticio, `node ops/test-web-beta.cjs`
usa Chromium y `JUNTO_QA_WEBKIT=true` usa WebKit. Todas sus llamadas se interceptan
y van a una API local con SMTP loopback: nunca pruebas ni correos en producción.
`JUNTO_QA_WIDTH=1440` inicia el recorrido en PC; ambos motores redimensionan a
360/390/768/1024/1440/1920, comprueban formularios, navegación y recuperación.
`ops/test-production-responsive.cjs` reutiliza exclusivamente la cuenta QA
autorizada ya existente y no envía correos ni crea cuentas/grupos/repartos.

`ops/test-account-email-api.cjs` prueba códigos, vencimiento, recuperación y sesiones.
`ops/test-share-email-api.cjs` prueba invitación externa, permisos, escape HTML,
deduplicación, límites y resultado incierto. WhatsApp abre un borrador: no es envío
automático ni prueba de entrega.

## Publicar en Contabo

Construir una imagen de etiqueta nueva; red privada `stack_web`, alias `junto-beta-web`.
No exponer puertos, usar volumen de solo lectura, usuario `node` y límites de recursos.
En **solo** el bloque Caddy de `junto.lunalav.pe`, enrutar `/app` y `/app/*` a ese alias:

```caddy
@beta path /app /app/*
handle @beta {
    reverse_proxy junto-beta-web:8080
}
handle {
    reverse_proxy junto-api:3000
}
```

Configurar en la API `BETA_WEB_URL=https://junto.lunalav.pe/app/` después de comprobar
la web: habilita el botón público y el destino de invitaciones. Conservar imagen y
configuración anterior para rollback. No modificar otros dominios, MX ni TLS de la zona.
No publicar la fuente, `.env`, mapas, llaves ni el APK debug antiguo.

Para Android nativo, compilar una APK de distribución interna con configuración HTTPS
y certificado propio; no distribuir el APK de desarrollo que necesita Metro. Para
TestFlight se requiere membresía Apple Developer y una compilación iOS validada.
