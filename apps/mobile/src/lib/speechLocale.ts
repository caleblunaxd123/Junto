/** Prefer Peruvian Spanish only when supported; other Spanish models can transcribe the same form. */
export function speechLocale(locales: string[]) {
  const supported = locales.map(locale => ({ original: locale, key: locale.replace(/_/g, "-").toLowerCase() }));
  for (const key of ["es-pe", "es-es", "es-mx", "es-us", "es"]) {
    const match = supported.find(locale => locale.key === key);
    if (match) return match.original.replace(/_/g, "-");
  }
  return supported.find(locale => locale.key.startsWith("es-"))?.original.replace(/_/g, "-") ?? "es-PE";
}
