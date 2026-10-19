"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLanguage } from "@/actions/auth";
import { useLocale } from "@/i18n/client";
import { LOCALE_NAMES, LOCALES } from "@/i18n/config";

/** Selector EN | ES para las páginas públicas: guarda la cookie (y el ajuste si hay sesión) y recarga. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label="Language / Idioma" className={`inline-flex h-8 shrink-0 items-center rounded-full bg-surface-2 p-0.5 ${pending ? "opacity-60" : ""} ${className}`}>
      {LOCALES.map((l) => {
        const on = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            title={LOCALE_NAMES[l]}
            aria-pressed={on}
            disabled={pending}
            onClick={() => {
              if (on) return;
              startTransition(async () => {
                await setLanguage(l);
                router.refresh();
              });
            }}
            className={`h-7 rounded-full px-2.5 text-[11px] font-semibold tracking-wide uppercase transition ${
              on ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
