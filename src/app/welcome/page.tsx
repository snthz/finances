import {
  ArrowRight,
  CalendarClock,
  Coins,
  CreditCard,
  Languages,
  Lock,
  Mail,
  Monitor,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tags,
  Target,
  WifiOff,
  Zap,
  LayoutGrid,
  MousePointerClick,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { InstallButton } from "@/components/install-button";
import { LanguageToggle } from "@/components/language-toggle";
import { CONTACT_EMAIL } from "@/components/legal-page";
import { getT } from "@/i18n/server";
import { initScope } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  await initScope();
  const t = getT().landing;
  return { title: { absolute: t.metaTitle }, description: t.metaDescription, robots: { index: true, follow: true } };
}

const FEATURE_ICONS = [Zap, Coins, Target, CalendarClock, CreditCard, Tags, Sparkles, Languages];
const PWA_ICONS = [LayoutGrid, MousePointerClick, WifiOff, Lock];
const PLATFORM_ICONS = [Smartphone, Smartphone, Monitor];

/** Landing pública: qué es la app, cómo funciona y cómo instalarla como PWA. */
export default async function WelcomePage() {
  const user = await initScope();
  const t = getT().landing;
  // Con sesión: abrir la app. Visitantes: crear cuenta (principal) o entrar (secundario)
  const cta = user ? { href: "/", label: t.openApp } : { href: "/register", label: t.createAccount };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-8">
          <Link href="/welcome" aria-label="Finances">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            {!user && (
              <Link href="/login" className="btn h-9 px-3 text-ink-2 hover:text-ink">
                {t.signIn}
              </Link>
            )}
            <Link href={cta.href} className={`btn-primary h-9 ${user ? "" : "hidden sm:inline-flex"}`}>
              {cta.label}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 md:px-8">
        {/* Hero */}
        <section className="grid items-center gap-12 py-14 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <p className="mb-4 text-xs font-medium tracking-wide text-muted uppercase">{t.hero.eyebrow}</p>
            <h1 className="text-[40px] leading-[1.05] font-semibold tracking-tight text-balance md:text-[56px]">{t.hero.title}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2 text-pretty">{t.hero.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={cta.href} className="btn-primary h-11 px-5">
                {cta.label} <ArrowRight className="size-4" />
              </Link>
              {!user && (
                <Link href="/login" className="btn-ghost h-11 px-5">
                  {t.signIn}
                </Link>
              )}
              <InstallButton label={t.install} />
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted">
              <ShieldCheck className="size-3.5 shrink-0" />
              {t.hero.note}
            </p>
          </div>
          <Demo t={t.demo} />
        </section>

        {/* Cómo funciona */}
        <section className="border-t border-line py-16 md:py-20">
          <SectionTitle title={t.how.title} subtitle={t.how.subtitle} />
          <ol className="grid gap-4 md:grid-cols-3">
            {t.how.steps.map((s, i) => (
              <li key={s.title} className="card p-6">
                <span className="mb-5 flex size-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-bg">{i + 1}</span>
                <h3 className="text-[17px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Funciones */}
        <section className="border-t border-line py-16 md:py-20">
          <SectionTitle title={t.features.title} />
          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.features.items.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? Sparkles;
              return (
                <li key={f.title}>
                  <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-surface-2">
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* PWA */}
        <section className="border-t border-line py-16 md:py-20">
          <SectionTitle title={t.pwa.title} subtitle={t.pwa.subtitle} />
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <ul className="grid gap-4 sm:grid-cols-2">
              {t.pwa.facts.map((f, i) => {
                const Icon = PWA_ICONS[i] ?? Smartphone;
                return (
                  <li key={f.title} className="card p-5">
                    <Icon className="mb-3 size-5 text-ink-2" strokeWidth={1.8} />
                    <h3 className="text-[15px] font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.body}</p>
                  </li>
                );
              })}
            </ul>
            <div className="card bg-ink p-6 text-bg">
              <h3 className="text-[17px] font-semibold tracking-tight">{t.pwa.installTitle}</h3>
              <ul className="mt-5 space-y-5">
                {t.pwa.platforms.map((p, i) => {
                  const Icon = PLATFORM_ICONS[i] ?? Smartphone;
                  return (
                    <li key={p.name} className="flex gap-3">
                      <Icon className="mt-0.5 size-4.5 shrink-0 opacity-70" />
                      <div>
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="mt-1 text-sm leading-relaxed opacity-75">{p.steps}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <InstallButton label={t.install} className="btn mt-6 h-10 w-full bg-bg text-ink hover:opacity-90" />
            </div>
          </div>
        </section>

        {/* Privacidad */}
        <section className="border-t border-line py-16 md:py-20">
          <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
            <div>
              <ShieldCheck className="mb-4 size-8" strokeWidth={1.6} />
              <h2 className="text-[28px] leading-tight font-semibold tracking-tight">{t.privacy.title}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t.privacy.body}</p>
              <Link href="/privacy" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                {t.privacy.link} <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <ul className="divide-y divide-line border-y border-line">
              {t.privacy.items.map((item) => (
                <li key={item} className="flex gap-3 py-4 text-[15px] leading-relaxed text-ink-2">
                  <Lock className="mt-1 size-4 shrink-0 text-ink" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Llamado final */}
        <section className="py-16 md:py-24">
          <div className="card flex flex-col items-start gap-5 p-8 md:flex-row md:items-center md:justify-between md:p-10">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{t.cta.title}</h2>
              <p className="mt-2 text-ink-2">{t.cta.body}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!user && (
                <Link href="/login" className="btn-ghost h-11 shrink-0 px-5">
                  {t.signIn}
                </Link>
              )}
              <Link href={cta.href} className="btn-primary h-11 shrink-0 px-5">
                {cta.label} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex flex-col gap-2">
            <Logo size="sm" />
            <span>{t.footer.tagline}</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/terms" className="transition hover:text-ink">
              {t.footer.terms}
            </Link>
            <Link href="/privacy" className="transition hover:text-ink">
              {t.footer.privacy}
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-ink">
              {t.footer.contact}: {CONTACT_EMAIL}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-10 max-w-2xl">
      <h2 className="text-[28px] leading-tight font-semibold tracking-tight md:text-[34px]">{title}</h2>
      {subtitle && <p className="mt-3 text-[16px] leading-relaxed text-ink-2 text-pretty">{subtitle}</p>}
    </div>
  );
}

/** Ilustración: una alerta del banco que se convierte en movimiento. */
function Demo({ t }: { t: ReturnType<typeof getT>["landing"]["demo"] }) {
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden>
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-2">
            <Mail className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t.emailFrom}</p>
            <p className="text-xs text-muted">{t.emailSubject}</p>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink-2">{t.emailBody}</p>
      </div>

      <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted">
        <span className="h-6 w-px bg-line-strong" />
        <Zap className="size-3.5" />
        {t.arrow}
        <span className="h-6 w-px bg-line-strong" />
      </div>

      <div className="card p-4 shadow-pop">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-2">
            <CreditCard className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{t.txMerchant}</p>
            <p className="truncate text-xs text-muted">{t.txMeta}</p>
          </div>
          <span className="tabular font-semibold">-L 450.00</span>
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-ink-2">{t.budgetLabel}</span>
            <span className="tabular text-muted">{t.budgetValue}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-[62%] rounded-full bg-ink" />
          </div>
        </div>
      </div>
    </div>
  );
}
