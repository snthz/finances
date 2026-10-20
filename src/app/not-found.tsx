import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { getT } from "@/i18n/server";
import { initScope } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  await initScope();
  return { title: getT().common.notFound.metaTitle };
}

/** 404 global: rutas inexistentes y llamadas a notFound(). */
export default async function NotFound() {
  const user = await initScope();
  const t = getT().common.notFound;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="animate-fade-in flex w-full max-w-sm flex-col items-center text-center">
        <Link href="/" aria-label="Finances">
          <Logo size="md" />
        </Link>
        <p className="mt-12 font-mono text-7xl font-semibold tracking-tighter text-ink tabular">404</p>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink">{t.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{t.description}</p>
        <Link href={user ? "/" : "/welcome"} className="btn-primary mt-8 h-11 w-full">
          {user ? t.goHome : t.goWelcome}
        </Link>
      </div>
    </main>
  );
}
