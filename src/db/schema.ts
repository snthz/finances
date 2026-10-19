import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const txType = pgEnum("tx_type", ["expense", "income", "transfer"]);
export const categoryKind = pgEnum("category_kind", ["expense", "income"]);
export const accountType = pgEnum("account_type", [
  "bank",
  "credit_card",
  "debit_card",
  "cash",
  "wallet",
  "other",
]);
export const txSource = pgEnum("tx_source", ["manual", "email"]);
export const emailStatus = pgEnum("email_status", ["parsed", "unmatched", "ignored", "error", "duplicate"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Null si la cuenta se creó con Google y nunca definió contraseña
  passwordHash: text("password_hash"),
  // "sub" de Google (login con Google)
  googleId: text("google_id").unique(),
  // Moneda y zona horaria elegidas: hasta entonces se muestra la configuración inicial
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  // Las sesiones emitidas antes de esta fecha dejan de valer (al vincular Google, cerrar otras sesiones…)
  sessionsValidAfter: timestamp("sessions_valid_after", { withTimezone: true }),
  // "icon:<nombre>" (predeterminado) o data URL de la foto (256 px). Null = iniciales.
  avatar: text("avatar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const currencies = pgTable(
  "currencies",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 3 }).notNull(),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    // Cómo aparece en los correos del banco (ej. "L.", "Lps", "US$")
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    // Valor de 1 unidad de esta moneda en la moneda base (la base siempre es 1)
    rate: numeric("rate", { precision: 20, scale: 10 }),
    autoRate: boolean("auto_rate").notNull().default(true),
    rateUpdatedAt: timestamp("rate_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] })],
);

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: accountType("type").notNull().default("bank"),
  institution: text("institution"),
  currency: varchar("currency", { length: 3 }).notNull(),
  // Últimos dígitos de tarjeta/cuenta que aparecen en los correos (ej. "1234")
  identifiers: text("identifiers").array().notNull().default(sql`'{}'::text[]`),
  initialBalance: numeric("initial_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  color: varchar("color", { length: 9 }).notNull().default("#2a78d6"),
  // Cuenta de ahorro: su saldo es la base de las metas de ahorro del presupuesto
  isSavings: boolean("is_savings").notNull().default(false),
  // Tarjetas de crédito: día de corte del estado de cuenta y día límite de pago (null = no configurado)
  statementDay: integer("statement_day"),
  dueDay: integer("due_day"),
  // Tarjetas de crédito con saldo en varias monedas (ej. HNL + USD): monedas además de `currency`
  // y el saldo inicial de cada una ({"USD": "-120.50"}). Los cargos en otra moneda van al saldo de la primera extra.
  extraCurrencies: text("extra_currencies").array().notNull().default(sql`'{}'::text[]`),
  extraInitialBalances: jsonb("extra_initial_balances").$type<Record<string, string>>().notNull().default({}),
  // Tarjeta de débito: cuenta de la que descuenta (sus movimientos cuentan en el saldo de esa cuenta)
  linkedAccountId: integer("linked_account_id").references((): AnyPgColumn => accounts.id, { onDelete: "set null" }),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: categoryKind("kind").notNull().default("expense"),
  color: varchar("color", { length: 9 }).notNull().default("#2a78d6"),
  icon: text("icon").notNull().default("tag"),
  monthlyBudget: numeric("monthly_budget", { precision: 14, scale: 2 }),
  // Palabras clave para auto-categorizar por comercio/descripción
  keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailRules = pgTable("email_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  priority: integer("priority").notNull().default(100),
  // Si coincide, el correo se marca como ignorado y no crea transacción
  ignore: boolean("ignore").notNull().default(false),
  // Pago a una tarjeta de crédito: crea una transferencia hacia la tarjeta de los últimos 4 (la cuenta de la regla es el origen)
  cardPayment: boolean("card_payment").notNull().default(false),
  // Filtros (regex, sin distinguir mayúsculas). Vacío = no filtra.
  fromPattern: text("from_pattern"),
  subjectPattern: text("subject_pattern"),
  bodyPattern: text("body_pattern"),
  type: txType("type").notNull().default("expense"),
  // Extracción (regex con un grupo de captura). Vacío = patrón genérico.
  amountRegex: text("amount_regex"),
  merchantRegex: text("merchant_regex"),
  identifierRegex: text("identifier_regex"),
  currencyRegex: text("currency_regex"),
  // Fecha real del movimiento dentro del correo (si no, se usa la fecha del correo)
  dateRegex: text("date_regex"),
  // Identificador del documento (ej. "1ra Quincena de Octubre 2026") para descartar correos duplicados
  dedupeRegex: text("dedupe_regex"),
  // Origen de la regla: creada a mano, preset incluido en la app o generada por IA
  source: text("source").notNull().default("manual"),
  defaultCurrency: varchar("default_currency", { length: 3 }),
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Cuentas de correo conectadas (IMAP). Cada una tiene su propio watcher en tiempo real. */
export const emailAccounts = pgTable(
  "email_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    address: text("address").notNull(),
    host: text("host").notNull().default("imap.gmail.com"),
    port: integer("port").notNull().default(993),
    // Contraseña de aplicación cifrada (AES-256-GCM)
    passwordEnc: text("password_enc").notNull(),
    mailbox: text("mailbox").notNull().default("Finanzas"),
    realtime: boolean("realtime").notNull().default(true),
    initialDays: integer("initial_days").notNull().default(60),
    enabled: boolean("enabled").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastResult: jsonb("last_result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("email_accounts_user_address_unique").on(t.userId, t.address)],
);

export const emailMessages = pgTable(
  "email_messages",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    emailAccountId: integer("email_account_id").references(() => emailAccounts.id, { onDelete: "set null" }),
    mailbox: text("mailbox"),
    uid: integer("uid"),
    fromAddress: text("from_address"),
    subject: text("subject"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    body: text("body"),
    status: emailStatus("status").notNull(),
    ruleId: integer("rule_id").references(() => emailRules.id, { onDelete: "set null" }),
    error: text("error"),
    // Movimiento con el que chocó al marcarse como duplicado, y si el usuario ya confirmó que lo es
    duplicateOfId: integer("duplicate_of_id").references((): AnyPgColumn => transactions.id, { onDelete: "set null" }),
    duplicateConfirmed: boolean("duplicate_confirmed").notNull().default(false),
    // Último intento de crear una regla con IA para este correo
    aiAttemptAt: timestamp("ai_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_messages_received_idx").on(t.userId, t.receivedAt),
    unique("email_messages_user_message_unique").on(t.userId, t.messageId),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    // Siempre positivo; el signo lo da `type`
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    type: txType("type").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    description: text("description"),
    merchant: text("merchant"),
    notes: text("notes"),
    accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
    toAccountId: integer("to_account_id").references(() => accounts.id, { onDelete: "set null" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    source: txSource("source").notNull().default("manual"),
    emailMessageId: integer("email_message_id").references(() => emailMessages.id, {
      onDelete: "set null",
    }),
    // Identificador detectado en el correo (últimos 4) aunque no se haya asociado a una cuenta
    detectedIdentifier: text("detected_identifier"),
    // Clave para descartar duplicados (regla + identificador del documento)
    dedupeKey: text("dedupe_key"),
    // Pago programado que este movimiento saldó (detectado por palabras clave o marcado a mano)
    scheduledPaymentId: integer("scheduled_payment_id").references((): AnyPgColumn => scheduledPayments.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_date_idx").on(t.userId, t.date),
    index("transactions_dedupe_idx").on(t.dedupeKey),
    index("transactions_account_idx").on(t.accountId),
    index("transactions_category_idx").on(t.categoryId),
  ],
);

/**
 * Plan de presupuesto vigente desde un mes. Al editar el plan se crea/actualiza la fila del mes actual,
 * así los meses anteriores conservan el límite con que se evaluaron.
 */
export const budgetPlans = pgTable(
  "budget_plans",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    effectiveFrom: varchar("effective_from", { length: 7 }).notNull(), // "YYYY-MM"
    monthlyLimit: numeric("monthly_limit", { precision: 14, scale: 2 }),
    savingsTarget: numeric("savings_target", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("budget_plans_user_month_unique").on(t.userId, t.effectiveFrom)],
);

/**
 * Pagos programados: financiamientos (extra/intra, préstamos), servicios, depósitos y otros compromisos.
 * `nextDue` es la próxima fecha pendiente; al pagarse (o al cargarse solo) avanza según `frequency`.
 */
export const paymentKind = pgEnum("payment_kind", ["financing", "service", "deposit", "other"]);

export const scheduledPayments = pgTable(
  "scheduled_payments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: paymentKind("kind").notNull().default("service"),
    // Financiamiento: extra | intra | loan | financing. Otros tipos: libre (no se usa)
    subtype: text("subtype"),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("receipt"),
    // null = monto variable (ej. la luz)
    amount: numeric("amount", { precision: 14, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull(),
    // once | weekly | biweekly | monthly | bimonthly | quarterly | semiannual | yearly
    frequency: text("frequency").notNull().default("monthly"),
    // Día del mes de referencia (frecuencias mensuales): si el mes es más corto se usa su último día
    anchorDay: integer("anchor_day"),
    nextDue: date("next_due", { mode: "string" }).notNull(),
    // auto = se carga solo a la tarjeta/cuenta; manual = hay que pagarlo ese día
    payMode: text("pay_mode").notNull().default("manual"),
    accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
    // Depósitos: a una cuenta propia o a terceros (texto libre)
    toAccountId: integer("to_account_id").references(() => accounts.id, { onDelete: "set null" }),
    destination: text("destination"),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    // Financiamientos: total de cuotas y la próxima que toca (1-based)
    totalInstallments: integer("total_installments"),
    currentInstallment: integer("current_installment"),
    // Días antes del vencimiento en que se avisa (0 = el mismo día)
    reminderDays: integer("reminder_days").array().notNull().default(sql`'{0,1,2,3}'::int[]`),
    // Palabras que identifican el pago en un movimiento (ej. "ENEE"): al llegar uno, se da por pagado
    matchKeywords: text("match_keywords").array().notNull().default(sql`'{}'::text[]`),
    // Cargo automático: registrar el gasto solo al pasar la fecha
    autoRecord: boolean("auto_record").notNull().default(false),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    lastPaidAt: timestamp("last_paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scheduled_payments_due_idx").on(t.userId, t.nextDue)],
);

/** Avisos de la campanita. `key` evita duplicar el mismo aviso. */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    // reminder | overdue | charged | completed
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    paymentId: integer("payment_id").references(() => scheduledPayments.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_created_idx").on(t.userId, t.createdAt),
    unique("notifications_user_key_unique").on(t.userId, t.key),
  ],
);

/**
 * Cada llamada al proveedor de IA (crear reglas): tokens y costo en USD según el precio del modelo
 * al momento de la llamada (null si no se conoce el precio).
 */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    // Entrada sin caché, entrada leída de caché, entrada escrita en caché y salida (incluye razonamiento)
    inputTokens: integer("input_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    emailMessageId: integer("email_message_id").references(() => emailMessages.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_created_idx").on(t.userId, t.createdAt)],
);

/** Ajustes globales de la instancia (ej. el secreto de sesiones). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Ajustes de cada usuario (moneda base, zona horaria, idioma, IA…). */
export const userSettings = pgTable(
  "user_settings",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export type User = typeof users.$inferSelect;
export type BudgetPlan = typeof budgetPlans.$inferSelect;
export type Currency = typeof currencies.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type EmailRule = typeof emailRules.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type ScheduledPayment = typeof scheduledPayments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type PaymentKind = (typeof paymentKind.enumValues)[number];
export type TxType = (typeof txType.enumValues)[number];
export type AccountType = (typeof accountType.enumValues)[number];
export type UserSetting = typeof userSettings.$inferSelect;
export type AiUsage = typeof aiUsage.$inferSelect;
