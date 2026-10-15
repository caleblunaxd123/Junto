const test = require('node:test');
const assert = require('node:assert/strict');
const lock = require('../package-lock.json');

test('every Lightning CSS version retains its exact optional bindings across platforms', () => {
  const copies = Object.entries(lock.packages).filter(([location]) => location.endsWith('/lightningcss'));
  assert.ok(copies.length > 0);
  for (const [location, pkg] of copies) {
    const base = location.slice(0, -'lightningcss'.length);
    for (const [name, version] of Object.entries(pkg.optionalDependencies)) {
      const binding = lock.packages[base + name];
      assert.equal(binding?.version, version, `${location} needs ${name}@${version} in the lockfile`);
      assert.equal(binding.optional, true);
      assert.ok(binding.os?.length && binding.cpu?.length, `${name} must remain platform-specific`);
    }
  }
});
