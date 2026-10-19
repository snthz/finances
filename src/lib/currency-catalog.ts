// Monedas sugeridas al registrarse o al agregar una moneda. Todo es editable después.
import { INTL_LOCALES, type Locale } from "@/i18n/config";

export type CatalogCurrency = { code: string; name: string; symbol: string; aliases: string[] };

export const CURRENCY_CATALOG: CatalogCurrency[] = [
  { code: "HNL", name: "Lempira hondureño", symbol: "L", aliases: ["HNL", "Lps.", "Lps", "L.", "L", "lempiras"] },
  { code: "USD", name: "Dólar estadounidense", symbol: "US$", aliases: ["US$", "USD", "U$S", "dólares", "dolares"] },
  { code: "DOP", name: "Peso dominicano", symbol: "RD$", aliases: ["RD$", "DOP", "pesos dominicanos"] },
  { code: "GTQ", name: "Quetzal guatemalteco", symbol: "Q", aliases: ["GTQ", "Q.", "Q", "quetzales"] },
  { code: "NIO", name: "Córdoba nicaragüense", symbol: "C$", aliases: ["C$", "NIO", "córdobas", "cordobas"] },
  { code: "CRC", name: "Colón costarricense", symbol: "₡", aliases: ["₡", "CRC", "colones"] },
  { code: "MXN", name: "Peso mexicano", symbol: "MX$", aliases: ["MX$", "MXN", "pesos mexicanos"] },
  { code: "COP", name: "Peso colombiano", symbol: "COL$", aliases: ["COL$", "COP"] },
  { code: "PAB", name: "Balboa panameño", symbol: "B/.", aliases: ["B/.", "PAB"] },
  { code: "PEN", name: "Sol peruano", symbol: "S/", aliases: ["S/", "PEN"] },
  { code: "CLP", name: "Peso chileno", symbol: "CLP$", aliases: ["CLP"] },
  { code: "ARS", name: "Peso argentino", symbol: "AR$", aliases: ["AR$", "ARS"] },
  { code: "BRL", name: "Real brasileño", symbol: "R$", aliases: ["R$", "BRL", "reales"] },
  { code: "EUR", name: "Euro", symbol: "€", aliases: ["€", "EUR", "euros"] },
  { code: "GBP", name: "Libra esterlina", symbol: "£", aliases: ["£", "GBP"] },
  { code: "CAD", name: "Dólar canadiense", symbol: "CA$", aliases: ["CA$", "CAD"] },
];

/** Catálogo con los nombres en el idioma de la interfaz (Intl), con el nombre fijo como respaldo. */
export function catalogFor(locale: Locale): CatalogCurrency[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([INTL_LOCALES[locale]], { type: "currency" });
  } catch {}
  return CURRENCY_CATALOG.map((c) => {
    const n = names?.of(c.code);
    return n && n !== c.code ? { ...c, name: n.charAt(0).toUpperCase() + n.slice(1) } : c;
  });
}

// Países donde "$" a secas significa la moneda local y no dólares
const LOCAL_DOLLAR_SIGN = new Set(["DOP", "MXN", "COP", "CLP", "ARS"]);

/** Aliases iniciales: el "$" suelto se asigna a la moneda base si allí "$" es la moneda local, si no a USD. */
export function initialAliases(code: string, base: string) {
  const item = CURRENCY_CATALOG.find((c) => c.code === code);
  const aliases = item ? [...item.aliases] : [code];
  const dollarOwner = LOCAL_DOLLAR_SIGN.has(base) ? base : "USD";
  if (code === dollarOwner && !aliases.includes("$")) aliases.push("$");
  return aliases;
}

export const COMMON_TIMEZONES = [
  "America/Tegucigalpa",
  "America/Santo_Domingo",
  "America/Guatemala",
  "America/El_Salvador",
  "America/Managua",
  "America/Costa_Rica",
  "America/Panama",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Caracas",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
];
