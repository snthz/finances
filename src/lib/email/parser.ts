// Motor de reglas para extraer transacciones de correos bancarios.
// Funciones puras: no tocan la base de datos.

export type EmailInput = {
  from: string;
  subject: string;
  body: string;
};

export type RuleLike = {
  fromPattern?: string | null;
  subjectPattern?: string | null;
  bodyPattern?: string | null;
  amountRegex?: string | null;
  merchantRegex?: string | null;
  identifierRegex?: string | null;
  currencyRegex?: string | null;
  dateRegex?: string | null;
  dedupeRegex?: string | null;
  defaultCurrency?: string | null;
};

/** Fecha local tal como aparece en el correo ("YYYY-MM-DD" y hora "HH:MM" opcional) */
export type LocalDate = { ymd: string; time: string | null };

export type Extraction = {
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  identifier: string | null;
  date: LocalDate | null;
  dedupeKey: string | null;
};

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, apr: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, aug: 8,
  sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Interpreta fechas comunes en correos bancarios:
 * 2026/10/17-11:07:45 · 2026-10-17 11:07 · 15/10/2026 a las 14:21:13 · 18/10/2026 · 13-oct-26 · 13 de octubre de 2026
 */
export function parseDateText(raw: string): LocalDate | null {
  const s = raw.trim().toLowerCase();
  let y: number, m: number, d: number;
  let mt: RegExpMatchArray | null;
  if ((mt = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/))) [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  else if ((mt = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/))) [d, m, y] = [+mt[1], +mt[2], +mt[3]];
  else if ((mt = s.match(/(\d{1,2})(?:\s+de)?[\s-]+([a-záéíóú]{3,10})\.?(?:\s+de)?[\s-]+(\d{2,4})/))) {
    const month = MONTHS[mt[2].normalize("NFD").replace(/\p{Diacritic}/gu, "")];
    if (!month) return null;
    [d, m, y] = [+mt[1], month, +mt[3]];
  } else return null;
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const tm = s.slice((mt.index ?? 0) + mt[0].length).match(/(\d{1,2}):(\d{2})/);
  const time = tm && +tm[1] < 24 ? `${pad(+tm[1])}:${tm[2]}` : null;
  return { ymd: `${y}-${pad(m)}-${pad(d)}`, time };
}

/** Compila un patrón del usuario; usa unicode si es posible y, si no es regex válido, lo trata como texto literal. */
export function compile(pattern: string, flags = "i"): RegExp {
  for (const f of [`${flags}u`, flags]) {
    try {
      return new RegExp(pattern, f);
    } catch {}
  }
  return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
}

export function isValidRegex(pattern: string) {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function test(pattern: string | null | undefined, value: string) {
  if (!pattern?.trim()) return true;
  return compile(pattern.trim()).test(value);
}

export function ruleMatches(rule: RuleLike, email: EmailInput) {
  const hasFilter = [rule.fromPattern, rule.subjectPattern, rule.bodyPattern].some((p) => p?.trim());
  if (!hasFilter) return false; // una regla sin filtros no debe atrapar todo
  return (
    test(rule.fromPattern, email.from) &&
    test(rule.subjectPattern, email.subject) &&
    test(rule.bodyPattern, email.body)
  );
}

/** Normaliza espacios raros que traen los correos HTML. */
export function normalizeText(s: string) {
  return s
    .replace(/[   ]/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "1,234.56" | "1.234,56" | "RD$ 1,234" -> número */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // "1,234" (miles) vs "12,50" (decimal)
    s = /,\d{1,2}$/.test(s) && (s.match(/,/g) ?? []).length === 1 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot > -1 && (s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Monedas conocidas con los textos con que aparecen en los correos. */
export type CurrencyAliases = { code: string; aliases: string[] };

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type AliasEntry = { code: string; alias: string; re: RegExp };

/** Lista plana de alias ordenada del más largo al más corto ("US$" antes que "$"). */
function aliasEntries(currencies: CurrencyAliases[]): AliasEntry[] {
  const list: AliasEntry[] = [];
  for (const c of currencies) {
    for (const raw of new Set([c.code, ...c.aliases])) {
      const alias = raw.trim();
      if (!alias) continue;
      // Los alias que empiezan/terminan en letra no deben ser parte de otra palabra ("L" en "TOTAL")
      const pre = /^[\p{L}\d]/u.test(alias) ? String.raw`(?<![\p{L}\d])` : "";
      const post = /[\p{L}]$/u.test(alias) ? String.raw`(?![\p{L}])` : "";
      list.push({ code: c.code, alias, re: new RegExp(pre + escapeRe(alias) + post, "iu") });
    }
  }
  return list.sort((x, y) => y.alias.length - x.alias.length);
}

export function normalizeCurrency(raw: string | null | undefined, currencies: CurrencyAliases[]): string | null {
  if (!raw) return null;
  for (const e of aliasEntries(currencies)) if (e.re.test(raw)) return e.code;
  const trimmed = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : null;
}

const NUM = String.raw`(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const GENERIC_CODES = ["USD", "EUR", "HNL", "DOP", "MXN", "GTQ", "NIO", "CRC", "COP", "PAB", "PEN"];

function currencyPattern(currencies: CurrencyAliases[]) {
  const entries = aliasEntries(currencies.length ? currencies : GENERIC_CODES.map((code) => ({ code, aliases: [] })));
  const parts = entries.map((e) => {
    const pre = /^[\p{L}\d]/u.test(e.alias) ? String.raw`(?<![\p{L}\d])` : "";
    return pre + escapeRe(e.alias);
  });
  if (!entries.some((e) => e.alias === "$")) parts.push(String.raw`\$`);
  return `(?:${parts.join("|")})`;
}

export function defaultAmountPatterns(currencies: CurrencyAliases[]) {
  const CUR = currencyPattern(currencies);
  return [
    String.raw`(?:monto|importe|valor|total|amount|cantidad)[^\d\n]{0,25}?${CUR}?\.?\s*${NUM}`,
    String.raw`${CUR}\.?\s*${NUM}`,
    String.raw`${NUM}\s*${CUR}(?![\p{L}])`,
  ];
}

export const DEFAULT_IDENTIFIER_PATTERNS = [
  String.raw`(?:terminad[ao]s?|finalizad[ao]s?|que termina|ending)\s*(?:en|in|with)?\s*[:#]?\s*[*xX•·-]*\s*(\d{4})\b`,
  String.raw`(?:[*xX•·]{2,}[\s-]?)+(\d{4})\b`,
  String.raw`(?:tarjeta|cuenta|card|account|producto)\b[^\d\n]{0,40}(\d{4})\b`,
];

export const DEFAULT_MERCHANT_PATTERNS = [
  String.raw`(?:comercio|establecimiento|merchant|lugar|beneficiario|destinatario|concepto|descripci[oó]n)\s*[:\-]?\s*([^\n]{2,80})`,
];

function firstCapture(patterns: string[], text: string): { value: string; match: string; index: number } | null {
  for (const p of patterns) {
    const m = compile(p, "im").exec(text);
    if (m) {
      const value = (m[1] ?? m[0]).trim();
      if (value) return { value, match: m[0], index: m.index };
    }
  }
  return null;
}

function cleanMerchant(s: string) {
  return s
    .split(/\s{2,}|\s[|]\s/)[0]
    .replace(/[.,;:]+$/, "")
    .trim()
    .slice(0, 80);
}

export function extract(rule: RuleLike, email: EmailInput, currencies: CurrencyAliases[] = []): Extraction {
  const text = `${email.subject}\n${email.body}`;

  const amountHit = firstCapture(
    rule.amountRegex?.trim() ? [rule.amountRegex.trim()] : defaultAmountPatterns(currencies),
    text,
  );
  const amount = amountHit ? parseAmount(amountHit.value) : null;

  let currency: string | null = null;
  if (rule.currencyRegex?.trim()) {
    const c = firstCapture([rule.currencyRegex.trim()], text);
    currency = normalizeCurrency(c?.value, currencies);
  }
  if (!currency && amountHit) currency = normalizeCurrency(amountHit.match.replace(amountHit.value, " "), currencies);
  if (!currency && amountHit) {
    // Moneda escrita después del número: "1,500.00 HNL"
    const after = text.slice(amountHit.index + amountHit.match.length, amountHit.index + amountHit.match.length + 12);
    const m = after.match(/^\s*(\S+)/);
    const code = m ? normalizeCurrency(m[1], currencies) : null;
    // Sólo se acepta si es una moneda configurada (evita tomar palabras de 3 letras como moneda)
    if (code && currencies.some((c) => c.code === code)) currency = code;
  }
  if (!currency && rule.defaultCurrency) currency = rule.defaultCurrency;

  const idHit = firstCapture(
    rule.identifierRegex?.trim() ? [rule.identifierRegex.trim()] : DEFAULT_IDENTIFIER_PATTERNS,
    text,
  );
  const identifier = idHit ? idHit.value.replace(/\D/g, "").slice(-4) || null : null;

  const merchantHit = firstCapture(
    rule.merchantRegex?.trim() ? [rule.merchantRegex.trim()] : DEFAULT_MERCHANT_PATTERNS,
    text,
  );
  const merchant = merchantHit ? cleanMerchant(merchantHit.value) || null : null;

  const dateHit = rule.dateRegex?.trim() ? firstCapture([rule.dateRegex.trim()], text) : null;
  const date = dateHit ? parseDateText(dateHit.value) : null;

  const dedupeHit = rule.dedupeRegex?.trim() ? firstCapture([rule.dedupeRegex.trim()], text) : null;
  const dedupeKey = dedupeHit ? dedupeHit.value.toLowerCase().replace(/\s+/g, " ").trim() || null : null;

  return { amount, currency, merchant, identifier, date, dedupeKey };
}

/** Busca la cuenta cuyos identificadores coinciden con los últimos dígitos detectados. */
export function matchAccount<T extends { id: number; identifiers: string[]; archived?: boolean }>(
  accounts: T[],
  identifier: string | null,
): T | null {
  if (!identifier) return null;
  const active = accounts.filter((a) => !a.archived);
  return (
    active.find((a) => a.identifiers.some((i) => i.replace(/\D/g, "") === identifier)) ??
    active.find((a) => a.identifiers.some((i) => i.replace(/\D/g, "").endsWith(identifier))) ??
    null
  );
}

/** Asigna categoría por palabras clave en comercio/descripción. */
export function matchCategory<T extends { id: number; keywords: string[] }>(
  categories: T[],
  ...texts: (string | null | undefined)[]
): T | null {
  const haystack = texts.filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return null;
  for (const c of categories) {
    if (c.keywords.some((k) => k.trim() && haystack.includes(k.trim().toLowerCase()))) return c;
  }
  return null;
}
