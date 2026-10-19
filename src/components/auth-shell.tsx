import type { Dictionary } from "@/i18n/dictionaries";
import { LegalLinks, PublicHeader } from "./legal-page";

/** Marco de las páginas de acceso (login, registro, configuración inicial): encabezado, tarjeta centrada y enlaces legales. */
export function AuthShell({
  legal,
  width = "sm",
  headerExtra,
  children,
}: {
  legal: Dictionary["legal"];
  width?: "sm" | "lg";
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader>{headerExtra}</PublicHeader>
      <main className="flex flex-1 items-center justify-center px-4 py-8 md:py-12">
        <div className={`card w-full p-6 sm:p-8 ${width === "lg" ? "max-w-lg" : "max-w-sm"}`}>{children}</div>
      </main>
      <footer className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <LegalLinks t={legal} />
      </footer>
    </div>
  );
}

/** Aviso de error en la parte de arriba del formulario. */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-5 rounded-xl border border-line-strong bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
      {message}
    </p>
  );
}

/** Separador "o" entre el botón de Google y el formulario. */
export function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
