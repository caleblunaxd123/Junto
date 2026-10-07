// Static guards for UI patterns that broke before (NativeWind) or hurt screen-reader users.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const roots = ["app", "src"].map((dir) => path.join(__dirname, "../apps/mobile", dir));
const files = [];
(function walk(dirs) {
  for (const dir of dirs) for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk([full]);
    else if (/\.tsx$/.test(entry.name)) files.push(full);
  }
})(roots);

function pressableTags(source) {
  const tags = [];
  for (const match of source.matchAll(/<Pressable\b/g)) {
    let i = match.index + match[0].length, depth = 0;
    while (i < source.length) {
      const c = source[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && source[i - 1] !== "=") break;
      i++;
    }
    tags.push({ line: source.slice(0, match.index).split("\n").length, tag: source.slice(match.index, i) });
  }
  return tags;
}

test("Pressable never uses a style callback (it is dropped under NativeWind); use onPressIn/onPressOut state", () => {
  const offenders = [];
  for (const file of files) for (const { line, tag } of pressableTags(fs.readFileSync(file, "utf8")))
    if (/style=\{\s*\(\s*\{?\s*pressed/.test(tag)) offenders.push(`${path.relative(process.cwd(), file)}:${line}`);
  assert.deepEqual(offenders, []);
});

test("every Pressable tells screen readers what it is", () => {
  const offenders = [];
  for (const file of files) for (const { line, tag } of pressableTags(fs.readFileSync(file, "utf8")))
    if (!/accessibilityRole=/.test(tag) && !/accessibilityLabel="Cerrar/.test(tag)) offenders.push(`${path.relative(process.cwd(), file)}:${line}`);
  assert.deepEqual(offenders, []);
});
