import { Mail } from "lucide-react";
import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { INTL_LOCALES, type Locale } from "@/i18n/config";
import { Logo } from "./brand";
import { LanguageToggle } from "./language-toggle";
import { LegalLinks, PublicHeader } from "./legal-page";

/** Marco de la configuración inicial: encabezado, tarjeta centrada y enlaces legales. */
export function AuthShell({
  legal,
  width = "sm",
  headerExtra,
  children,
}: {
  legal: Dictionary["legal"];
  width?: "sm" | "lg";
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader>{headerExtra}</PublicHeader>
      <main className="flex flex-1 items-center justify-center px-4 py-8 md:py-12">
        <div className={`card w-full p-6 sm:p-8 ${width === "lg" ? "max-w-lg" : "max-w-sm"}`}>{children}</div>
      </main>
      <footer className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <LegalLinks t={legal} />
      </footer>
    </div>
  );
}

/**
 * Marco de login y registro: formulario a la izquierda y, en pantallas grandes,
 * un panel con un ejemplo del registro de movimientos a la derecha.
 */
export function AuthSplit({
  legal,
  panel,
  locale,
  children,
}: {
  legal: Dictionary["legal"];
  panel: Dictionary["auth"]["panel"];
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-dvh flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10">
        <header className="flex items-center justify-between gap-3">
          <Link href="/welcome" aria-label="Finances">
            <Logo size="sm" />
          </Link>
          <LanguageToggle />
        </header>
        <main className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-95">{children}</div>
        </main>
        <footer className="pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <LegalLinks t={legal} align="start" />
        </footer>
      </div>
      <AuthPanel t={panel} locale={locale} />
    </div>
  );
}

/** Título y subtítulo del formulario. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2 text-pretty">{subtitle}</p>
    </div>
  );
}

// Movimientos de ejemplo; los textos (comercio y categoría) vienen del diccionario en el mismo orden
const SAMPLE = [
  { day: "today", initials: "SC", card: "4821", amount: "−450.00" },
  { day: "today", initials: "UB", card: "4821", amount: "−186.00" },
  { day: "yesterday", initials: "PL", card: "0937", amount: "+18,500.00" },
  { day: "yesterday", initials: "SP", card: "4821", amount: "−139.00" },
  { day: "yesterday", initials: "SH", card: "1150", amount: "−1,200.00" },
] as const;

function AuthPanel({ t, locale }: { t: Dictionary["auth"]["panel"]; locale: Locale }) {
  const month = new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: "long", year: "numeric" }).format(new Date());
  const days = (["today", "yesterday"] as const).map((day) => ({
    day,
    rows: SAMPLE.map((r, i) => ({ ...r, ...t.rows[i] })).filter((r) => r.day === day),
  }));

  return (
    <aside
      aria-hidden
      className="sticky top-0 hidden h-dvh flex-col justify-between overflow-hidden bg-ink p-12 text-bg select-none lg:flex xl:p-16 dark:border-l dark:border-line dark:bg-surface dark:text-ink"
    >
      <div className="flex flex-1 items-center">
        <div className="w-full max-w-110 rounded-2xl border border-current/10 bg-current/3">
          <div className="border-b border-current/10 px-6 pt-5 pb-5">
            <p className="text-xs opacity-55 first-letter:uppercase">
              {month} · {t.spent}
            </p>
            <p className="tabular mt-1.5 text-[32px] leading-none font-semibold tracking-tight">
              <span className="mr-1.5 text-xl font-medium opacity-55">L</span>8,742.35
            </p>
          </div>
          {days.map(({ day, rows }) => (
            <div key={day} className="px-6 pt-4 pb-2">
              <p className="mb-1 text-[11px] font-medium tracking-wide uppercase opacity-45">{t[day]}</p>
              <ul>
                {rows.map((r) => (
                  <li key={r.merchant} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-current/15 text-[10px] font-semibold tracking-wide">
                      {r.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.merchant}</span>
                      <span className="block text-xs opacity-50">
                        {r.category} · •••• {r.card}
                      </span>
                    </span>
                    <span className={`tabular text-sm font-medium ${r.amount.startsWith("+") ? "" : "opacity-80"}`}>{r.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="flex items-center gap-2 border-t border-current/10 px-6 py-3.5 text-xs opacity-50">
            <Mail className="size-3.5 shrink-0" />
            {t.source}
          </p>
        </div>
      </div>
      <div className="max-w-110 pt-10">
        <p className="text-[22px] leading-snug font-semibold tracking-tight text-balance">{t.title}</p>
        <p className="mt-3 text-[15px] leading-relaxed opacity-60 text-pretty">{t.body}</p>
      </div>
    </aside>
  );
}

/** Aviso de error en la parte de arriba del formulario. */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-6 rounded-xl border border-bad/25 bg-bad/5 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
      {message}
    </p>
  );
}

/** Separador entre el botón de Google y el formulario. */
export function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
