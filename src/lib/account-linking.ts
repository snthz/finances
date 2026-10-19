import "server-only";
import { and, eq, isNull, not, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, emailMessages, emailRules, transactions } from "@/db/schema";
import { uid } from "./context";
import { matchAccount } from "./email/parser";

// Movimientos importados de correos que traían unos últimos 4 dígitos sin cuenta todavía.

/**
 * Asocia a la cuenta los movimientos sin cuenta que traían estos dígitos. Los pagos de tarjeta
 * detectados en correos traen los dígitos de la tarjeta pagada: en ellos la tarjeta es el destino.
 */
export async function linkDetectedTransactions(accountId: number, isCredit: boolean, identifiers: string[]) {
  const userId = uid();
  const fromCardPaymentRule = sql`coalesce(${transactions.emailMessageId} in (
    select m.id from ${emailMessages} m join ${emailRules} r on r.id = m.rule_id
    where m.user_id = ${userId} and r.user_id = ${userId} and r.card_payment), false)`;
  for (const ident of identifiers) {
    const sameDigits = and(eq(transactions.userId, userId), eq(transactions.detectedIdentifier, ident.replace(/\D/g, "").slice(-4)));
    if (isCredit) {
      await db
        .update(transactions)
        .set({ toAccountId: accountId })
        .where(and(sameDigits, eq(transactions.type, "transfer"), isNull(transactions.toAccountId), fromCardPaymentRule));
    }
    await db
      .update(transactions)
      .set({ accountId })
      .where(and(sameDigits, isNull(transactions.accountId), not(fromCardPaymentRule)));
  }
}

/**
 * Dígitos detectados en correos que no pertenecen a ninguna cuenta (para proponer crearla).
 * Los que ya tienen cuenta se asocian aquí mismo, así nunca se pide crear una cuenta que ya existe.
 */
export async function unassignedIdentifiers() {
  const userId = uid();
  const [list, rows] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    // Un pago de tarjeta con su tarjeta destino ya está asignado aunque no tenga cuenta de origen
    db.execute<{ ident: string; n: number }>(sql`
      select detected_identifier as ident, count(*)::int as n from transactions
      where user_id = ${userId} and account_id is null and to_account_id is null and detected_identifier is not null
      group by 1 order by 2 desc
    `),
  ]);
  const orphans: { ident: string; n: number }[] = [];
  for (const r of rows) {
    const owner = matchAccount(list, r.ident);
    if (owner) await linkDetectedTransactions(owner.id, owner.type === "credit_card", [r.ident]);
    // Si los dígitos ya son de una cuenta (aunque esté archivada) no se propone crearla otra vez
    else if (!list.some((a) => a.identifiers.some((i) => i.replace(/\D/g, "").endsWith(r.ident)))) orphans.push(r);
  }
  return orphans;
}
