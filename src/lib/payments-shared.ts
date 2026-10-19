// Constantes y fechas de los pagos programados. Sin dependencias de servidor: lo usa también el formulario.
// Las fechas son "YYYY-MM-DD" (día calendario, sin hora) y se operan en UTC para no depender de la zona.

import { plural, type Plural } from "@/i18n/format";

export type Frequency = "once" | "weekly" | "biweekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "yearly";

// Los nombres visibles están en el diccionario: t.payments.frequencies[f], t.payments.kinds[k], etc.
export const FREQUENCIES: Record<Frequency, { months?: number; days?: number; perMonth: number }> = {
  once: { perMonth: 0 },
  weekly: { days: 7, perMonth: 52 / 12 },
  biweekly: { days: 14, perMonth: 26 / 12 },
  monthly: { months: 1, perMonth: 1 },
  bimonthly: { months: 2, perMonth: 1 / 2 },
  quarterly: { months: 3, perMonth: 1 / 3 },
  semiannual: { months: 6, perMonth: 1 / 6 },
  yearly: { months: 12, perMonth: 1 / 12 },
};

export const isFrequency = (v: unknown): v is Frequency => typeof v === "string" && v in FREQUENCIES;

export const PAYMENT_KINDS = {
  financing: { icon: "credit-card" },
  service: { icon: "receipt" },
  deposit: { icon: "landmark" },
  other: { icon: "tag" },
} as const;

export type Kind = keyof typeof PAYMENT_KINDS;

/** Subtipos de financiamiento (nombres en t.payments.financingTypes) */
export const FINANCING_TYPES = ["extra", "intra", "loan", "financing"] as const;

/** Atajos para crear servicios; el nombre (t.payments.servicePresets[key]) y el ícono se pueden cambiar. */
export const SERVICE_PRESETS: { key: string; icon: string; keywords?: string[] }[] = [
  { key: "water", icon: "droplet", keywords: ["SANAA"] },
  { key: "electricity", icon: "zap", keywords: ["ENEE"] },
  { key: "rent", icon: "house" },
  { key: "internet", icon: "wifi" },
  { key: "phone", icon: "smartphone" },
  { key: "tv", icon: "tv" },
  { key: "security", icon: "shield" },
  { key: "tuition", icon: "graduation" },
  { key: "gas", icon: "flame" },
  { key: "insurance", icon: "heart" },
  { key: "gym", icon: "dumbbell" },
  { key: "trash", icon: "trash" },
  { key: "maintenance", icon: "wrench" },
];

/** Días de anticipación para los recordatorios (textos en t.payments.reminderOptions) */
export const REMINDER_OPTIONS = [0, 1, 2, 3, 5, 7];

const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const lastDayOf = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

export function addDays(ymd: string, n: number) {
  const d = toDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** a − b en días */
export function diffDays(a: string, b: string) {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / 86_400_000);
}

/** Suma meses conservando el día de referencia (31 → 30/28 en meses cortos y vuelve a 31 después). */
export function addMonthsAnchored(ymd: string, months: number, anchorDay: number) {
  const [y, m] = ymd.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  return fmt(new Date(Date.UTC(ty, tm, Math.min(anchorDay, lastDayOf(ty, tm)))));
}

/** Próxima fecha con ese día del mes, a partir de hoy (incluido). */
export function nextOccurrenceOfDay(day: number, today: string) {
  const [y, m] = today.split("-").map(Number);
  const thisMonth = fmt(new Date(Date.UTC(y, m - 1, Math.min(day, lastDayOf(y, m - 1)))));
  return thisMonth >= today ? thisMonth : addMonthsAnchored(thisMonth, 1, day);
}

/** Siguiente vencimiento después de `ymd`. Para "una vez" devuelve la misma fecha. */
export function advanceDue(ymd: string, frequency: string, anchorDay: number | null) {
  const f = FREQUENCIES[frequency as Frequency];
  if (!f) return ymd;
  if (f.days) return addDays(ymd, f.days);
  if (f.months) return addMonthsAnchored(ymd, f.months, anchorDay ?? Number(ymd.slice(8, 10)));
  return ymd;
}

export type DueLabels = { today: string; tomorrow: string; inDays: Plural; yesterday: string; overdueDays: Plural };

/** "Hoy", "Mañana", "En 3 días", "Vencido hace 2 días" (textos en t.payments.due) */
export function dueLabel(daysLeft: number, l: DueLabels) {
  if (daysLeft === 0) return l.today;
  if (daysLeft === 1) return l.tomorrow;
  if (daysLeft > 1) return plural(daysLeft, l.inDays);
  return daysLeft === -1 ? l.yesterday : plural(-daysLeft, l.overdueDays);
}

// --- Ciclo de las tarjetas de crédito (día de corte y día límite de pago) ---

/** Último corte hasta hoy (incluido) para un día de corte; en meses cortos se usa su último día. */
export function lastStatementDate(statementDay: number, today: string) {
  const [y, m] = today.split("-").map(Number);
  const thisMonth = fmt(new Date(Date.UTC(y, m - 1, Math.min(statementDay, lastDayOf(y, m - 1)))));
  return thisMonth <= today ? thisMonth : addMonthsAnchored(thisMonth, -1, statementDay);
}

/** Fecha límite para pagar el estado cortado en `statement`: el primer `dueDay` posterior al corte. */
export function dueDateAfter(statement: string, dueDay: number) {
  const [y, m] = statement.split("-").map(Number);
  const sameMonth = fmt(new Date(Date.UTC(y, m - 1, Math.min(dueDay, lastDayOf(y, m - 1)))));
  return sameMonth > statement ? sameMonth : addMonthsAnchored(sameMonth, 1, dueDay);
}
