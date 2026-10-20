// Periodos de las estadísticas (día, semana, mes, año) sobre días calendario "YYYY-MM-DD".
// Sin dependencias del servidor para poder probarlo aislado.

export const PERIOD_KINDS = ["day", "week", "month", "year"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

/** Rango de días locales, ambos extremos incluidos. */
export type DateRange = { from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export function isYmd(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime()) && toYmd(parse(s)) === s;
}

export function addDays(ymd: string, n: number) {
  const d = parse(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return toYmd(d);
}

/** Días entre dos fechas (b - a). */
export function daysBetween(a: string, b: string) {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(ymd: string) {
  return parse(ymd).getUTCDay() || 7;
}

export function periodRange(kind: PeriodKind, anchor: string): DateRange {
  const [y, m] = anchor.split("-").map(Number);
  switch (kind) {
    case "day":
      return { from: anchor, to: anchor };
    case "week": {
      // Semanas de lunes a domingo
      const from = addDays(anchor, 1 - isoWeekday(anchor));
      return { from, to: addDays(from, 6) };
    }
    case "month":
      return { from: `${y}-${pad(m)}-01`, to: toYmd(new Date(Date.UTC(y, m, 0))) };
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

/** Primer día del periodo desplazado `delta` periodos. */
export function shiftPeriod(kind: PeriodKind, anchor: string, delta: number) {
  const { from } = periodRange(kind, anchor);
  const [y, m] = from.split("-").map(Number);
  switch (kind) {
    case "day":
      return addDays(from, delta);
    case "week":
      return addDays(from, 7 * delta);
    case "month":
      return toYmd(new Date(Date.UTC(y, m - 1 + delta, 1)));
    case "year":
      return `${y + delta}-01-01`;
  }
}

/** Claves de cada barra del gráfico: días ("YYYY-MM-DD") o meses ("YYYY-MM"); el día no se divide. */
export function periodBuckets(kind: PeriodKind, range: DateRange): { unit: "day" | "month"; keys: string[] } | null {
  if (kind === "day") return null;
  if (kind === "year") {
    const y = range.from.slice(0, 4);
    return { unit: "month", keys: Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`) };
  }
  return { unit: "day", keys: Array.from({ length: daysBetween(range.from, range.to) + 1 }, (_, i) => addDays(range.from, i)) };
}

/** Días del rango ya transcurridos hasta `today` (incluido); 0 si el rango es futuro. */
export function elapsedDays(range: DateRange, today: string) {
  if (today < range.from) return 0;
  const end = today < range.to ? today : range.to;
  return daysBetween(range.from, end) + 1;
}

/** Cuántas veces aparece cada día de la semana (índice 0 = lunes) entre `from` y `to`. */
export function weekdayOccurrences(range: DateRange) {
  const out = [0, 0, 0, 0, 0, 0, 0];
  if (range.to < range.from) return out;
  const total = daysBetween(range.from, range.to) + 1;
  const first = isoWeekday(range.from) - 1;
  for (let i = 0; i < 7; i++) out[(first + i) % 7] = Math.floor(total / 7) + (i < total % 7 ? 1 : 0);
  return out;
}
