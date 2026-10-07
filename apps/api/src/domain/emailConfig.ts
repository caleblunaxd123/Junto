export function smtpConfiguration(env: NodeJS.ProcessEnv) {
  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT inválido");
  const localTest = env.NODE_ENV === "test" && ["127.0.0.1", "localhost", "::1"].includes(env.SMTP_HOST || "") && env.SMTP_ALLOW_INSECURE_LOCAL === "true";
  return {
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465 && !localTest,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  };
}
