import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { FormState } from "@/actions/types";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { fmt, getT, plural } from "@/i18n/server";
import { uid } from "@/lib/context";
import { appSettings } from "@/lib/settings";
import { syncAccount, syncAll, waitForSync, type SyncRange, type SyncResult } from "./sync";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const inputSchema = z.object({
  accountId: z.number().int().positive().optional(),
  from: ymd.optional(),
  to: ymd.optional(),
});

/**
 * Sincronización pedida por el usuario: todas sus cuentas o una, opcionalmente sólo un rango
 * de fechas. Se expone por /api/email/sync y no como server action, porque Next procesa las
 * acciones en la misma cola que la navegación y una sincronización larga la bloquearía.
 */
export async function manualSync(input: unknown): Promise<FormState> {
  const t = getT();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: t.common.errors.invalidData };
  const { accountId, from, to } = parsed.data;
  let range: SyncRange | undefined;
  if (from || to) {
    if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return { error: t.email.errors.rangeInvalid };
    if (from > to) return { error: t.email.errors.rangeOrder };
    range = { from, to };
  }
  const accs = appSettings().emailAccounts;
  if (accountId && !accs.some((a) => a.id === accountId)) return { error: t.common.errors.invalidData };
  return accountId && !range ? syncOne(accountId) : syncMany(accountId, range);
}

/** Una cuenta (al conectarla o con "Sincronizar ahora"): si el watcher ya estaba sincronizando, espera su resultado. */
async function syncOne(id: number): Promise<FormState> {
  let r = await syncAccount(id);
  if (r.busy) {
    await waitForSync(id);
    const [row] = await db
      .select({ lastResult: emailAccounts.lastResult })
      .from(emailAccounts)
      .where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, uid())));
    r = (row?.lastResult as SyncResult | null) ?? r;
  }
  const t = getT();
  if (r.busy) return { ok: true, message: t.settings.actions.syncInBackground };
  if (!r.ok) return { error: fmt(t.settings.errors.connectionFailed, { error: r.message ?? "" }) };
  return {
    ok: true,
    message: `${plural(r.fetched, t.settings.actions.syncEmails)} · ${plural(r.created, t.settings.actions.syncTransactions)}`,
  };
}

async function syncMany(accountId: number | undefined, range: SyncRange | undefined): Promise<FormState> {
  const t = getT();
  const results = accountId
    ? [{ ...(await syncAccount(accountId, range)), accountId, label: appSettings().emailAccounts.find((a) => a.id === accountId)!.label }]
    : await syncAll(range);
  if (!results.length) return { error: t.email.errors.noAccounts };
  // Con rango, una sincronización en curso sí impide importar ese periodo
  const failed = results.filter((r) => !r.ok && (!r.busy || range));
  const sum = (k: "fetched" | "created" | "unmatched") => results.reduce((a, r) => a + r[k], 0);
  const summary = fmt(t.email.results.syncSummary, { fetched: sum("fetched"), created: sum("created"), unmatched: sum("unmatched") });
  if (failed.length)
    return { error: fmt(t.email.errors.syncFailed, { summary, details: failed.map((f) => `${f.label}: ${f.message}`).join("; ") }) };
  return { ok: true, message: summary };
}
