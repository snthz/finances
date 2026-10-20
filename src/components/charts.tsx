"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { fmt, useT } from "@/i18n/client";
import { fmtUsd } from "@/lib/ai-models";

function fmtMoney(n: number, symbol: string) {
  return `${n < 0 ? "-" : ""}${symbol} ${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtCompact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-ink-2">
          <span className="inline-block size-2 rounded-full" style={{ background: r.color }} />
          <span>{r.label}</span>
          <span className="tabular ml-auto pl-3 font-medium text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, symbol, height = "h-64" }: {
  /** `title`: encabezado del tooltip si difiere de la etiqueta del eje (ej. fecha completa) */
  data: { label: string; title?: string; income: number; expense: number }[];
  symbol: string;
  height?: string;
}) {
  const t = useT().forms.charts;
  const Content = ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as { title?: string; income: number; expense: number };
    return (
      <TooltipBox
        title={p.title ?? String(label)}
        rows={[
          { label: t.income, value: fmtMoney(p.income, symbol), color: "var(--series-income)" },
          { label: t.expenses, value: fmtMoney(p.expense, symbol), color: "var(--series-expense)" },
          { label: t.net, value: fmtMoney(p.income - p.expense, symbol), color: "transparent" },
        ]}
      />
    );
  };
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: "var(--series-income)" }} />{t.income}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: "var(--series-expense)" }} />{t.expenses}</span>
      </div>
      <div className={height}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} width={44} tickFormatter={(v: number) => fmtCompact(v)} />
            <Tooltip content={Content} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="income" name={t.income} fill="var(--series-income)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="expense" name={t.expenses} fill="var(--series-expense)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Una sola serie en barras (ej. gasto promedio por día de la semana). */
export function ValueBarChart({ data, symbol, seriesLabel, height = "h-48" }: {
  data: { label: string; title?: string; value: number; note?: string }[];
  symbol: string;
  seriesLabel: string;
  height?: string;
}) {
  const Content = ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as (typeof data)[number];
    return (
      <TooltipBox
        title={p.title ?? String(label)}
        rows={[
          { label: seriesLabel, value: fmtMoney(p.value, symbol), color: "var(--series-1)" },
          ...(p.note ? [{ label: p.note, value: "", color: "transparent" }] : []),
        ]}
      />
    );
  };
  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={2} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axis} width={44} tickFormatter={(v: number) => fmtCompact(v)} />
          <Tooltip content={Content} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="value" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gasto acumulado del periodo frente al anterior, en el mismo eje. `current` es null en días futuros. */
export function CumulativeChart({ data, symbol, labels }: {
  data: { label: string; title?: string; prevTitle?: string; current: number | null; previous: number | null }[];
  symbol: string;
  labels: { current: string; previous: string };
}) {
  const Content = ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as (typeof data)[number];
    return (
      <TooltipBox
        title={p.title ?? String(label)}
        rows={[
          ...(p.current !== null ? [{ label: labels.current, value: fmtMoney(p.current, symbol), color: "var(--series-expense)" }] : []),
          ...(p.previous !== null ? [{ label: p.prevTitle ? `${labels.previous} · ${p.prevTitle}` : labels.previous, value: fmtMoney(p.previous, symbol), color: "var(--series-income)" }] : []),
        ]}
      />
    );
  };
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 rounded-full" style={{ background: "var(--series-expense)" }} />{labels.current}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 rounded-full" style={{ background: "var(--series-income)" }} />{labels.previous}</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={8} />
            <YAxis {...axis} width={44} tickFormatter={(v: number) => fmtCompact(v)} />
            <Tooltip content={Content} cursor={{ stroke: "var(--line-strong)" }} />
            <Line dataKey="previous" stroke="var(--series-income)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
            <Line dataKey="current" stroke="var(--series-expense)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Dona de participación (máx. 6 porciones: el resto llega ya agrupado en "Otras").
 * Monocromática: cada porción es un gris de la escala --pie-N y la leyenda lleva nombre, monto y %.
 */
export function DonutChart({ data, total, centerLabel, aria }: {
  data: { key: string; name: string; value: number; display: string; href?: string }[];
  total: string;
  centerLabel: string;
  aria: string;
}) {
  const sum = data.reduce((a, b) => a + b.value, 0);
  const pct = (v: number) => (sum > 0 ? `${((v / sum) * 100).toFixed(0)}%` : "0%");
  const color = (i: number) => `var(--pie-${Math.min(i + 1, 6)})`;
  const Content = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as (typeof data)[number] & { i: number };
    return <TooltipBox title={p.name} rows={[{ label: pct(p.value), value: p.display, color: color(p.i) }]} />;
  };
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative size-44 shrink-0" role="img" aria-label={aria}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={Content} />
            <Pie
              data={data.map((d, i) => ({ ...d, i }))}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={d.key} fill={color(i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[11px] text-muted">{centerLabel}</span>
          <span className="text-sm font-semibold break-all">{total}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {data.map((d, i) => {
          const row = (
            <>
              <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: color(i), boxShadow: "inset 0 0 0 1px var(--line)" }} />
              <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
              <span className="tabular shrink-0 text-ink-2">{d.display}</span>
              <span className="tabular w-9 shrink-0 text-right text-xs text-muted">{pct(d.value)}</span>
            </>
          );
          return (
            <li key={d.key}>
              {d.href ? (
                <Link href={d.href} className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-surface-2/60">{row}</Link>
              ) : (
                <div className="flex items-center gap-2 py-1 text-sm">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Costo diario de la IA (USD), una barra por día. */
export function AiCostChart({ data, labels }: {
  data: { day: string; label: string; cost: number; calls: number; tokens: number }[];
  labels: { cost: string; calls: string; tokens: string; aria: string };
}) {
  const Content = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as (typeof data)[number];
    return (
      <TooltipBox
        title={p.label}
        rows={[
          { label: labels.cost, value: fmtUsd(p.cost), color: "var(--series-1)" },
          { label: labels.calls, value: String(p.calls), color: "transparent" },
          { label: labels.tokens, value: fmtCompact(p.tokens), color: "transparent" },
        ]}
      />
    );
  };
  return (
    <div className="h-48" role="img" aria-label={labels.aria}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={2} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...axis} width={52} tickFormatter={(v: number) => `$${v < 0.1 ? v.toFixed(3) : v.toFixed(2)}`} />
          <Tooltip content={Content} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="cost" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
