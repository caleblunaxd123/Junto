import { Router, Response } from 'express';

/**
 * Public pages that must work without the app: invitation links (with Android App Links),
 * the privacy policy and the account-deletion page that Google Play requires.
 * Point the public domain (PUBLIC_WEB_URL, e.g. https://junto.pe) to this API.
 */
const router = Router();

const androidPackage = () => process.env.ANDROID_PACKAGE || 'com.junto.app';
// Do not send beta testers to a store listing that has not been published.
const playStoreUrl = () => {
  try {
    const url = new URL(process.env.PLAY_STORE_URL || '');
    return url.protocol === 'https:' && url.hostname === 'play.google.com' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
};
const publicHome = () => {
  try {
    const url = new URL(process.env.PUBLIC_WEB_URL || '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.origin + '/' : '';
  } catch { return ''; }
};
const supportEmail = () => process.env.SUPPORT_EMAIL || '';
const betaWebUrl = () => {
  try {
    const url = new URL(process.env.BETA_WEB_URL || '');
    const home = new URL(process.env.PUBLIC_WEB_URL || '');
    return url.protocol === 'https:' && url.origin === home.origin && url.pathname === '/app/' && !url.search && !url.hash && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
};
const legalOwner = () => process.env.LEGAL_OWNER || 'el equipo de JUNTO';

function escapeHTML(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function page(res: Response, title: string, body: string, status = 200) {
  res.status(status).type('html').send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)} · JUNTO</title><meta name="robots" content="${title === 'Invitación' ? 'noindex' : 'index'}">
<style>
body{margin:0;background:#FFFCF7;color:#082644;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:640px;margin:0 auto;padding:32px 20px 48px}
.brand{font-weight:800;font-size:28px;letter-spacing:-1px;color:#00856A;margin:0 0 24px}
h1{font-size:28px;line-height:1.2;margin:0 0 12px}h2{font-size:19px;margin:28px 0 6px}.card h2:first-child{margin-top:0}
.card{background:#fff;border:1px solid #E6EAF0;border-radius:20px;padding:20px;margin:16px 0}
.btn{display:block;text-align:center;text-decoration:none;font-weight:700;border-radius:16px;padding:16px;margin:12px 0}
.primary{background:#00856A;color:#fff}.secondary{background:#F2EDFF;color:#6B3FD9}
.muted{color:#64748B;font-size:14px}code{background:#F2EDFF;padding:2px 6px;border-radius:6px}
a{color:#00856A}
</style></head><body><main><p class="brand">JUNTO</p>${body}
<p class="muted">JUNTO registra y divide gastos. No guarda ni transfiere dinero.${supportEmail() ? ` Soporte: <a href="mailto:${escapeHTML(supportEmail())}">${escapeHTML(supportEmail())}</a>.` : ''}</p>
</main></body></html>`);
}

router.get('/.well-known/assetlinks.json', (_req, res) => {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '').split(',').map((v) => v.trim().toUpperCase()).filter(Boolean);
  if (!fingerprints.length) { res.status(404).json({ error: 'Configura ANDROID_SHA256_CERT_FINGERPRINTS para activar App Links.' }); return; }
  res.json([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: androidPackage(), sha256_cert_fingerprints: fingerprints } }]);
});

router.get('/unirse/:code', (req, res) => {
  const code = req.params.code;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(code)) {
    page(res, 'Invitación', '<h1>Este enlace no es válido</h1><p>Pide a quien te invitó que comparta el enlace de nuevo.</p>', 404);
    return;
  }
  // Installed Android builds open directly. Beta users get an honest landing, not a fake listing.
  const fallback = playStoreUrl() || publicHome();
  const intent = `intent://unirse/${code}#Intent;scheme=junto;package=${androidPackage()};${fallback ? `S.browser_fallback_url=${encodeURIComponent(fallback)};` : ''}end`;
  page(res, 'Invitación', `<h1>Te invitaron a un grupo en JUNTO</h1>
<p>Comparte gastos con tu grupo y mira en todo momento quién le debe a quién.</p>
<div class="card">
${betaWebUrl() ? `<a class="btn primary" href="${escapeHTML(betaWebUrl() + 'unirse/' + code)}">Ver grupo y aceptar invitación</a><p class="muted">Funciona en iPhone y Android. Entra con tu correo; no necesitas instalar la app ni pagar. No te unes hasta que lo confirmes.</p><a class="btn secondary" href="${escapeHTML(intent)}">Ya tengo JUNTO en Android: abrir app</a>` : `<a class="btn primary" href="${escapeHTML(intent)}">Abrir en JUNTO</a>`}
${playStoreUrl() ? `<a class="btn secondary" href="${escapeHTML(playStoreUrl())}">Descargar en Google Play</a>` : '<p class="muted">JUNTO está en fase de pruebas y aún no está publicado en Google Play. Pide la versión de prueba a quien te invitó.</p>'}
<p class="muted">¿Acabas de instalar la app? Vuelve a tocar el enlace de invitación, o abre JUNTO, toca «+» → «Unirme con un enlace» y pega este código: <code>${escapeHTML(code)}</code></p>
</div>`);
});

router.get('/privacidad', (_req, res) => {
  page(res, 'Política de privacidad', `<h1>Política de privacidad</h1>
<p class="muted">Última actualización: 7 de octubre de 2026. Responsable del tratamiento: ${escapeHTML(legalOwner())}.</p>
<h2>Qué datos usamos</h2>
<p>Tu nombre, correo, contraseña (guardada solo como hash), y si los agregas, tu celular y foto de perfil. También los grupos a los que perteneces, los gastos y pagos que registras o que otros registran contigo, y las cuentas puntuales que organizas (con los nombres de tus invitados). Si entras con Google, recibimos de Google tu nombre, correo y foto de perfil; nunca tu contraseña de Google. Si activas las notificaciones guardamos el identificador de notificaciones de tu teléfono.</p>
<h2>Para qué</h2>
<p>Para crear tu cuenta, verificar tu correo, calcular quién le debe a quién, avisarte de pagos por confirmar y darte soporte. No vendemos tus datos ni mostramos publicidad.</p>
<h2>Fotos de boletas y textos</h2>
<p>Las fotos de boletas se procesan en el servidor para leer el total y no se guardan. Si describes un gasto con texto, se procesa para proponer el reparto; siempre revisas la propuesta antes de guardar.</p>
<h2>Comprobantes de pago (Yape, Plin, transferencias)</h2>
<p>Si adjuntas la captura de un pago, la leemos en nuestro servidor (sin enviarla a terceros) para proponer el monto, la app, el número de operación, la fecha y el nombre de quien recibe. La imagen se guarda junto al pago para que pueda revisarla quien lo aprueba: solo la ven quien pagó, quien recibe y, si el grupo lo permite, sus administradores. Las capturas que no terminas de registrar se borran en 24 horas, y la imagen de un pago ya resuelto se borra a los 180 días (conservamos solo el monto y el número de operación leídos). JUNTO no se conecta con Yape, Plin ni bancos y no puede comprobar una transferencia por su cuenta: por eso un pago solo baja la deuda cuando una persona lo aprueba.</p>
<h2>Comentarios</h2>
<p>Los comentarios en gastos y pagos los ven las personas activas del grupo. Quien lo escribió o un administrador del grupo puede eliminarlo; cualquier integrante puede reportarlo y lo revisamos.</p>
<h2>Quién ve tus datos</h2>
<p>Solo las personas de cada grupo ven tu nombre, los gastos y los pagos de ese grupo. Si alguien te invita con tu correo o celular, no entras al grupo ni ven tus datos hasta que aceptas la invitación, y a quien invita no le decimos si tienes cuenta. Usamos proveedores para alojar la base de datos, enviar correos y enviar notificaciones, que tratan los datos solo para prestar ese servicio.</p>
<h2>Cuánto tiempo</h2>
<p>Mientras tu cuenta esté activa. Si la eliminas, borramos tus datos personales, las capturas de comprobantes que subiste y el texto de tus comentarios; los gastos y pagos compartidos con otras personas se conservan como «Usuario eliminado» para no alterar las cuentas de los demás.</p>
<h2>Tus derechos</h2>
<p>Puedes acceder, rectificar o eliminar tus datos desde la app (Perfil) o escribiendo a soporte, conforme a la Ley N.º 29733 de Protección de Datos Personales del Perú. Ver también <a href="/eliminar-cuenta">cómo eliminar tu cuenta</a>.</p>`);
});

router.get('/eliminar-cuenta', (_req, res) => {
  const email = supportEmail();
  page(res, 'Eliminar cuenta', `<h1>Eliminar tu cuenta de JUNTO</h1>
<div class="card"><h2>Desde la app (inmediato)</h2>
<p>Abre JUNTO → <b>Perfil</b> → <b>Eliminar mi cuenta</b>, revisa el resumen y confirma con tu contraseña.</p></div>
<div class="card"><h2>Sin la app</h2>
<p>${email ? `Escribe a <a href="mailto:${escapeHTML(email)}?subject=${encodeURIComponent('Eliminar mi cuenta de JUNTO')}">${escapeHTML(email)}</a> desde el correo de tu cuenta con el asunto «Eliminar mi cuenta». Te avisaremos por correo cuando esté hecho.` : 'Escribe a soporte desde el correo de tu cuenta con el asunto «Eliminar mi cuenta».'}</p></div>
<h2>Qué se borra</h2>
<p>Nombre, correo, celular, foto, contraseña, sesiones, notificaciones, recordatorios y tus cuentas puntuales.</p>
<h2>Qué se conserva</h2>
<p>Los gastos y pagos que compartiste con otras personas, como «Usuario eliminado», para que sus saldos no cambien. Los pagos que esperaban tu confirmación se cancelan.</p>`);
});

router.get('/', (_req, res) => {
  page(res, 'Divide sin drama', `<h1>Las cuentas claras, los buenos momentos juntos</h1>
<p>Divide la cuenta de hoy o lleva los gastos de tu depa, pareja o viaje.</p>
${betaWebUrl() ? `<div class="card"><h2>Prueba JUNTO con tu gente</h2><p>Abre la beta web desde iPhone o Android. Crea tu cuenta con correo, forma un grupo y comparte las cuentas claras.</p><a class="btn primary" href="${escapeHTML(betaWebUrl())}">Probar JUNTO en mi teléfono</a><p class="muted">En iPhone: abre en Safari → Compartir → Añadir a la pantalla de inicio. No es una app de TestFlight. Requiere internet; no incluye notificaciones push ni login con Google.</p></div>` : ''}
${playStoreUrl() ? `<a class="btn primary" href="${escapeHTML(playStoreUrl())}">Descargar en Google Play</a>` : betaWebUrl() ? '<p class="muted">Beta de pruebas: todavía no está publicada en Google Play ni App Store. Puedes usarla desde el navegador con el botón de arriba.</p>' : '<div class="card"><h2>Estamos preparando JUNTO para ti</h2><p>La app está en fase de pruebas. Esta página no es todavía la aplicación web ni una descarga de Google Play.</p><p class="muted">Si te invitaron a probarla, solicita la versión de prueba a quien organiza tu grupo.</p></div>'}
<p class="muted"><a href="/privacidad">Privacidad</a> · <a href="/eliminar-cuenta">Eliminar cuenta</a></p>`);
});

export default router;
