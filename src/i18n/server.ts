import "server-only";
import { currentLocale } from "@/lib/context";
import { getDictionary } from "./dictionaries";

/** Idioma del contexto actual: el del usuario, o la cookie del visitante (inglés por defecto). */
export function getLocale() {
  return currentLocale();
}

/** Diccionario del idioma actual, para Server Components, Server Actions y utilidades del servidor. */
export function getT() {
  return getDictionary(getLocale());
}

export { fmt, plural } from "./format";
