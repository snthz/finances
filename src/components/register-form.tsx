"use client";

import Link from "next/link";
import { register } from "@/actions/auth";
import { useT } from "@/i18n/client";
import { ActionForm, SubmitButton } from "./action-form";
import { PasswordInput } from "./form/password-input";

/** Formulario de registro: sólo datos de acceso y aceptación de los términos. */
export function RegisterForm() {
  const t = useT().auth.register;
  return (
    <ActionForm action={register} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">{t.name}</label>
        <input id="name" name="name" required maxLength={80} autoComplete="name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">{t.email}</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.password}</label>
        <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" />
        <p className="hint">{t.passwordHint}</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">{t.confirm}</label>
        <PasswordInput id="confirm" name="confirm" required minLength={8} autoComplete="new-password" />
      </div>

      <label className="flex cursor-pointer items-start gap-3 pt-1 text-[13px] leading-relaxed text-ink-2">
        <input type="checkbox" name="terms" required className="peer sr-only" />
        <span
          aria-hidden
          className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border border-line-strong bg-surface transition peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
        >
          <svg viewBox="0 0 12 12" className="size-3 text-bg" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.2 5 8.5l4.5-5" />
          </svg>
        </span>
        <span>
          {t.agree}{" "}
          <Link href="/terms" target="_blank" className="font-medium text-ink underline underline-offset-2">
            {t.terms}
          </Link>{" "}
          {t.and}{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-ink underline underline-offset-2">
            {t.privacy}
          </Link>
          {t.end}
        </span>
      </label>

      <SubmitButton pendingText={t.pending} className="btn-primary h-11 w-full">
        {t.submit}
      </SubmitButton>
    </ActionForm>
  );
}
