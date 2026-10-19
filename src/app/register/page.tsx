import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthHeading, AuthSplit, OrDivider } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import { RegisterForm } from "@/components/register-form";
import { getLocale, getT } from "@/i18n/server";
import { initScope } from "@/lib/auth";

export async function generateMetadata() {
  await initScope();
  return { title: getT().auth.register.metaTitle };
}

/** Registro abierto. La moneda y la zona horaria se eligen después, en /onboarding. */
export default async function RegisterPage() {
  if (await initScope()) redirect("/");
  const all = getT();
  const t = all.auth.register;
  return (
    <AuthSplit legal={all.legal} panel={all.auth.panel} locale={getLocale()}>
      <AuthHeading title={t.title} subtitle={t.subtitle} />
      <GoogleButton label={t.google} />
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {t.googleAgree}{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
          {t.terms}
        </Link>{" "}
        {t.and}{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
          {t.privacy}
        </Link>
        {t.end}
      </p>
      <OrDivider label={t.or} />
      <RegisterForm />
      <p className="mt-8 text-sm text-ink-2">
        {t.haveAccount}{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4 decoration-line-strong transition hover:decoration-ink">
          {t.signIn}
        </Link>
      </p>
    </AuthSplit>
  );
}
