"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
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

export function TrendChart({ data, symbol }: {
  data: { label: string; income: number; expense: number }[];
  symbol: string;
}) {
  const t = useT().forms.charts;
  const Content = ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as { income: number; expense: number };
    return (
      <TooltipBox
        title={String(label)}
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
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} width={44} tickFormatter={(v: number) => fmtCompact(v)} />
            <Tooltip content={Content} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="income" name={t.income} fill="var(--series-income)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="expense" name={t.expenses} fill="var(--series-expense)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DailyChart({ data, symbol, monthName }: {
  data: { day: number; total: number }[];
  symbol: string;
  monthName: string;
}) {
  const t = useT().forms.charts;
  const Content = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as { day: number; total: number };
    return (
      <TooltipBox
        title={fmt(t.dayOf, { day: p.day, month: monthName })}
        rows={[{ label: t.expenses, value: fmtMoney(p.total, symbol), color: "var(--series-1)" }]}
      />
    );
  };
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={2} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="day" {...axis} interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axis} width={44} tickFormatter={(v: number) => fmtCompact(v)} />
          <Tooltip content={Content} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="total" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
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
          <Bar dataKey="cost" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
