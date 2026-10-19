import Link from "next/link";
import { getT } from "@/i18n/server";
import { amountText, paymentDetail, type PaymentView } from "@/lib/payments";
import { formatYmd } from "@/lib/format";
import { dueLabel } from "@/lib/payments-shared";
import { CategoryIcon } from "./category-icon";

/** Día y mes en un cuadrito, estilo calendario */
export function DateBlock({ ymd, tone = "neutral" }: { ymd: string; tone?: "neutral" | "solid" | "bad" }) {
  const cls = { neutral: "bg-surface-2 text-ink", solid: "bg-ink text-bg", bad: "bg-bad/10 text-bad" }[tone];
  return (
    <span className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${cls}`}>
      <span className="text-[9px] font-semibold tracking-wide uppercase opacity-70">{formatYmd(ymd, { month: "short" }).replace(".", "")}</span>
      <span className="tabular mt-0.5 text-[17px] font-semibold">{formatYmd(ymd, { day: "numeric" })}</span>
    </span>
  );
}

/** Fila de un vencimiento próximo, con acceso a "Pagar" en los pagos manuales. */
export function PaymentDueRow({ p, back }: { p: PaymentView; back: string }) {
  const t = getT().payments;
  const overdue = p.daysLeft < 0;
  const soon = p.daysLeft <= 1;
  const backParam = back === "/payments" ? "" : `&back=${encodeURIComponent(back)}`;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <DateBlock ymd={p.nextDue} tone={overdue ? "bad" : p.daysLeft === 0 ? "solid" : "neutral"} />
      <Link href={`/payments?edit=${p.id}${backParam}`} scroll={false} className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-medium">
          <CategoryIcon name={p.icon} className="size-4 shrink-0 text-ink-2" />
          <span className="truncate">{p.name}</span>
        </span>
        <span className="block truncate text-xs text-muted">
          <span className={overdue ? "font-medium text-bad" : soon ? "font-medium text-ink" : ""}>{dueLabel(p.daysLeft, t.due)}</span>
          {paymentDetail(p) ? ` · ${paymentDetail(p)}` : ""}
        </span>
      </Link>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="tabular text-sm font-semibold">{amountText(p)}</span>
        {p.payMode === "manual" ? (
          <Link href={`/payments?pay=${p.id}${backParam}`} scroll={false} className="inline-flex h-7 items-center rounded-full bg-ink px-3 text-xs font-medium text-bg transition active:scale-95">
            {t.row.pay}
          </Link>
        ) : (
          <span className="text-[11px] text-muted">{t.row.automatic}</span>
        )}
      </span>
    </li>
  );
}
