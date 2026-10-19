"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { linkDetectedTransactions } from "@/lib/account-linking";
import { requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { appSettings } from "@/lib/settings";
import { fmt, getT } from "@/i18n/server";
import type { FormState } from "./types";

const accountSchema = z.object({
  id: z.preprocess((v) => (v ? Number(v) : null), z.number().int().positive().nullable()),
  name: z.string().trim().min(1, { error: () => getT().accounts.errors.nameRequired }).max(100),
  type: z.enum(["bank", "credit_card", "debit_card", "cash", "wallet", "other"]),
  institution: z.string().trim().max(100).optional(),
  currency: z.string().trim().length(3, { error: () => getT().accounts.errors.currencyLength }).transform((s) => s.toUpperCase()),
  identifiers: z.string().optional(),
  initialBalance: z.preprocess((v) => Number(String(v || "0").replace(/,/g, "")), z.number({ error: () => getT().accounts.errors.invalidBalance })),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).catch("#0a0a0a"),
  isSavings: z.preprocess((v) => v === "on", z.boolean()),
  statementDay: z.preprocess((v) => (v ? Number(v) : null), z.number().int().min(1).max(31).nullable()),
  dueDay: z.preprocess((v) => (v ? Number(v) : null), z.number().int().min(1).max(31).nullable()),
  extraCurrencies: z.string().optional(),
  linkedAccountId: z.preprocess((v) => (v ? Number(v) : null), z.number().int().positive().nullable()),
});

const balanceValue = z.preprocess((v) => Number(String(v || "0").replace(/,/g, "")), z.number().finite());

export async function saveAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const { id, identifiers, extraCurrencies, linkedAccountId, ...d } = parsed.data;
  const configured = appSettings().currencies.map((c) => c.code);
  if (!configured.includes(d.currency)) return { error: fmt(t.accounts.errors.addCurrencyFirst, { currency: d.currency }) };
  const ids = Array.from(
    new Set((identifiers ?? "").split(/[,\s]+/).map((s) => s.replace(/\D/g, "")).filter(Boolean)),
  );
  const isCredit = d.type === "credit_card";
  // Tarjeta de débito: la cuenta de la que descuenta (propia, distinta y que no sea otra tarjeta)
  const linked =
    d.type === "debit_card" && linkedAccountId && linkedAccountId !== id
      ? await db.query.accounts.findFirst({ where: and(eq(accounts.id, linkedAccountId), eq(accounts.userId, uid())) })
      : null;
  if (linkedAccountId && d.type === "debit_card" && (!linked || linked.type === "credit_card" || linked.type === "debit_card")) {
    return { error: t.common.errors.invalidData };
  }
  if (linked) {
    // Usa la moneda y el saldo de su cuenta; no tiene saldo propio ni cuenta como ahorro aparte
    d.currency = linked.currency;
    d.initialBalance = 0;
    d.isSavings = false;
  }
  // Tarjetas de crédito: otras monedas del saldo (configuradas, sin la principal) y el saldo inicial de cada una
  const extras = isCredit
    ? Array.from(new Set((extraCurrencies ?? "").split(",").map((c) => c.trim().toUpperCase()))).filter((c) => configured.includes(c) && c !== d.currency)
    : [];
  const extraInitialBalances: Record<string, string> = {};
  for (const c of extras) {
    const v = balanceValue.safeParse(formData.get(`initialBalance_${c}`));
    if (!v.success) return { error: t.accounts.errors.invalidBalance };
    extraInitialBalances[c] = v.data.toFixed(2);
  }
  const values = {
    ...d,
    institution: d.institution || null,
    identifiers: ids,
    initialBalance: d.initialBalance.toFixed(2),
    // El ciclo de corte sólo aplica a tarjetas de crédito
    statementDay: isCredit ? d.statementDay : null,
    dueDay: isCredit ? d.dueDay : null,
    extraCurrencies: extras,
    extraInitialBalances,
    linkedAccountId: linked?.id ?? null,
  };

  let accountId = id;
  if (id) {
    const updated = await db
      .update(accounts)
      .set(values)
      .where(and(eq(accounts.id, id), eq(accounts.userId, uid())))
      .returning({ id: accounts.id });
    if (!updated.length) return { error: t.common.errors.invalidData };
  } else [{ id: accountId }] = await db.insert(accounts).values({ ...values, userId: uid() }).returning({ id: accounts.id });

  // Asocia los movimientos importados sin cuenta que traían estos últimos dígitos
  if (accountId) await linkDetectedTransactions(accountId, isCredit, ids);
  revalidatePath("/", "layout");
  const returnTo = String(formData.get("returnTo") ?? "");
  redirect(/^\/(?![/\\])/.test(returnTo) ? returnTo : "/accounts");
}

export async function toggleArchiveAccount(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const acc = await db.query.accounts.findFirst({ where: and(eq(accounts.id, id), eq(accounts.userId, uid())) });
  if (acc) {
    await db
      .update(accounts)
      .set({ archived: !acc.archived })
      .where(and(eq(accounts.id, acc.id), eq(accounts.userId, uid())));
  }
  revalidatePath("/", "layout");
  if (formData.get("returnTo") === "/accounts") redirect("/accounts");
}

export async function deleteAccount(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, uid())));
  revalidatePath("/", "layout");
  redirect("/accounts");
}
