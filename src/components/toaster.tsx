"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Toaster as Sonner } from "sonner";

/** Alertas globales (sonner) con el estilo monocromo de la app. Se usan con `toast()` de "sonner". */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      theme="system"
      gap={8}
      offset={20}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)", left: 12, right: 12 }}
      icons={{
        success: <CircleCheck className="size-4.5" />,
        error: <CircleAlert className="size-4.5" />,
        warning: <TriangleAlert className="size-4.5" />,
        info: <Info className="size-4.5" />,
        loading: <LoaderCircle className="size-4.5 animate-spin text-muted" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-pop",
          title: "font-medium leading-snug",
          description: "mt-0.5 text-xs text-muted",
          // relative + tamaño fijo: el ícono de carga de sonner va en posición absoluta centrado aquí
          icon: "relative flex size-4.5 shrink-0 items-center justify-center",
          error: "border-bad/30! text-bad!",
          warning: "border-warn/30! text-warn!",
          actionButton: "btn-primary ml-auto h-8 px-3 text-xs",
          cancelButton: "btn-subtle ml-auto h-8 px-3 text-xs",
        },
      }}
    />
  );
}
