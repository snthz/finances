import { LogOut } from "lucide-react";
import Link from "next/link";
import { logout } from "@/actions/auth";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/brand";
import { Fab, SettingsLink, SideNav, TabBar } from "@/components/nav";
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-3 py-6 md:flex">
        <div className="mb-8 flex items-center justify-between gap-2 pr-1 pl-3">
          <Link href="/">
            <Logo />
          </Link>
          <NotificationBell initial={notes} />
        </div>
        <SideNav />
        <div className="mt-auto flex items-center gap-1 rounded-xl px-1 py-1">
          <Link href="/settings?tab=cuenta" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface-2">
            <Avatar name={user.name} avatar={user.avatar} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{user.name}</span>
          </Link>
          <form action={logout}>
            <button aria-label={t.logout} title={t.logout} className="btn-icon size-8">
              <LogOut className="size-4" />
            </button>
          </form>
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
