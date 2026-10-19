import Link from "next/link";
import { Fragment } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { LegalDoc, LegalItem } from "@/i18n/messages/legal";
import { Logo } from "./brand";
import { LanguageToggle } from "./language-toggle";

export const CONTACT_EMAIL = "hello@fallxnstudio.com";

type LegalT = Dictionary["legal"];

/** Convierte emails y URLs del texto en enlaces. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.]+\w)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^https?:\/\//.test(p))
          return (
            <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2 hover:text-ink">
              {p}
            </a>
          );
        if (/^[\w.+-]+@[\w-]+\.[\w.]+\w$/.test(p))
          return (
            <a key={i} href={`mailto:${p}`} className="font-medium text-ink underline underline-offset-2">
              {p}
            </a>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function Item({ item }: { item: LegalItem }) {
  if (typeof item === "string") return <Rich text={item} />;
  return (
    <>
      <strong className="font-semibold text-ink">{item.lead}</strong> <Rich text={item.text} />
    </>
  );
}

/** Encabezado de las páginas públicas: marca (a /welcome) e idioma. */
export function PublicHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link href="/welcome" aria-label="Finances">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          {children}
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}

/** Enlaces a Términos, Privacidad y contacto (pie de login, registro y páginas legales). */
export function LegalLinks({ t, className = "" }: { t: LegalT; className?: string }) {
  return (
    <nav className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted ${className}`}>
      <Link href="/terms" className="transition hover:text-ink">
        {t.terms}
      </Link>
      <Link href="/privacy" className="transition hover:text-ink">
        {t.privacy}
      </Link>
      <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-ink">
        {CONTACT_EMAIL}
      </a>
    </nav>
  );
}

/** Página legal de lectura larga (Términos / Privacidad). */
export function LegalPage({ doc, t }: { doc: LegalDoc; t: LegalT }) {
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{t.effective}</p>
        <h1 className="mt-3 text-[34px] leading-tight font-semibold tracking-tight text-balance md:text-[44px]">{doc.title}</h1>
        <div className="mt-5 space-y-4 text-[16px] leading-relaxed text-ink-2">
          {doc.intro.map((p) => (
            <p key={p}>
              <Rich text={p} />
            </p>
          ))}
        </div>

        <nav aria-label={t.contents} className="card mt-8 p-5">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">{t.contents}</p>
          <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {doc.sections.map((s) => (
              <li key={s.id} className="min-w-0">
                <a href={`#${s.id}`} className="text-ink-2 transition hover:text-ink">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="text-xl font-semibold tracking-tight md:text-[22px]">{s.title}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-2">
                {s.body?.map((p) => (
                  <p key={p}>
                    <Rich text={p} />
                  </p>
                ))}
                {s.items && (
                  <ul className="list-disc space-y-2 pl-5 marker:text-muted">
                    {s.items.map((it, i) => (
                      <li key={i} className="pl-1">
                        <Item item={it} />
                      </li>
                    ))}
                  </ul>
                )}
                {s.after?.map((p) => (
                  <p key={p}>
                    <Rich text={p} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <PublicFooter t={t} />
    </div>
  );
}

export function PublicFooter({ t }: { t: LegalT }) {
  return (
    <footer className="border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between md:px-8">
        <span>
          {t.rights} · {t.operator}
        </span>
        <LegalLinks t={t} />
      </div>
    </footer>
  );
}
