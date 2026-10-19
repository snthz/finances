"use client";

import { Check, CopyCheck, LoaderCircle, Plus, RotateCw, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { aiRuleFromMessage, resolveDuplicate, retryMessage } from "@/actions/email";
import { useT } from "@/i18n/client";
import { ActionForm, PendingContext, SubmitButton, submitWithoutReset, useToastState } from "./action-form";
import { SheetFooter } from "./form/sheet";

/** Acciones de un correo que no generó movimiento: reintentar, crear la regla a mano o con IA. */
export function EmailMessageActions({ id, canRetry, aiEnabled }: { id: number; canRetry: boolean; aiEnabled: boolean }) {
  const t = useT().email.inbox;
  const [state, aiAction, aiPending] = useActionState(aiRuleFromMessage, null);
  useToastState(state);
  const manualHref = `/email?tab=rules&new=1&from=${id}`;

  return (
    <SheetFooter>
      {canRetry && (
        <ActionForm action={retryMessage}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton className="btn-subtle h-11" pendingText="…">
            <RotateCw className="size-4" /> <span className="hidden sm:inline">{t.retry}</span>
          </SubmitButton>
        </ActionForm>
      )}
      <Link href={manualHref} className={`${aiEnabled ? "btn-ghost" : "btn-primary"} h-11 flex-1`}>
        <Wand2 className="size-4" /> {t.manualShort}
      </Link>
      {aiEnabled && (
        <form action={aiAction} onSubmit={(e) => submitWithoutReset(e, (fd) => aiAction(fd))} className="flex flex-1">
          <input type="hidden" name="id" value={id} />
          <PendingContext.Provider value={aiPending}>
            <SubmitButton className="btn-primary h-11 flex-1" pendingText={t.aiShort}>
              <Sparkles className="size-4" /> {t.aiShort}
            </SubmitButton>
          </PendingContext.Provider>
        </form>
      )}
      {aiPending && <AiRuleProgress />}
    </SheetFooter>
  );
}

/** Decisión sobre un correo marcado como duplicado: confirmarlo o crear el movimiento igual. */
export function DuplicateActions({ id, canConfirm }: { id: number; canConfirm: boolean }) {
  const t = useT().email.duplicate;
  return (
    <SheetFooter>
      <ActionForm action={resolveDuplicate} className="flex flex-1 gap-2">
        <input type="hidden" name="id" value={id} />
        <SubmitButton name="decision" value="create" className={`${canConfirm ? "btn-ghost" : "btn-primary"} h-11 flex-1`} pendingText="…">
          <Plus className="size-4" /> {t.create}
        </SubmitButton>
        {canConfirm && (
          <SubmitButton name="decision" value="confirm" className="btn-primary h-11 flex-1" pendingText="…">
            <CopyCheck className="size-4" /> {t.confirm}
          </SubmitButton>
        )}
      </ActionForm>
    </SheetFooter>
  );
}

// Segundos a partir de los cuales se pasa al siguiente paso. Son aproximados: la acción es una
// sola llamada; el último paso queda activo hasta que termina (y la página pasa a la regla creada)
const STEP_AT = [0, 2, 7];

/** Panel mientras la IA crea la regla: pasos, tiempo transcurrido y aviso de que puede tardar. */
function AiRuleProgress() {
  const t = useT().email.inbox.aiProgress;
  const [seconds, setSeconds] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(timer);
  }, []);

  if (!mounted) return null;
  const active = STEP_AT.filter((s) => seconds >= s).length - 1;
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="alertdialog" aria-modal="true" aria-live="polite" aria-label={t.title}>
      <div className="animate-fade-in absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]" />
      <div className="animate-sheet-in sm:animate-pop-in relative w-full rounded-t-[28px] border border-b-0 border-line bg-surface px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-pop sm:max-w-sm sm:rounded-3xl sm:border-b">
        <div className="flex items-center gap-3">
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-bg">
            <Sparkles className="size-4.5" />
            <span className="absolute inset-0 animate-ping rounded-full bg-ink/20 motion-reduce:hidden" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">{t.title}</p>
            <p className="tabular text-xs text-muted">{clock}</p>
          </div>
        </div>
        <ol className="mt-5 space-y-3">
          {t.steps.map((label, i) => {
            const state = i < active ? "done" : i === active ? "active" : "todo";
            return (
              <li key={label} className={`flex items-center gap-3 text-sm transition-colors ${state === "todo" ? "text-muted" : "text-ink"}`}>
                <span className="flex size-5 shrink-0 items-center justify-center">
                  {state === "done" ? (
                    <Check className="size-4" />
                  ) : state === "active" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-line-strong" />
                  )}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
        <p className="mt-5 text-xs leading-relaxed text-muted">{t.note}</p>
      </div>
    </div>,
    document.body,
  );
}
