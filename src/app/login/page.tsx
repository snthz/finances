import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AuthError, AuthShell, OrDivider } from "@/components/auth-shell";
import { Logo } from "@/components/brand";
import { PasswordInput } from "@/components/form/password-input";
import { GoogleButton } from "@/components/google-button";
import { getT } from "@/i18n/server";
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
    <AuthShell legal={all.legal}>
      <div className="mb-6">
        <Logo size="lg" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>
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
        <SubmitButton pendingText={t.pending} className="btn-primary h-11 w-full">
          {t.submit}
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        {t.noAccount}{" "}
        <Link href="/register" className="font-medium text-ink underline-offset-2 hover:underline">
          {t.createAccount}
        </Link>
      </p>
    </AuthShell>
  );
}
