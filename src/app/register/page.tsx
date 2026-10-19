import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, OrDivider } from "@/components/auth-shell";
import { Logo } from "@/components/brand";
import { GoogleButton } from "@/components/google-button";
import { RegisterForm } from "@/components/register-form";
import { getT } from "@/i18n/server";
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
    <AuthShell legal={all.legal}>
      <div className="mb-6">
        <Logo size="lg" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>
      <GoogleButton label={t.google} />
      <p className="mt-2.5 text-center text-[11px] leading-relaxed text-muted">
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
      <p className="mt-6 text-center text-sm text-muted">
        {t.haveAccount}{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
          {t.signIn}
        </Link>
      </p>
    </AuthShell>
  );
}
