import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AuthError, AuthHeading, AuthSplit, OrDivider } from "@/components/auth-shell";
import { PasswordInput } from "@/components/form/password-input";
import { GoogleButton } from "@/components/google-button";
import { getLocale, getT } from "@/i18n/server";
import { initScope } from "@/lib/auth";

export async function generateMetadata() {
  await initScope();
  return { title: getT().auth.login.metaTitle };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  // Con sesión iniciada no tiene sentido mostrar el login
  if (await initScope()) redirect("/");
  const { error } = await searchParams;
  const all = getT();
  const t = all.auth.login;
  const e = all.auth.errors;
  const errors: Record<string, string> = {
    google: e.google,
    google_cancelled: e.googleCancelled,
    google_unverified: e.googleUnverified,
    google_exists: e.googleExists,
    google_config: e.googleNotConfigured,
  };
  const code = Array.isArray(error) ? error[0] : error;
  const message = code ? (errors[code] ?? e.google) : null;

  return (
    <AuthSplit legal={all.legal} panel={all.auth.panel} locale={getLocale()}>
      <AuthHeading title={t.title} subtitle={t.subtitle} />
      <AuthError message={message} />
      <GoogleButton label={t.google} />
      <OrDivider label={t.or} />
      <ActionForm action={login} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">{t.email}</label>
          <input id="email" name="email" type="email" autoComplete="username" required className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">{t.password}</label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        <SubmitButton pendingText={t.pending} className="btn-primary mt-2 h-11 w-full">
          {t.submit}
        </SubmitButton>
      </ActionForm>
      <p className="mt-8 text-sm text-ink-2">
        {t.noAccount}{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-4 decoration-line-strong transition hover:decoration-ink">
          {t.createAccount}
        </Link>
      </p>
    </AuthSplit>
  );
}
