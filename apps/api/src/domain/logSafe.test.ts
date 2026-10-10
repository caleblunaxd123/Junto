import { test } from "node:test";
import assert from "node:assert/strict";
import { describeError } from "../lib/logSafe";

test("logged errors never carry provider keys, e-mail bodies or addresses", () => {
  const axiosLike = Object.assign(new Error("Request failed with status code 422 for ana@correo.pe"), {
    name: "AxiosError", code: "ERR_BAD_REQUEST", response: { status: 422 },
    config: { headers: { Authorization: "Bearer re_secret_key" }, data: '{"html":"Tu código es 482913"}' },
  });
  const line = describeError(axiosLike);
  assert.match(line, /AxiosError code=ERR_BAD_REQUEST status=422/);
  for (const secret of ["re_secret_key", "482913", "ana@correo.pe"]) assert.ok(!line.includes(secret), secret);
  assert.equal(describeError(undefined), "undefined");
  assert.equal(describeError("Bearer private-token 482913"), "NonError");
  assert.equal(describeError({ name: "secret", code: "https://private-key", message: "password=private-key 482913" }), "Error");
  assert.equal(describeError(new Error("password=private-key 482913")), "Error");
});
