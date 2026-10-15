/** Fail before listening when production authentication or browser origins are unsafe. */
export function serverConfig(env: NodeJS.ProcessEnv) {
  const allowedOrigins = (env.FRONTEND_URL || '').split(',').map(value => value.trim()).filter(Boolean);
  if (env.NODE_ENV === 'production') {
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /super_secret|cambia_esto|local-qa|example/i.test(env.JWT_SECRET))
      throw new Error('Configure a strong production JWT_SECRET before starting JUNTO.');
    const validOrigin = (value: string) => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.origin === value && !url.username && !url.password && !value.includes('*');
      } catch { return false; }
    };
    if (!allowedOrigins.length || !allowedOrigins.every(validOrigin))
      throw new Error('Configure explicit HTTPS FRONTEND_URL origins for production (no paths or credentials).');
  }
  return { allowedOrigins };
}
