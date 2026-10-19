"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

/**
 * Panel que sube desde abajo. Su apertura la controla la URL (?new=1, ?edit=…),
 * así el servidor ya lo renderiza con los datos. Cerrar = navegar a `closeHref`.
 * Se cierra con la X, tocando fuera, con Escape o arrastrándolo hacia abajo.
 */
export function Sheet({
  title,
  description,
  closeHref,
  children,
  size = "md",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  closeHref: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  const t = useT();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ startY: number; dy: number; t: number } | null>(null);
  const [dy, setDy] = useState(0);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => router.push(closeHref, { scroll: false }), 220);
  }, [closing, closeHref, router]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  function onPointerDown(e: React.PointerEvent) {
    // Sólo se arrastra desde la cabecera, para no interferir con el scroll del contenido
    drag.current = { startY: e.clientY, dy: 0, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = Math.max(0, e.clientY - drag.current.startY);
    drag.current.dy = d;
    setDy(d);
  }
  function onPointerUp() {
    if (!drag.current) return;
    const { dy: d, t } = drag.current;
    const velocity = d / Math.max(1, Date.now() - t);
    drag.current = null;
    if (d > 120 || velocity > 0.6) close();
    else setDy(0);
  }

  const translate = closing ? "translateY(100%)" : dy ? `translateY(${dy}px)` : undefined;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className={`animate-fade-in absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px] transition-opacity duration-200 ${closing ? "opacity-0" : ""}`}
        onClick={close}
      />
      <div
        ref={panelRef}
        style={{ transform: translate, transition: drag.current ? "none" : "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)" }}
        className={`animate-sheet-in absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-b-0 border-line bg-surface shadow-pop ${
          size === "lg" ? "max-w-3xl" : "max-w-xl"
        }`}
      >
        <div
          className="shrink-0 cursor-grab touch-none px-5 pt-2.5 pb-3 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-surface-3" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={close} onPointerDown={(e) => e.stopPropagation()} aria-label={t.common.actions.close} className="btn-icon -mt-0.5 -mr-2 bg-surface-2">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

/** Barra de acciones fija al pie del sheet (dentro del <form>). */
export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    // Se pega al borde inferior real (compensa el padding del contenedor) y respeta el área segura del iPhone
    <div className="sticky -bottom-[max(1.25rem,env(safe-area-inset-bottom))] -mx-5 mt-6 -mb-[max(1.25rem,env(safe-area-inset-bottom))] flex items-center gap-2 border-t border-line bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}
