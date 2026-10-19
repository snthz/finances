"use client";

import { TriangleAlert } from "lucide-react";
import { useContext, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/i18n/client";
import { PendingContext } from "./action-form";
import { Modal } from "./form/modal";

/**
 * Botón destructivo: abre un diálogo de confirmación y, al aceptar, envía su form
 * (el que lo contiene o el indicado con `form`).
 */
export function ConfirmButton({
  children,
  confirmLabel,
  description,
  actionLabel,
  className = "btn-danger",
  form,
}: {
  children: React.ReactNode;
  /** Pregunta que titula el diálogo (ej. "¿Eliminar para siempre?") */
  confirmLabel?: React.ReactNode;
  /** Qué pasará; por defecto "No se puede deshacer" */
  description?: React.ReactNode;
  /** Texto del botón que confirma; por defecto el del propio botón */
  actionLabel?: React.ReactNode;
  className?: string;
  /** id del <form> a enviar cuando el botón está fuera de él */
  form?: string;
}) {
  const t = useT();
  const { pending: statusPending } = useFormStatus();
  const ctxPending = useContext(PendingContext);
  const pending = statusPending || ctxPending;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  function ask() {
    // Si al form le faltan datos (ej. escribir el email), el navegador lo indica antes de preguntar
    const f = ref.current?.form;
    if (f && !f.checkValidity()) return f.reportValidity();
    setOpen(true);
  }

  function confirm() {
    setOpen(false);
    ref.current?.form?.requestSubmit();
  }

  return (
    <>
      <button ref={ref} type="button" form={form} disabled={pending} className={className} onClick={ask}>
        {pending ? "…" : children}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bad/10 text-bad">
              <TriangleAlert className="size-4" />
            </span>
            {confirmLabel ?? t.forms.confirmDialog.title}
          </span>
        }
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn-subtle h-11 flex-1">
              {t.common.actions.cancel}
            </button>
            <button type="button" onClick={confirm} className="btn h-11 flex-1 bg-bad text-white hover:opacity-90 dark:text-[#0a0a0a]">
              {actionLabel ?? children}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">{description ?? t.forms.confirmDialog.description}</p>
      </Modal>
    </>
  );
}
