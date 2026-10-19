"use client";

import { createContext, startTransition, useActionState, useContext, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import type { FormState } from "@/actions/types";
import { useT } from "@/i18n/client";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Estado de envío para <SubmitButton> en forms que no usan <ActionForm>. */
export const PendingContext = createContext(false);

/**
 * Envía el form sin el reseteo automático de React 19 (que borraría lo escrito
 * cuando el servidor devuelve un error).
 */
export function submitWithoutReset(e: React.FormEvent<HTMLFormElement>, run: (fd: FormData, submitter: HTMLElement | null) => void) {
  e.preventDefault();
  const submitter = (e.nativeEvent as SubmitEvent).submitter ?? null;
  const fd = new FormData(e.currentTarget, submitter);
  startTransition(() => run(fd, submitter));
}

export function ActionForm({
  action,
  children,
  className,
  render,
  id,
}: {
  id?: string;
  action: Action;
  children?: React.ReactNode;
  className?: string;
  /** Para mostrar resultados personalizados (ej. pruebas de reglas) */
  render?: (state: FormState) => React.ReactNode;
  /** Obsoleto: los mensajes ahora salen como toast; se acepta por compatibilidad. */
  messages?: "end" | "manual";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  useToastState(state);
  return (
    <form id={id} action={formAction} onSubmit={(e) => submitWithoutReset(e, (fd) => formAction(fd))} className={className}>
      <PendingContext.Provider value={pending}>
        {children}
        {render?.(state)}
      </PendingContext.Provider>
    </form>
  );
}

/** Muestra como toast el error o la confirmación que devuelve una acción. */
export function useToastState(state: FormState) {
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.message) toast.success(state.message);
  }, [state]);
}

/** Obsoleto: los mensajes ya salen como toast desde <ActionForm>. No renderiza nada. */
export function FormMessages() {
  return null;
}

export function SubmitButton({
  children,
  pendingText,
  className = "btn-primary",
  name,
  value,
  pending: pendingProp,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
  /** Estado de envío controlado desde fuera (forms con varias acciones) */
  pending?: boolean;
}) {
  const t = useT();
  const status = useFormStatus();
  const ctxPending = useContext(PendingContext);
  const pending = pendingProp ?? (status.pending || ctxPending);
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending ? (pendingText ?? t.common.actions.saving) : children}
    </button>
  );
}
