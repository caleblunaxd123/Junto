// Local visual QA only: fictional people and amounts, no email is sent.
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { createServer } = require("node:http");
const { shareEmailHtml } = require("../apps/mobile/src/lib/shareEmail.ts");
const { tryBillShareMessage } = require("../apps/mobile/src/lib/tryBill.ts");
const html = shareEmailHtml(tryBillShareMessage({ nombre: "Cumpleaños de Jaime", cobrarA: "Davetsy", instrucciones: "Puedes aportar por Yape o Plin al número acordado con la organización.\nSe confirma después de recibir el dinero.", division: "igual", totalCuenta: 18000, extras: 0,
  participantes: ["Jaime", "Davetsy", "Gerson", "Caleb", "Sandra", "Lili"].map((nombre, i) => ({ id: String(i), nombre, consumo: 0, invitado: i === 0 })) }));
createServer((_req, res) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" }); res.end(html); })
  .listen(3006, "127.0.0.1", () => console.info("Plantilla de correo QA: http://127.0.0.1:3006 (no envía mensajes)"));
