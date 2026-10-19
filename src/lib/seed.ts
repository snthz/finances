import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, emailRules } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { PRESET_RULES, PRESETS_VERSION } from "@/lib/email/presets";
import { getSetting, KEYS, setSetting } from "@/lib/settings";

// Datos iniciales de cada usuario nuevo: categorías, reglas genéricas y reglas de bancos conocidos.

// Paleta categórica validada (orden fijo)
export const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

// Los nombres se guardan en el idioma del usuario al registrarse; las palabras clave son de comercios reales.
const DEFAULT_CATEGORIES: { name: Record<Locale, string>; kind: "expense" | "income"; icon: string; keywords: string[] }[] = [
  { name: { es: "Supermercado", en: "Groceries" }, kind: "expense", icon: "shopping-cart", keywords: ["supermercado", "super ", "walmart", "colonia", "pricesmart", "despensa", "paiz", "maxi"] },
  { name: { es: "Restaurantes", en: "Restaurants" }, kind: "expense", icon: "utensils", keywords: ["restaurant", "rest ", "cafe", "pizza", "burger", "mcdonald", "kfc", "starbucks", "pedidosya", "hugo", "wendy", "popeyes"] },
  { name: { es: "Transporte", en: "Transport" }, kind: "expense", icon: "car", keywords: ["uber", "didi", "indrive", "gasolina", "shell", "texaco", "puma", "uno ", "peaje"] },
  { name: { es: "Servicios", en: "Utilities" }, kind: "expense", icon: "lightbulb", keywords: ["enee", "energia", "claro", "tigo", "hondutel", "agua", "internet", "cable"] },
  { name: { es: "Suscripciones", en: "Subscriptions" }, kind: "expense", icon: "tv", keywords: ["netflix", "spotify", "apple.com", "google", "amazon prime", "disney", "hbo", "youtube", "openai", "anthropic", "icloud"] },
  { name: { es: "Compras", en: "Shopping" }, kind: "expense", icon: "shopping-bag", keywords: ["amazon", "aliexpress", "shein", "temu", "zara", "tienda", "ebay"] },
  { name: { es: "Salud", en: "Health" }, kind: "expense", icon: "stethoscope", keywords: ["farmacia", "clinica", "hospital", "laboratorio", "kielsa", "simán"] },
  { name: { es: "Hogar", en: "Home" }, kind: "expense", icon: "house", keywords: ["ferreteria", "alquiler", "renta", "ikea", "larach"] },
  { name: { es: "Entretenimiento", en: "Entertainment" }, kind: "expense", icon: "clapperboard", keywords: ["cine", "cinemark", "cinepolis", "steam", "playstation", "xbox"] },
  { name: { es: "Otros gastos", en: "Other expenses" }, kind: "expense", icon: "package", keywords: [] },
  { name: { es: "Salario", en: "Salary" }, kind: "income", icon: "briefcase", keywords: ["nomina", "nómina", "salario", "planilla", "payroll"] },
  { name: { es: "Transferencias recibidas", en: "Transfers received" }, kind: "income", icon: "hand-coins", keywords: [] },
  { name: { es: "Otros ingresos", en: "Other income" }, kind: "income", icon: "coins", keywords: [] },
];

// Reglas genéricas: atrapan correos de cualquier banco con poca precisión. Si hay IA, ésta crea primero
// una regla específica para ese remitente y la genérica queda como respaldo.
const DEFAULT_RULES: { name: Record<Locale, string>; priority: number; ignore?: boolean; subjectPattern: string; type: "expense" | "income" }[] = [
  {
    name: { es: "Ignorar promociones y estados de cuenta", en: "Ignore promotions and statements" },
    priority: 10,
    ignore: true,
    subjectPattern: "promoci[oó]n|oferta|estado de cuenta|newsletter|bolet[ií]n|encuesta|statement|promotion",
    type: "expense",
  },
  {
    name: { es: "Consumo con tarjeta (genérico)", en: "Card purchase (generic)" },
    priority: 100,
    subjectPattern: "consumo|compra|cargo|transacci[oó]n|autorizaci[oó]n|purchase|pago con tarjeta",
    type: "expense",
  },
  {
    name: { es: "Transferencia enviada (genérico)", en: "Transfer sent (generic)" },
    priority: 110,
    subjectPattern: "transferencia (enviada|realizada)|has enviado|env[ií]o de dinero|pago a terceros|ach enviada|transfer sent",
    type: "expense",
  },
  {
    name: { es: "Transferencia / depósito recibido (genérico)", en: "Transfer / deposit received (generic)" },
    priority: 120,
    subjectPattern: "transferencia recibida|has recibido|dep[oó]sito|cr[eé]dito a (tu|su) cuenta|ach recibida|deposit|transfer received",
    type: "income",
  },
];

/** Busca la categoría de un preset por su nombre en cualquier idioma. */
function findCategoryId(cats: { id: number; name: string }[], esName: string) {
  const def = DEFAULT_CATEGORIES.find((c) => c.name.es === esName);
  const names = new Set([esName, ...(def ? Object.values(def.name) : [])]);
  return cats.find((c) => names.has(c.name))?.id ?? null;
}

/** Instala las reglas incluidas para bancos conocidos (una vez por versión; las borradas no vuelven). */
export async function installPresets(userId: number) {
  const installed = Number((await getSetting(KEYS.presetsVersion, userId)) ?? 0);
  if (installed >= PRESETS_VERSION) return 0;
  const [existing, cats] = await Promise.all([
    db.select({ name: emailRules.name }).from(emailRules).where(eq(emailRules.userId, userId)),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.userId, userId)),
  ]);
  const names = new Set(existing.map((r) => r.name));
  const toInsert = PRESET_RULES.filter((p) => !names.has(p.name)).map(({ categoryName, ...p }) => ({
    ...p,
    userId,
    ignore: p.ignore ?? false,
    source: "preset",
    categoryId: categoryName ? findCategoryId(cats, categoryName) : null,
  }));
  if (toInsert.length) await db.insert(emailRules).values(toInsert);
  await setSetting(KEYS.presetsVersion, String(PRESETS_VERSION), userId);
  return toInsert.length;
}

/** Datos iniciales de un usuario recién creado. */
export async function seedUser(userId: number, locale: Locale) {
  const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.userId, userId)).limit(1);
  if (!cat) {
    await db.insert(categories).values(
      DEFAULT_CATEGORIES.map((c, i) => ({ userId, name: c.name[locale], kind: c.kind, icon: c.icon, keywords: c.keywords, color: PALETTE[i % PALETTE.length] })),
    );
  }
  const [rule] = await db.select({ id: emailRules.id }).from(emailRules).where(eq(emailRules.userId, userId)).limit(1);
  if (!rule) {
    await db.insert(emailRules).values(DEFAULT_RULES.map((r) => ({ ...r, userId, name: r.name[locale], ignore: r.ignore ?? false, source: "generic" })));
  }
  await installPresets(userId);
}

/** Marca como genéricas las reglas por defecto creadas en versiones anteriores (datos antiguos). */
export async function markLegacyGenericRules() {
  const names = DEFAULT_RULES.flatMap((r) => Object.values(r.name));
  await db.update(emailRules).set({ source: "generic" }).where(and(inArray(emailRules.name, names), eq(emailRules.source, "manual")));
}
