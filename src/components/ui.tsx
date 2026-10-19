import Link from "next/link";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-ink-2">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = "", padded = true }: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card min-w-0 ${padded ? "p-5" : ""} ${className}`}>
      {(title || actions) && (
        <header className={`flex items-start justify-between gap-3 ${padded ? "mb-4" : "px-5 pt-5 pb-3"}`}>
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

type Tone = "neutral" | "solid" | "outline" | "bad" | "warn" | "good" | "accent";

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-surface-2 text-ink-2",
    solid: "bg-ink text-bg",
    outline: "border border-line-strong text-ink-2",
    good: "bg-ink text-bg",
    accent: "bg-surface-2 text-ink",
    bad: "bg-bad/10 text-bad",
    warn: "bg-warn/12 text-warn",
  };
  return <span className={`inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function Empty({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">
      {icon && <div className="text-ink-2">{icon}</div>}
      {children}
    </div>
  );
}

/** Ícono de categoría/cuenta en un círculo neutro */
export function IconBubble({ children, size = "md" }: { children: React.ReactNode; size?: "sm" | "md" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink ${size === "sm" ? "size-7" : "size-10"}`}>
      {children}
    </span>
  );
}

/** Barra horizontal: etiqueta y valor en tinta, la marca en gris/tinta. */
export function HBar({ label, value, display, max, href, extra, tone = "ink" }: {
  label: React.ReactNode;
  value: number;
  display: string;
  max: number;
  href?: string;
  extra?: React.ReactNode;
  tone?: "ink" | "muted" | "bad";
}) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  const color = { ink: "var(--ink)", muted: "var(--muted)", bad: "var(--bad)" }[tone];
  const inner = (
    <div className="group py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-ink">{label}</span>
        <span className="tabular shrink-0 text-ink-2">{display}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-all group-hover:opacity-70" style={{ width: `${pct}%`, background: color }} />
      </div>
      {extra}
    </div>
  );
  return href ? (
    <Link href={href} className="-mx-2 block rounded-xl px-2 hover:bg-surface-2/60">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "bad" | "neutral"; children: React.ReactNode }) {
  const cls = {
    warn: "border-warn/30 bg-warn/8 text-ink",
    bad: "border-bad/30 bg-bad/8 text-bad",
    neutral: "border-line bg-surface-2 text-ink-2",
  }[tone];
  return <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
