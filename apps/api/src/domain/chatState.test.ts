import test from "node:test";
import assert from "node:assert/strict";
import { deliveryState, reactionSummary } from "./chatState";

const t = (minutes: number) => new Date(Date.UTC(2026, 9, 16, 15, minutes));
test("ticks: sent, received (they used the app after), seen (they opened the chat after)", () => {
  const sent = t(10);
  const ana = { fechaUnion: t(0), ultimaLectura: t(5), ultimaConexion: t(8) };
  const luis = { fechaUnion: t(0), ultimaLectura: t(2), ultimaConexion: t(3) };
  assert.equal(deliveryState(sent, []), "enviado", "nobody else with the app");
  assert.equal(deliveryState(sent, [ana, luis]), "enviado");
  assert.equal(deliveryState(sent, [{ ...ana, ultimaConexion: t(11) }, { ...luis, ultimaConexion: t(12) }]), "recibido");
  assert.equal(deliveryState(sent, [{ ...ana, ultimaLectura: t(11) }, { ...luis, ultimaConexion: t(12) }]), "recibido");
  assert.equal(deliveryState(sent, [{ ...ana, ultimaLectura: t(11) }, { ...luis, ultimaLectura: t(12) }]), "visto");
  // Someone who joined later does not hold back the ticks of older messages.
  assert.equal(deliveryState(sent, [{ ...ana, ultimaLectura: t(11) }, { fechaUnion: t(20), ultimaLectura: null, ultimaConexion: null }]), "visto");
});

test("reactions grouped by emoji, most used first, marking mine", () => {
  assert.deepEqual(reactionSummary([{ usuarioId: "a", emoji: "👍" }, { usuarioId: "b", emoji: "❤️" }, { usuarioId: "c", emoji: "👍" }], "b"), [
    { emoji: "👍", total: 2, mia: false },
    { emoji: "❤️", total: 1, mia: true },
  ]);
});
