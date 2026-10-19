"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { accounts, emailMessages, emailRules } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { uid } from "@/lib/context";
import { ownedAccountId, ownedCategoryId } from "@/lib/queries";
import { extract, isValidRegex, matchAccount, normalizeText, ruleMatches } from "@/lib/email/parser";
import { processMessage, reprocessPending } from "@/lib/email/sync";
import { aiConfigured, createRuleWithAi, setAiAutoRules } from "@/lib/ai";
import { appSettings, reloadSettings } from "@/lib/settings";
import { fmt, getT } from "@/i18n/server";
import type { FormState } from "./types";

const optionalText = z.string().trim().max(500).optional().transform((v) => v || null);
const optionalId = z.preprocess((v) => (v ? Number(v) : null), z.number().int().positive().nullable());

const ruleSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1, { error: () => getT().email.errors.nameRequired }).max(100),
  enabled: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  ignore: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  priority: z.preprocess((v) => Number(v || 100), z.number().int()),
  fromPattern: optionalText,
  subjectPattern: optionalText,
  bodyPattern: optionalText,
  type: z.enum(["expense", "income", "transfer"]),
  amountRegex: optionalText,
  merchantRegex: optionalText,
  identifierRegex: optionalText,
  currencyRegex: optionalText,
  dateRegex: optionalText,
  dedupeRegex: optionalText,
  defaultCurrency: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase().slice(0, 3) : null)),
  accountId: optionalId,
  categoryId: optionalId,
});

export async function saveRule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const parsed = ruleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const { id, ...d } = parsed.data;
  if (!d.fromPattern && !d.subjectPattern && !d.bodyPattern) {
    return { error: t.email.errors.filterRequired };
  }
  const f = t.email.fields;
  for (const [label, p] of [
    [f.from, d.fromPattern],
    [f.subject, d.subjectPattern],
    [f.body, d.bodyPattern],
    [f.amount, d.amountRegex],
    [f.merchant, d.merchantRegex],
    [f.last4, d.identifierRegex],
    [f.currency, d.currencyRegex],
    [f.date, d.dateRegex],
    [f.dedupe, d.dedupeRegex],
  ] as const) {
    if (p && !isValidRegex(p)) return { error: fmt(t.email.errors.invalidRegex, { label }) };
  }
  // Cuenta y categoría del formulario: sólo si son del usuario
  const [accountId, categoryId] = await Promise.all([ownedAccountId(d.accountId), ownedCategoryId(d.categoryId)]);
  if ((d.accountId && !accountId) || (d.categoryId && !categoryId)) return { error: t.common.errors.invalidData };
  const values = { ...d, accountId, categoryId };
  if (id) {
    const [updated] = await db
      .update(emailRules)
      .set(values)
      .where(and(eq(emailRules.id, id), eq(emailRules.userId, uid())))
      .returning({ id: emailRules.id });
    if (!updated) return { error: t.common.errors.invalidData };
  } else await db.insert(emailRules).values({ ...values, userId: uid() });
  revalidatePath("/email");
  redirect("/email?tab=rules");
}

export async function deleteRule(formData: FormData) {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) await db.delete(emailRules).where(and(eq(emailRules.id, id), eq(emailRules.userId, uid())));
  revalidatePath("/email");
  redirect("/email?tab=rules");
}

/** Vuelve a aplicar las reglas a un correo que falló o quedó sin regla. */
export async function retryMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const id = Number(formData.get("id"));
  const msg = Number.isInteger(id)
    ? await db.query.emailMessages.findFirst({ columns: { id: true }, where: and(eq(emailMessages.id, id), eq(emailMessages.userId, uid())) })
    : undefined;
  if (!msg) return { error: t.common.errors.invalidData };
  const status = await processMessage(msg.id);
  revalidatePath("/", "layout");
  if (status === "parsed") return { ok: true, message: t.email.results.retryParsed };
  const after = await db.query.emailMessages.findFirst({ columns: { error: true }, where: and(eq(emailMessages.id, msg.id), eq(emailMessages.userId, uid())) });
  const reason = after?.error ? ` · ${after.error}` : "";
  if (status === "error" || status === "unmatched") return { error: fmt(t.email.results.retryStill, { status: t.email.status[status] }) + reason };
  return { ok: true, message: fmt(t.email.results.retryStill, { status: t.email.status[status] }) + reason };
}

export async function runReprocess(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAuth();
  const c = await reprocessPending();
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: fmt(getT().email.results.reprocessSummary, c),
  };
}

export type TestResult = {
  matched: boolean;
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  identifier: string | null;
  account: string | null;
  date: string | null;
  dedupeKey: string | null;
};

/** Crea una regla con IA para un correo y reprocesa los pendientes. */
export async function aiRuleFromMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const id = Number(formData.get("id"));
  if (!aiConfigured()) return { error: t.email.errors.aiNotConfigured };
  // El correo tiene que ser del usuario actual
  const msg = Number.isInteger(id)
    ? await db.query.emailMessages.findFirst({ columns: { id: true }, where: and(eq(emailMessages.id, id), eq(emailMessages.userId, uid())) })
    : undefined;
  if (!msg) return { error: t.common.errors.invalidData };
  const r = await createRuleWithAi(msg.id, { force: true });
  if (!r.ruleId) return { error: r.message };
  await reprocessPending();
  revalidatePath("/", "layout");
  redirect(`/email?tab=rules&edit=${r.ruleId}`);
}

export async function setAiAuto(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  await setAiAutoRules(formData.get("enabled") === "on");
  await reloadSettings();
  revalidatePath("/settings");
  return { ok: true, message: getT().email.results.saved };
}

/** Prueba una regla (sin guardar) contra un correo pegado o uno ya importado. */
export async function testRule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAuth();
  const t = getT();
  const parsed = ruleSchema.omit({ name: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.errors.invalidData };
  const rule = parsed.data;

  let email = {
    from: String(formData.get("testFrom") ?? ""),
    subject: String(formData.get("testSubject") ?? ""),
    body: normalizeText(String(formData.get("testBody") ?? "")),
  };
  const messageId = Number(formData.get("testMessageId"));
  if (messageId && Number.isInteger(messageId)) {
    const msg = await db.query.emailMessages.findFirst({ where: and(eq(emailMessages.id, messageId), eq(emailMessages.userId, uid())) });
    if (msg) email = { from: msg.fromAddress ?? "", subject: msg.subject ?? "", body: msg.body ?? "" };
  }
  if (!email.subject && !email.body) return { error: t.email.errors.pasteEmail };

  const ex = extract(rule, email, appSettings().currencies);
  const accList = await db.select().from(accounts).where(eq(accounts.userId, uid()));
  const account = (rule.accountId ? accList.find((a) => a.id === rule.accountId) : null) ?? matchAccount(accList, ex.identifier);
  const data: TestResult = {
    matched: ruleMatches(rule, email),
    amount: ex.amount,
    currency: ex.currency,
    merchant: ex.merchant,
    identifier: ex.identifier,
    account: account?.name ?? null,
    date: ex.date ? `${ex.date.ymd}${ex.date.time ? ` ${ex.date.time}` : ""}` : null,
    dedupeKey: ex.dedupeKey,
  };
  return { ok: true, data };
}
