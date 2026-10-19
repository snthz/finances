import { redirect } from "next/navigation";
import { logout } from "@/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { fmt, getLocale, getT } from "@/i18n/server";
import { initScope, requireAuth } from "@/lib/auth";
import { catalogFor, COMMON_TIMEZONES } from "@/lib/currency-catalog";

export async function generateMetadata() {
  await initScope();
  return { title: getT().auth.onboarding.metaTitle };
}

/** Configuración inicial tras crear la cuenta: idioma, monedas, zona horaria y (opcional) clave de IA. */
export default async function OnboardingPage() {
  const user = await requireAuth({ onboarding: true });
  if (user.onboardedAt) redirect("/");
  const all = getT();
  const t = all.auth.onboarding;
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  return (
    <AuthShell
      legal={all.legal}
      width="lg"
      headerExtra={
        <form action={logout}>
          <button className="btn h-8 px-3 text-xs text-muted hover:text-ink">{t.signOut}</button>
        </form>
      }
    >
      <div className="mb-7">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{t.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">{fmt(t.title, { name: firstName })}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t.subtitle}</p>
      </div>
      <OnboardingForm catalog={catalogFor(getLocale())} timezones={COMMON_TIMEZONES} />
    </AuthShell>
  );
}
