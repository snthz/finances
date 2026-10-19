import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { fmt, getT } from "@/i18n/server";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/format";

/** Navegación de mes que conserva el resto de parámetros de la URL. */
export function MonthNav({ month, basePath, params }: { month: string; basePath: string; params: Record<string, string | undefined> }) {
  const href = (m: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "month" && k !== "page") sp.set(k, v);
    sp.set("month", m);
    return `${basePath}?${sp}`;
  };
  const isCurrent = month === currentMonth();
  const t = getT().forms.monthNav;
  return (
    <div className="flex h-10 items-center rounded-xl border border-line bg-surface p-0.5">
      <Link href={href(shiftMonth(month, -1))} className="flex size-9 items-center justify-center rounded-[10px] text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.prev}>
        <ChevronLeft className="size-4" />
      </Link>
      <Link href={href(currentMonth())} className="min-w-32 px-1 text-center text-sm font-medium" title={isCurrent ? undefined : t.current}>
        {monthLabel(month)}
      </Link>
      <Link
        href={href(shiftMonth(month, 1))}
        className={`flex size-9 items-center justify-center rounded-[10px] text-ink-2 hover:bg-surface-2 hover:text-ink ${isCurrent ? "pointer-events-none opacity-30" : ""}`}
        aria-label={t.next}
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

/** "Todo (en base)" + una pestaña por moneda. `current` vacío = consolidado. */
export function CurrencyTabs({ currencies, current, base, basePath, params }: {
  currencies: string[];
  current?: string;
  base: string;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (currencies.length < 2) return null;
  const t = getT().forms.currencyTabs;
  const href = (c?: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "currency") sp.set(k, v);
    if (c) sp.set("currency", c);
    return `${basePath}?${sp}`;
  };
  const tab = (active: boolean) =>
    `flex h-9 items-center rounded-[10px] px-3 text-xs font-medium whitespace-nowrap transition ${active ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-2 hover:text-ink"}`;
  return (
    <div className="flex max-w-full overflow-x-auto rounded-xl bg-surface-2 p-0.5">
      <Link href={href()} className={tab(!current)} title={fmt(t.allTitle, { base })}>
        {fmt(t.all, { base })}
      </Link>
      {currencies.map((c) => (
        <Link key={c} href={href(c)} className={tab(c === current)}>
          {c}
        </Link>
      ))}
    </div>
  );
}
