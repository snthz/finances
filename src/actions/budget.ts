"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accounts, budgetPlans, categories } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { GOAL_KEYS } from "@/lib/budget";
import { currentMonth } from "@/lib/format";
import { getT } from "@/i18n/server";
import { accountBalances } from "@/lib/queries";
import { deleteSetting, setSetting } from "@/lib/settings";
import type { FormState } from "./types";

/** "" → null; texto → número >= 0 (o error) */
function money(raw: FormDataEntryValue | null): number | null | "invalid" {
  const s = String(raw ?? "").replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : "invalid";
}

export async function saveBudgetPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const limit = money(formData.get("monthlyLimit"));
  const target = money(formData.get("savingsTarget"));
  const goalAmount = money(formData.get("goalAmount"));
  if (limit === "invalid" || target === "invalid" || goalAmount === "invalid") return { error: t.budget.errors.invalidAmounts };
  if (limit === null && target === null) return { error: t.budget.errors.needLimitOrTarget };

  // El plan aplica desde el mes actual; los meses anteriores conservan su plan
  const values = { monthlyLimit: limit === null ? null : limit.toFixed(2), savingsTarget: target === null ? null : target.toFixed(2) };
  await db
    .insert(budgetPlans)
    .values({ userId: uid(), effectiveFrom: currentMonth(), ...values })
    .onConflictDoUpdate({ target: [budgetPlans.userId, budgetPlans.effectiveFrom], set: values });

  // Presupuestos por categoría (campos cat_<id>)
  for (const [key, val] of formData.entries()) {
    const m = key.match(/^cat_(\d+)$/);
    if (!m) continue;
    const v = money(val);
    if (v === "invalid") return { error: t.budget.errors.invalidCategoryAmounts };
    await db
      .update(categories)
      .set({ monthlyBudget: v === null || v === 0 ? null : v.toFixed(2) })
      .where(and(eq(categories.id, Number(m[1])), eq(categories.userId, uid())));
  }

  const goalName = String(formData.get("goalName") ?? "").trim().slice(0, 60);
  if (goalAmount && goalAmount > 0) {
    await setSetting(GOAL_KEYS.amount, goalAmount.toFixed(2));
    await setSetting(GOAL_KEYS.name, goalName || t.budget.defaultGoalName);
  } else {
    await deleteSetting(GOAL_KEYS.amount);
    await deleteSetting(GOAL_KEYS.name);
  }
  revalidatePath("/", "layout");
  redirect("/budget");
}

/** Corrige el saldo de una cuenta al valor real ajustando su saldo inicial (no afecta gastos ni ingresos). */
export async function adjustAccountBalance(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const id = Number(formData.get("id"));
  const real = Number(String(formData.get("balance") ?? "").replace(/,/g, ""));
  if (!Number.isFinite(real)) return { error: t.budget.errors.invalidBalance };
  if (!Number.isInteger(id)) return { error: t.budget.errors.accountNotFound };
  const acc = await db.query.accounts.findFirst({ where: and(eq(accounts.id, id), eq(accounts.userId, uid())) });
  const current = (await accountBalances()).find((b) => b.id === id);
  if (!acc || !current) return { error: t.budget.errors.accountNotFound };
  const delta = real - current.balance;
  await db
    .update(accounts)
    .set({ initialBalance: (Number(acc.initialBalance) + delta).toFixed(2) })
    .where(and(eq(accounts.id, acc.id), eq(accounts.userId, uid())));
  revalidatePath("/", "layout");
  redirect("/budget");
}
