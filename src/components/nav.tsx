"use client";

import { CalendarClock, ChartPie, CreditCard, LayoutGrid, ListOrdered, Mail, Plus, Settings, Shapes, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import type { Dictionary } from "@/i18n/dictionaries";

type NavKey = keyof Dictionary["common"]["nav"];

// `mobile`: aparece en la barra inferior (máx. 5); el resto sólo en la barra lateral
const LINKS = [
  { href: "/", label: "home" as NavKey, icon: LayoutGrid, mobile: true },
  { href: "/transactions", label: "transactions" as NavKey, icon: ListOrdered, mobile: true },
  { href: "/stats", label: "stats" as NavKey, icon: ChartPie, mobile: true },
  { href: "/payments", label: "payments" as NavKey, icon: CalendarClock, mobile: true },
  // En móvil se llega desde la tarjeta de presupuesto del resumen
  { href: "/budget", label: "budget" as NavKey, icon: Target, mobile: false },
  { href: "/accounts", label: "accounts" as NavKey, icon: CreditCard, mobile: true },
  { href: "/categories", label: "categories" as NavKey, icon: Shapes, mobile: false },
  // En móvil se llega desde Ajustes → Correos
  { href: "/email", label: "email" as NavKey, icon: Mail, mobile: false },
];

const SETTINGS = { href: "/settings", label: "settings" as NavKey, icon: Settings };

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

/** Barra lateral (escritorio) */
export function SideNav() {
  const isActive = useActive();
  const t = useT().common.nav;
  return (
    <nav className="flex flex-col gap-0.5">
      {[...LINKS, SETTINGS].map((l) => {
        const Icon = l.icon;
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon className="size-4.5" strokeWidth={active ? 2.2 : 1.8} />
            {t[l.label]}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra de pestañas inferior (móvil / PWA) */
export function TabBar() {
  const isActive = useActive();
  const t = useT().common.nav;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5">
        {LINKS.filter((l) => l.mobile).map((l) => {
          const Icon = l.icon;
          const active = isActive(l.href);
          return (
            <Link key={l.href} href={l.href} className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-medium transition ${active ? "text-ink" : "text-muted"}`}>
              <Icon className="size-5.5" strokeWidth={active ? 2.2 : 1.6} />
              {t[l.label]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Botón flotante para agregar un movimiento (móvil) */
export function Fab() {
  const pathname = usePathname();
  const t = useT().common.nav;
  if (pathname.startsWith("/settings")) return null;
  return (
    <Link
      href="/transactions?new=1"
      scroll={false}
      aria-label={t.newTransaction}
      className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-ink text-bg shadow-pop transition active:scale-95 md:hidden"
    >
      <Plus className="size-6" strokeWidth={2.2} />
    </Link>
  );
}

export function SettingsLink() {
  const isActive = useActive();
  const t = useT().common.nav;
  return (
    <Link href="/settings" aria-label={t.settings} className={`btn-icon ${isActive("/settings") ? "bg-ink text-bg hover:bg-ink hover:text-bg" : ""}`}>
      <Settings className="size-5" />
    </Link>
  );
}
