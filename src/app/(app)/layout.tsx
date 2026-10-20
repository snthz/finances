import { LogOut } from "lucide-react";
import Link from "next/link";
import { logout } from "@/actions/auth";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/brand";
import { Fab, SettingsLink, SideNav, SideSettingsLink, TabBar } from "@/components/nav";
import { NotificationBell } from "@/components/notification-bell";
import { getT } from "@/i18n/server";
import { requireAuth } from "@/lib/auth";
import { notificationsSnapshot } from "@/lib/payments";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const notes = await notificationsSnapshot();
  const t = getT().common.nav;
  return (
    <div className="md:flex">
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-16 items-center justify-between gap-2 px-5">
          <Link href="/" className="rounded-lg">
            <Logo />
          </Link>
          <NotificationBell initial={notes} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-4">
          <SideNav />
        </div>
        <div className="border-t border-line px-3 py-3">
          <SideSettingsLink />
          <div className="mt-2 flex items-center gap-1 rounded-xl border border-line bg-bg/60 p-1.5">
            <Link href="/settings?tab=cuenta" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 transition hover:bg-surface-2">
              <Avatar name={user.name} avatar={user.avatar} size={32} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] font-medium text-ink">{user.name}</span>
                <span className="truncate text-[11.5px] text-muted">{user.email}</span>
              </span>
            </Link>
            <form action={logout}>
              <button aria-label={t.logout} title={t.logout} className="btn-icon size-8 rounded-lg">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
        <Link href="/" className="py-2.5">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell initial={notes} />
          <SettingsLink />
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-10 md:py-10">{children}</main>
      <Fab />
      <TabBar />
    </div>
  );
}
