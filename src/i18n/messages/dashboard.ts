// Textos del resumen (dashboard). `en` es la fuente de verdad; `es` debe tener la misma forma.

const en = {
  title: "Overview",
  subtitle: "{count} in {month} · {scope}",
  txCount: { one: "{n} transaction", other: "{n} transactions" },
  onlyCurrency: "{currency} only",
  allConverted: "all converted to {currency}",
  delta: {
    noPrevious: "no data for last month",
    vsPrevious: "vs last month",
  },
  missingRates: {
    text: "No exchange rate for {list}: those transactions aren't included in the total.",
    link: "Set up rates",
  },
  reminders: {
    title: "Reminders",
    upcoming: { one: "{n} upcoming payment", other: "{n} upcoming payments" },
    overdue: { one: "{n} overdue", other: "{n} overdue" },
    viewPayments: "View payments",
    viewMore: "View {n} more",
  },
  stats: {
    monthSpending: "Spending this month",
    income: "Income",
    net: "Net balance",
    noIncome: "no income recorded",
    savingsRate: "savings rate {pct}%",
    dailyAverage: "Daily average",
    projection: "projected for the month: {amount}",
  },
  trend: {
    title: "Income vs spending",
    subtitle: "Last 12 months",
  },
  byCategory: {
    title: "Spending by category",
    uncategorized: "{amount} uncategorized",
    other: "Other",
  },
  noSpending: "No spending this month",
  daily: {
    title: "Daily spending",
    peak: "Highest spending day: {day} ({amount})",
  },
  byAccount: {
    title: "By card / account",
    subtitle: "Spending this month",
  },
  merchants: {
    title: "Top merchants",
    purchases: { one: "{n} purchase", other: "{n} purchases" },
  },
  budget: {
    title: "Budget",
    subtitle: "{month} · in {currency}",
    view: "View",
    create: "Create your monthly budget",
    of: "of {amount}",
    budgetStreak: "Budget streak: {n}",
    savingsStreak: "Savings streak: {n}",
  },
  byCurrency: {
    title: "Spending by currency",
    subtitle: "Original amount and equivalent in {currency}",
    noRate: "no rate",
  },
  balances: {
    title: "Balances",
    subtitle: "Calculated balance per account",
    viewAccounts: "View accounts",
    empty: "Add your accounts and cards",
  },
  recent: {
    title: "Recent transactions",
    viewAll: "View all",
    empty: "No transactions",
  },
};

const es: typeof en = {
  title: "Resumen",
  subtitle: "{count} en {month} · {scope}",
  txCount: { one: "{n} movimiento", other: "{n} movimientos" },
  onlyCurrency: "sólo {currency}",
  allConverted: "todo convertido a {currency}",
  delta: {
    noPrevious: "sin datos del mes anterior",
    vsPrevious: "vs mes anterior",
  },
  missingRates: {
    text: "Sin tasa de cambio para {list}: esos movimientos no se suman al total.",
    link: "Configurar tasas",
  },
  reminders: {
    title: "Recordatorios",
    upcoming: { one: "{n} pago próximo", other: "{n} pagos próximos" },
    overdue: { one: "{n} vencido", other: "{n} vencidos" },
    viewPayments: "Ver pagos",
    viewMore: "Ver {n} más",
  },
  stats: {
    monthSpending: "Gastos del mes",
    income: "Ingresos",
    net: "Balance neto",
    noIncome: "sin ingresos registrados",
    savingsRate: "tasa de ahorro {pct}%",
    dailyAverage: "Promedio diario",
    projection: "proyección del mes {amount}",
  },
  trend: {
    title: "Ingresos vs gastos",
    subtitle: "Últimos 12 meses",
  },
  byCategory: {
    title: "Gastos por categoría",
    uncategorized: "{amount} sin categoría",
    other: "Otras",
  },
  noSpending: "Sin gastos este mes",
  daily: {
    title: "Gasto diario",
    peak: "Día de mayor gasto: {day} ({amount})",
  },
  byAccount: {
    title: "Por tarjeta / cuenta",
    subtitle: "Gastos del mes",
  },
  merchants: {
    title: "Principales comercios",
    purchases: { one: "{n} compra", other: "{n} compras" },
  },
  budget: {
    title: "Presupuesto",
    subtitle: "{month} · en {currency}",
    view: "Ver",
    create: "Crea tu presupuesto mensual",
    of: "de {amount}",
    budgetStreak: "Racha de presupuesto: {n}",
    savingsStreak: "Racha de ahorro: {n}",
  },
  byCurrency: {
    title: "Gastos por moneda",
    subtitle: "Monto original y equivalente en {currency}",
    noRate: "sin tasa",
  },
  balances: {
    title: "Saldos",
    subtitle: "Saldo calculado por cuenta",
    viewAccounts: "Ver cuentas",
    empty: "Agrega tus cuentas y tarjetas",
  },
  recent: {
    title: "Últimos movimientos",
    viewAll: "Ver todos",
    empty: "Sin movimientos",
  },
};

export default { en, es };
