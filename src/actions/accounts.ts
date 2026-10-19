"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
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
});

export async function saveAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const { id, identifiers, ...d } = parsed.data;
  if (!appSettings().currencies.some((c) => c.code === d.currency)) return { error: fmt(t.accounts.errors.addCurrencyFirst, { currency: d.currency }) };
  const ids = Array.from(
    new Set((identifiers ?? "").split(/[,\s]+/).map((s) => s.replace(/\D/g, "")).filter(Boolean)),
  );
  const values = { ...d, institution: d.institution || null, identifiers: ids, initialBalance: d.initialBalance.toFixed(2) };

  let accountId = id;
  if (id) {
    const updated = await db
      .update(accounts)
      .set(values)
      .where(and(eq(accounts.id, id), eq(accounts.userId, uid())))
      .returning({ id: accounts.id });
    if (!updated.length) return { error: t.common.errors.invalidData };
  } else [{ id: accountId }] = await db.insert(accounts).values({ ...values, userId: uid() }).returning({ id: accounts.id });

  // Asocia transacciones importadas sin cuenta que traían estos últimos dígitos
  for (const ident of ids) {
    await db
      .update(transactions)
      .set({ accountId })
      .where(
        and(eq(transactions.userId, uid()), isNull(transactions.accountId), eq(transactions.detectedIdentifier, ident.slice(-4))),
      );
  }
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
