import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePushTicket, parsePushResult, parsePushReceipts } from "./push";

test("Expo HTTP 200 is not success when the ticket contains an error", () => {
  assert.deepEqual(parsePushTicket({ data: { status: "error", message: "private token and text", details: { error: "DeviceNotRegistered" } } }), { status: "error", code: "DeviceNotRegistered" });
  assert.deepEqual(parsePushTicket({ data: [{ status: "error", details: { error: "InvalidCredentials" } }] }), { status: "error", code: "InvalidCredentials" });
});
test("tickets and receipts distinguish acceptance from delivery, rejecting malformed responses", () => {
  assert.deepEqual(parsePushTicket({ data: { status: "ok", id: "ticket-123" } }), { status: "accepted", ticketId: "ticket-123" });
  assert.deepEqual(parsePushResult({ status: "ok" }, false), { status: "providerAccepted" });
  for (const value of [null, {}, { data: { status: "ok" } }, { data: [] }, { data: [{ status: "ok", id: "a" }, { status: "ok", id: "b" }] }, { data: { status: "ok", id: "<private>" } }, { errors: [{}], data: { status: "ok", id: "a" } }]) {
    assert.equal(parsePushTicket(value).status, "error");
  }
  assert.deepEqual(parsePushResult({ status: "error", details: { error: "secret token" } }, false), { status: "error", code: "InvalidProviderResponse" });
  assert.deepEqual(parsePushReceipts({ data: { a: { status: "ok" } } }), { a: { status: "ok" } });
  for (const value of [null, {}, { data: [] }, { data: {}, errors: [{}] }]) assert.throws(() => parsePushReceipts(value));
});
