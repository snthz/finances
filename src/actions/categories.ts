"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { matchCategory } from "@/lib/email/parser";
import { DEFAULT_CATEGORY_ICON, isCategoryIcon } from "@/components/category-icon";
import { getT, plural } from "@/i18n/server";
import type { FormState } from "./types";

const categorySchema = z.object({
  id: z.preprocess((v) => (v ? Number(v) : null), z.number().int().positive().nullable()),
  name: z.string().trim().min(1, { error: () => getT().categories.errors.nameRequired }).max(60),
  kind: z.enum(["expense", "income"]),
  icon: z.string().trim().max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  monthlyBudget: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(String(v).replace(/,/g, ""))),
    z.number({ error: () => getT().categories.errors.invalidBudget }).nonnegative().nullable(),
  ),
  keywords: z.string().optional(),
});

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? getT().common.errors.invalidData };
  const { id, keywords, monthlyBudget, ...d } = parsed.data;
  const values = {
    ...d,
    icon: isCategoryIcon(d.icon) ? d.icon : DEFAULT_CATEGORY_ICON,
    monthlyBudget: monthlyBudget === null ? null : monthlyBudget.toFixed(2),
    keywords: Array.from(new Set((keywords ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean))),
  };
  if (id) {
    const updated = await db
      .update(categories)
      .set(values)
      .where(and(eq(categories.id, id), eq(categories.userId, uid())))
      .returning({ id: categories.id });
    if (!updated.length) return { error: getT().common.errors.invalidData };
  } else await db.insert(categories).values({ ...values, userId: uid() });
  revalidatePath("/", "layout");
  redirect("/categories");
}

export async function deleteCategory(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, uid())));
  revalidatePath("/", "layout");
  redirect("/categories");
}

/** Aplica las palabras clave a todas las transacciones sin categoría. */
export async function autoCategorize(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAuth();
  const userId = uid();
  const cats = await db.select().from(categories).where(eq(categories.userId, userId));
  const pending = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.categoryId)));
  let updated = 0;
  for (const tx of pending) {
    if (tx.type === "transfer") continue;
    const cat = matchCategory(cats.filter((c) => c.kind === tx.type), tx.merchant, tx.description);
    if (cat) {
      await db
        .update(transactions)
        .set({ categoryId: cat.id })
        .where(and(eq(transactions.id, tx.id), eq(transactions.userId, userId)));
      updated++;
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, message: plural(updated, getT().categories.autoResult, { total: pending.length }) };
}
