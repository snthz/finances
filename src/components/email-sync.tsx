"use client";

import { CalendarRange, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveEmailAccount } from "@/actions/settings";
import type { FormState } from "@/actions/types";
import { fmt, useLocale, useT } from "@/i18n/client";
import { INTL_LOCALES } from "@/i18n/config";
import { PendingContext, submitWithoutReset } from "./action-form";
import { Field } from "./form/controls";
import { Modal } from "./form/modal";
import { Select } from "./form/select";

type SyncInput = { accountId?: number; from?: string; to?: string };

/**
 * Sincroniza con un aviso de carga que al terminar se convierte en el resultado.
 * Va por fetch y no por server action: las acciones comparten cola con la navegación
 * y una sincronización larga impediría cerrar el sheet o cambiar de página.
 */
async function syncWithToast(input: SyncInput, loading: string, fallbackError: string, refresh: () => void) {
  const id = toast.loading(loading);
  try {
    const res = await fetch("/api/email/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const r = (await res.json()) as FormState;
    if (!res.ok || r?.error) toast.error(r?.error ?? fallbackError, { id });
    else toast.success(r?.message ?? "", { id });
  } catch {
    toast.error(fallbackError, { id });
  }
  refresh();
}

/**
 * Form del sheet de cuenta de correo: al guardar cierra el sheet y la primera
 * sincronización sigue en segundo plano con su aviso.
 */
export function EmailAccountForm({ closeHref, className, children }: { closeHref: string; className?: string; children: React.ReactNode }) {
  const t = useT();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveEmailAccount, null);
  const handled = useRef<FormState>(null);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.error) {
      toast.error(state.error);
      return;
    }
    router.push(closeHref, { scroll: false });
    const id = (state.data as { syncId?: number } | undefined)?.syncId;
    if (id) void syncWithToast({ accountId: id }, t.settings.page.email.sheet.syncing, t.common.errors.invalidData, () => router.refresh());
    else if (state.message) toast.success(state.message);
  }, [state, closeHref, router, t]);

  return (
    <form action={formAction} onSubmit={(e) => submitWithoutReset(e, (fd) => formAction(fd))} className={className}>
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

/** Botón "Sincronizar ahora" de una cuenta (sin cerrar el sheet). */
export function SyncAccountButton({ id, label }: { id: number; label: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={label}
      title={label}
      className="btn-subtle"
      onClick={async () => {
        setBusy(true);
        await syncWithToast({ accountId: id }, t.settings.page.email.sheet.syncing, t.common.errors.invalidData, () => router.refresh());
        setBusy(false);
      }}
    >
      <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
    </button>
  );
}

const DAY = 86_400_000;
const shiftDays = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** Botones de la bandeja: sincronizar todo y sincronizar un rango de fechas. */
export function EmailSyncControls({ accounts, today }: { accounts: { id: number; label: string }[]; today: string }) {
  const t = useT();
  const tr = t.email.range;
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(shiftDays(today, -30));
  const [to, setTo] = useState(today);

  const presets = [
    { label: tr.presets.d7, from: shiftDays(today, -7) },
    { label: tr.presets.d30, from: shiftDays(today, -30) },
    { label: tr.presets.d90, from: shiftDays(today, -90) },
    { label: tr.presets.year, from: `${today.slice(0, 4)}-01-01` },
  ];
  const day = (ymd: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(Date.parse(`${ymd}T12:00:00Z`));

  async function run(input: SyncInput, loading: string) {
    setBusy(true);
    await syncWithToast(input, loading, t.common.errors.invalidData, () => router.refresh());
    setBusy(false);
  }

  function submitRange(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return toast.error(t.email.errors.rangeInvalid);
    if (from > to) return toast.error(t.email.errors.rangeOrder);
    setOpen(false);
    void run({ accountId: accountId ? Number(accountId) : undefined, from, to }, fmt(tr.syncing, { from: day(from), to: day(to) }));
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" disabled={busy} onClick={() => setOpen(true)} className="btn-ghost" aria-label={tr.button} title={tr.title}>
        <CalendarRange className="size-4" /> <span className="hidden sm:inline">{tr.button}</span>
      </button>
      <button type="button" disabled={busy} onClick={() => run({}, t.email.syncing)} className="btn-ghost">
        <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> {busy ? t.email.syncing : t.email.sync}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={tr.title}
        description={tr.description}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn-subtle h-11">
              {t.common.actions.cancel}
            </button>
            <button type="submit" form="sync-range" className="btn-primary h-11 flex-1">
              {tr.submit}
            </button>
          </>
        }
      >
        <form id="sync-range" onSubmit={submitRange} className="space-y-4">
          {accounts.length > 1 && (
            <Field label={tr.account}>
              <Select
                value={accountId}
                onChange={setAccountId}
                options={[{ value: "", label: tr.allAccounts }, ...accounts.map((a) => ({ value: String(a.id), label: a.label }))]}
              />
            </Field>
          )}
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => {
              const on = from === p.from && to === today;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setFrom(p.from);
                    setTo(today);
                  }}
                  className={`h-8 rounded-lg px-3 text-xs font-medium transition ${on ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3"}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr.from} htmlFor="range-from">
              <input id="range-from" type="date" required max={to || today} value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
            </Field>
            <Field label={tr.to} htmlFor="range-to">
              <input id="range-to" type="date" required min={from} max={today} value={to} onChange={(e) => setTo(e.target.value)} className="input" />
            </Field>
          </div>
          <p className="hint">{tr.hint}</p>
        </form>
      </Modal>
    </div>
  );
}
