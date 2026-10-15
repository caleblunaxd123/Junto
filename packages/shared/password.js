// bcrypt consumes at most 72 UTF-8 bytes. Validate new passwords before hashing
// so distinct suffixes can never silently become the same credential.
const PASSWORD_MAX_BYTES = 72;
function passwordBytes(password) {
  let bytes = 0;
  for (const char of password) {
    const code = char.codePointAt(0);
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}
const passwordWithinLimit = (password) => passwordBytes(password) <= PASSWORD_MAX_BYTES;
module.exports = { PASSWORD_MAX_BYTES, passwordBytes, passwordWithinLimit };
