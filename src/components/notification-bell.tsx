"use client";

import { Bell, BellRing, CircleAlert, CircleCheck, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { readNotifications } from "@/actions/payments";
import { fmt, plural, useT } from "@/i18n/client";
import type { NotificationsSnapshot } from "@/lib/payments";
import { PopoverPortal, useAnchoredPopover } from "./form/popover";

const KIND_ICON: Record<string, React.ReactNode> = {
  reminder: <BellRing className="size-4" />,
  overdue: <CircleAlert className="size-4" />,
  charged: <CreditCard className="size-4" />,
  completed: <CircleCheck className="size-4" />,
  paid: <CircleCheck className="size-4" />,
};

function ago(iso: string, l: ReturnType<typeof useT>["payments"]["bell"]) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return l.now;
  if (s < 3600) return fmt(l.minutesAgo, { n: Math.floor(s / 60) });
  if (s < 86400) return fmt(l.hoursAgo, { n: Math.floor(s / 3600) });
  const d = Math.floor(s / 86400);
  return d === 1 ? l.yesterday : plural(d, l.daysAgo);
}

/** Campanita con los avisos de pagos. Se actualiza cada minuto y al volver a la app. */
export function NotificationBell({ initial }: { initial: NotificationsSnapshot }) {
  const t = useT().payments.bell;
  const [data, setData] = useState(initial);
  const { anchorRef, popRef, open, setOpen, style } = useAnchoredPopover<HTMLButtonElement>();
  const router = useRouter();

  // El layout se vuelve a renderizar tras las Server Actions: toma esos datos frescos
  useEffect(() => setData(initial), [initial]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // Sin conexión: se mantiene lo último que se vio
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  function markRead(ids?: number[]) {
    setData((d) => ({
      unread: ids ? Math.max(0, d.unread - d.items.filter((i) => !i.read && ids.includes(i.id)).length) : 0,
      items: d.items.map((i) => (!ids || ids.includes(i.id) ? { ...i, read: true } : i)),
    }));
    void readNotifications(ids);
  }

  const unreadLabel = data.unread > 9 ? "9+" : String(data.unread);
  // Más ancho que el botón: se reubica para no salirse de la pantalla (la campanita puede estar a la derecha)
  const vw = typeof window === "undefined" ? 400 : window.innerWidth;
  const width = Math.min(380, vw - 16);
  const left = Math.max(8, Math.min(Number(style.left ?? 8), vw - width - 8));

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={data.unread ? fmt(t.unreadAria, { n: data.unread }) : t.title}
        aria-expanded={open}
        className={`btn-icon relative ${open ? "bg-surface-2 text-ink" : ""}`}
      >
        <Bell className="size-5" />
        {data.unread > 0 && (
          <span className="tabular absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] leading-none font-semibold text-bg ring-2 ring-bg">
            {unreadLabel}
          </span>
        )}
      </button>
      <PopoverPortal open={open} popRef={popRef} style={{ ...style, left, width, maxHeight: 480 }}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <span className="text-sm font-semibold">{t.title}</span>
          {data.unread > 0 && (
            <button type="button" onClick={() => markRead()} className="text-xs font-medium text-ink-2 hover:text-ink">
              {t.markAllRead}
            </button>
          )}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {data.items.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted">
              <Bell className="size-5 text-ink-2" />
              {t.empty}
            </li>
          )}
          {data.items.map((n) => (
            <li key={n.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => {
                  if (!n.read) markRead([n.id]);
                  setOpen(false);
                  if (n.href) router.push(n.href, { scroll: false });
                }}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60 ${n.read ? "" : "bg-surface-2/40"}`}
              >
                <span
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                    n.kind === "overdue" ? "bg-bad/10 text-bad" : n.read ? "bg-surface-2 text-ink-2" : "bg-ink text-bg"
                  }`}
                >
                  {KIND_ICON[n.kind] ?? <Bell className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read ? "text-ink-2" : "font-semibold text-ink"}`}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-muted">{ago(n.createdAt, t)}</span>
                </span>
                {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-ink" aria-label={t.unread} />}
              </button>
            </li>
          ))}
        </ul>
        <Link href="/payments" onClick={() => setOpen(false)} className="border-t border-line px-4 py-3 text-center text-xs font-medium text-ink-2 hover:bg-surface-2/60 hover:text-ink">
          {t.viewAll}
        </Link>
      </PopoverPortal>
    </>
  );
}
