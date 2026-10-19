"use client";

import { ChevronDown, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { completeOnboarding, setLanguage } from "@/actions/auth";
import { useLocale, useT } from "@/i18n/client";
import { LOCALE_NAMES, LOCALES } from "@/i18n/config";
import type { CatalogCurrency } from "@/lib/currency-catalog";
import { ActionForm, SubmitButton } from "./action-form";
import { Segmented } from "./form/controls";
import { PasswordInput } from "./form/password-input";
import { Select } from "./form/select";

// Moneda sugerida según la zona horaria del dispositivo (sólo como valor inicial)
const TZ_CURRENCY: Record<string, string> = {
  "America/Tegucigalpa": "HNL",
  "America/Santo_Domingo": "DOP",
  "America/Guatemala": "GTQ",
  "America/El_Salvador": "USD",
  "America/Managua": "NIO",
  "America/Costa_Rica": "CRC",
  "America/Panama": "USD",
  "America/Mexico_City": "MXN",
  "America/Bogota": "COP",
  "America/Lima": "PEN",
  "America/Santiago": "CLP",
  "America/Argentina/Buenos_Aires": "ARS",
  "America/Sao_Paulo": "BRL",
  "America/Toronto": "CAD",
  "America/Vancouver": "CAD",
  "Europe/London": "GBP",
};

function guessCurrency(tz: string, codes: string[]) {
  const code = TZ_CURRENCY[tz] ?? (tz.startsWith("Europe/") ? "EUR" : "USD");
  return codes.includes(code) ? code : "USD";
}

export function OnboardingForm({ catalog, timezones }: { catalog: CatalogCurrency[]; timezones: string[] }) {
  const t = useT().auth.onboarding;
  const locale = useLocale();
  const router = useRouter();
  const [lang, setLang] = useState<string>(locale);
  const [langPending, startLang] = useTransition();
  const [timezone, setTimezone] = useState("UTC");
  const [zones, setZones] = useState(timezones);
  const [base, setBase] = useState("USD");
  const baseTouched = useRef(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [provider, setProvider] = useState("anthropic");

  // Sigue al idioma actual (p. ej. si se cambia desde el selector del encabezado)
  useEffect(() => setLang(locale), [locale]);

  // Preselecciona la zona horaria del dispositivo y una moneda acorde
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    setTimezone(tz);
    if (!timezones.includes(tz)) setZones([tz, ...timezones]);
    if (!baseTouched.current) setBase(guessCurrency(tz, catalog.map((c) => c.code)));
    // Sólo al montar
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeLanguage(v: string) {
    setLang(v);
    // Traduce la pantalla al momento; el idioma también se guarda al terminar
    startLang(async () => {
      await setLanguage(v);
      router.refresh();
    });
  }

  return (
    <ActionForm action={completeOnboarding} className="space-y-6">
      <div className={langPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <span className="label">{t.language}</span>
        <Segmented name="language" value={lang} onChange={changeLanguage} options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="label" htmlFor="baseCurrency">{t.baseCurrency}</label>
          <Select
            id="baseCurrency"
            name="baseCurrency"
            value={base}
            onChange={(v) => {
              baseTouched.current = true;
              setBase(v);
            }}
            searchable
            options={catalog.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}`, hint: c.symbol }))}
          />
          <p className="hint">{t.baseCurrencyHint}</p>
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor="timezone">{t.timezone}</label>
          <Select
            id="timezone"
            name="timezone"
            value={timezone}
            onChange={setTimezone}
            searchable
            options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ").replace("America/", ""), hint: z.split("/")[0] }))}
          />
          <p className="hint">{t.timezoneHint}</p>
        </div>
      </div>

      <fieldset>
        <legend className="label">{t.extraCurrencies}</legend>
        <div className="flex flex-wrap gap-2">
          {catalog
            .filter((c) => c.code !== base)
            .map((c) => (
              <label key={c.code} className="cursor-pointer" title={c.name}>
                <input type="checkbox" name="extraCurrencies" value={c.code} defaultChecked={c.code === "USD"} className="peer sr-only" />
                <span className="inline-flex h-8 items-center rounded-full border border-line px-3 text-xs font-medium text-ink-2 transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-bg peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30">
                  {c.code} {c.symbol}
                </span>
              </label>
            ))}
        </div>
        <p className="hint">{t.extraCurrenciesHint}</p>
      </fieldset>

      {/* IA opcional: los campos sólo se envían si la sección está abierta */}
      <div className="rounded-2xl border border-line">
        <button
          type="button"
          aria-expanded={aiOpen}
          aria-controls="ai-section"
          onClick={() => setAiOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition hover:bg-surface-2/60"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">
            <Sparkles className="size-4.5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t.aiTitle}</span>
            <span className="block truncate text-xs text-muted">{t.aiSummary}</span>
          </span>
          <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${aiOpen ? "rotate-180" : ""}`} />
        </button>
        {aiOpen && (
          <div id="ai-section" className="space-y-4 border-t border-line px-4 pt-4 pb-4">
            <p className="text-[13px] leading-relaxed text-ink-2">{t.aiBody}</p>
            <div>
              <span className="label">{t.aiProvider}</span>
              <Segmented
                name="aiProvider"
                value={provider}
                onChange={setProvider}
                options={[
                  { value: "anthropic", label: "Claude" },
                  { value: "openai", label: "OpenAI" },
                ]}
              />
            </div>
            <div>
              <label className="label" htmlFor="aiKey">{t.aiKey}</label>
              <PasswordInput
                id="aiKey"
                name="aiKey"
                maxLength={400}
                autoComplete="off"
                spellCheck={false}
                placeholder={provider === "openai" ? t.aiKeyPlaceholder.openai : t.aiKeyPlaceholder.anthropic}
                className="font-mono text-sm"
              />
            </div>
            <div className="rounded-xl bg-surface-2 p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <ShieldCheck className="size-4 shrink-0" strokeWidth={1.8} />
                {t.aiSecurityTitle}
              </p>
              <ul className="mt-2 space-y-1 pl-6 text-xs leading-relaxed text-ink-2">
                {t.aiSecurity.map((s) => (
                  <li key={s} className="list-disc marker:text-muted">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <SubmitButton pendingText={t.pending} className="btn-primary h-11 w-full">
        {t.submit}
      </SubmitButton>
    </ActionForm>
  );
}
