import test from "node:test";
import assert from "node:assert/strict";
import { deadlineMessage, deadlineStage, isQuietHour } from "./deadline";

const deadline = new Date("2026-12-20T20:00:00Z"); // Sunday 15:00 in Lima
const at = (hoursBefore: number) => new Date(deadline.getTime() - hoursBefore * 3_600_000);

test("stages: 3 days, last 24 hours, the day it passes, then every 2 days for two weeks", () => {
  assert.equal(deadlineStage(at(100), deadline), null);
  assert.equal(deadlineStage(at(72), deadline), "limite-d3");
  assert.equal(deadlineStage(at(25), deadline), "limite-d3");
  assert.equal(deadlineStage(at(24), deadline), "limite-d1");
  assert.equal(deadlineStage(at(1), deadline), "limite-d1");
  assert.equal(deadlineStage(at(0), deadline), "limite-d0");
  assert.equal(deadlineStage(at(-23), deadline), "limite-d0");
  assert.equal(deadlineStage(at(-30), deadline), null);
  assert.equal(deadlineStage(at(-48), deadline), "limite-v2");
  assert.equal(deadlineStage(at(-24 * 14), deadline), "limite-v14");
  assert.equal(deadlineStage(at(-24 * 16), deadline), null);
});

test("quiet hours follow Lima time", () => {
  assert.equal(isQuietHour(new Date("2026-12-20T12:59:00Z")), true); // 07:59
  assert.equal(isQuietHour(new Date("2026-12-20T13:00:00Z")), false); // 08:00
  assert.equal(isQuietHour(new Date("2026-12-21T01:59:00Z")), false); // 20:59
  assert.equal(isQuietHour(new Date("2026-12-21T02:00:00Z")), true); // 21:00
});

test("messages say how much and when, in the group's words", () => {
  assert.match(deadlineMessage("limite-d1", 10000, "Cine", deadline, false), /menos de 24 horas.*te falta pagar S\/ 100\.00 en «Cine»/);
  assert.match(deadlineMessage("limite-v4", 5000, "Regalo", deadline, true), /venció hace 4 días: te falta aportar S\/ 50\.00/);
});

test("deadline e-mail links to the group only over https and escapes names", async () => {
  const { renderDeadlineEmail } = await import("./reminderEmail");
  const mail = renderDeadlineEmail({ nombre: "Luis <b>", grupo: "Cine & co", mensaje: "Vence mañana: te falta pagar S/ 50.00.", late: false, grupoId: "g1", publicUrl: "https://junto.example" });
  assert.match(mail.html, /href="https:\/\/junto\.example\/app\/grupos\/g1"/);
  assert.match(mail.html, /Luis &lt;b&gt;/);
  assert.match(mail.subject, /Se acerca la fecha límite: «Cine & co»/);
  assert.doesNotMatch(renderDeadlineEmail({ nombre: "Ana", grupo: "G", mensaje: "x", late: true, grupoId: "g1", publicUrl: "http://insecure" }).html, /href=/);
});
