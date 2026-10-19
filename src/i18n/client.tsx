"use client";

import { createContext, useContext, useEffect } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Lo monta el layout raíz con el idioma de Ajustes. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  useEffect(() => {
    // Lo lee /offline.html, que no pasa por el servidor
    try {
      localStorage.setItem("fin_lang", locale);
    } catch {}
  }, [locale]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** Diccionario del idioma actual, para Client Components. */
export function useT() {
  return getDictionary(useContext(LocaleContext));
}

export { fmt, plural } from "./format";
