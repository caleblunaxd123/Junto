// Reject remote databases/APIs even when their URL includes a misleading "localhost" substring.
function localQa(env = process.env) {
  const database = new URL(env.DATABASE_URL || "invalid:");
  const api = new URL(env.JUNTO_QA_API || "http://localhost:3005/api");
  const loopback = (hostname) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  if (!["postgres:", "postgresql:"].includes(database.protocol) || !loopback(database.hostname) ||
      database.search || database.hash || !/^\/junto_(?:db|[a-z0-9_]*qa[a-z0-9_]*)$/.test(database.pathname))
    throw new Error("Use a local JUNTO QA database, never production.");
  if (api.protocol !== "http:" || !loopback(api.hostname) || api.username || api.password || api.search || api.hash || api.pathname !== "/api")
    throw new Error("Use a loopback JUNTO QA API.");
  return api.href;
}
module.exports = { localQa };
