"use client";

import { CalendarClock, ChartPie, CreditCard, LayoutGrid, ListOrdered, Mail, Plus, Settings, Shapes, Target, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import type { Dictionary } from "@/i18n/dictionaries";

type NavKey = Exclude<keyof Dictionary["common"]["nav"], "sections">;
type SectionKey = keyof Dictionary["common"]["nav"]["sections"];

// `mobile`: aparece en la barra inferior (máx. 5); el resto sólo en la barra lateral.
// `section`: grupo en la barra lateral.
const LINKS = [
  { href: "/", label: "home" as NavKey, icon: LayoutGrid, mobile: true, section: "main" as SectionKey },
  { href: "/transactions", label: "transactions" as NavKey, icon: ListOrdered, mobile: true, section: "main" as SectionKey },
  { href: "/stats", label: "stats" as NavKey, icon: ChartPie, mobile: true, section: "main" as SectionKey },
  // En móvil se llega desde la tarjeta de presupuesto del resumen
  { href: "/budget", label: "budget" as NavKey, icon: Target, mobile: false, section: "main" as SectionKey },
  { href: "/payments", label: "payments" as NavKey, icon: CalendarClock, mobile: true, section: "manage" as SectionKey },
  { href: "/accounts", label: "accounts" as NavKey, icon: CreditCard, mobile: true, section: "manage" as SectionKey },
  { href: "/categories", label: "categories" as NavKey, icon: Shapes, mobile: false, section: "manage" as SectionKey },
  // En móvil se llega desde Ajustes → Correos
  { href: "/email", label: "email" as NavKey, icon: Mail, mobile: false, section: "manage" as SectionKey },
];

const SECTIONS: SectionKey[] = ["main", "manage"];

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

function SideLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] transition-colors ${
        active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink"
      }`}
    >
      {active && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-ink" />}
      <Icon className={`size-4.5 shrink-0 transition-colors ${active ? "text-ink" : "text-muted group-hover:text-ink"}`} strokeWidth={active ? 2.1 : 1.8} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** Barra lateral (escritorio): acción principal y enlaces agrupados por sección */
export function SideNav() {
  const isActive = useActive();
  const t = useT().common.nav;
  return (
    <div className="flex flex-col gap-6">
      <Link href="/transactions?new=1" scroll={false} className="btn-primary h-9 w-full justify-start gap-2 rounded-lg px-3 text-[13.5px] shadow-card">
        <Plus className="size-4" strokeWidth={2.2} />
        {t.newTransaction}
      </Link>
      <nav className="flex flex-col gap-5">
        {SECTIONS.map((section) => (
          <div key={section}>
            <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wider text-muted uppercase">{t.sections[section]}</p>
            <div className="flex flex-col gap-0.5">
              {LINKS.filter((l) => l.section === section).map((l) => (
                <SideLink key={l.href} href={l.href} label={t[l.label]} icon={l.icon} active={isActive(l.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

/** Ajustes al pie de la barra lateral */
export function SideSettingsLink() {
  const isActive = useActive();
  const t = useT().common.nav;
  return <SideLink href="/settings" label={t.settings} icon={Settings} active={isActive("/settings")} />;
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
