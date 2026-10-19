// Idiomas soportados. Compartido entre servidor y cliente (sin dependencias de servidor).

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Nombre de cada idioma en su propio idioma (para el selector de Ajustes) */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", es: "Español" };

/** Locale de Intl para fechas y meses */
export const INTL_LOCALES: Record<Locale, string> = { en: "en-US", es: "es" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
