import { INTL_LOCALES } from "@/i18n/config";
import { appSettings, currencyInfo } from "./settings";

const tz = () => appSettings().timezone;
const locale = () => INTL_LOCALES[appSettings().locale];

const numberFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function currencySymbol(code: string) {
  return currencyInfo(code)?.symbol ?? code;
}

/** "L 1,234.50", "US$ 12.99", "-RD$ 500.00" — símbolo definido por el usuario en Ajustes. */
export function money(value: number | string | null | undefined, currency = appSettings().baseCurrency) {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return `${n < 0 ? "-" : ""}${currencySymbol(currency)} ${numberFmt.format(Math.abs(n))}`;
}

export function compactNumber(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat(locale(), { timeZone: tz(), ...opts }).format(new Date(d));
}

/** Formatea un día calendario "YYYY-MM-DD" (sin convertir de zona horaria). */
export function formatYmd(ymd: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat(locale(), { timeZone: "UTC", ...opts }).format(new Date(`${ymd}T12:00:00Z`));
}

export function formatDateTime(d: Date | string) {
  return formatDate(d, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "YYYY-MM-DD" de una fecha en la zona horaria configurada */
export function toLocalYmd(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // en-CA => 2026-10-19
}

export function currentMonth() {
  return toLocalYmd(new Date()).slice(0, 7);
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym: string, style: "long" | "short" = "long") {
  const [y, m] = ym.split("-").map(Number);
  const s = new Intl.DateTimeFormat(locale(), {
    month: style,
    year: style === "long" ? "numeric" : "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 15)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function tzOffsetMinutes(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz(),
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUtc - date.getTime()) / 60000;
}

/** Convierte "YYYY-MM-DD" (+ hora local opcional) en la zona configurada a un Date UTC */
export function localToUtc(ymd: string, time = "12:00") {
  const guess = new Date(`${ymd}T${time}:00Z`);
  return new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000);
}
