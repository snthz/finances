// Textos de Estadísticas. `en` es la fuente de verdad; `es` debe tener la misma forma.

const en = {
  title: "Stats",
  subtitle: "{count} · {scope}",
  periods: { day: "Day", week: "Week", month: "Month", year: "Year" },
  nav: {
    prev: "Previous period",
    next: "Next period",
    current: "Go to the current period",
  },
  delta: {
    vsPrevious: { day: "vs previous day", week: "vs last week", month: "vs last month", year: "vs last year" },
    noPrevious: "no data for the previous period",
  },
  kpi: {
    spending: { day: "Spending this day", week: "Spending this week", month: "Spending this month", year: "Spending this year" },
    transactions: "Transactions",
    avgExpense: "avg. {amount} per expense",
    projection: "projected for the period: {amount}",
    elapsed: "over {n} days",
  },
  series: {
    title: "Income vs spending",
    byDay: "Per day",
    byMonth: "Per month",
  },
  cumulative: {
    title: "Cumulative spending",
    subtitle: "Compared with the same point of the previous period",
    current: "This period",
    previous: "Previous period",
  },
  categories: {
    title: "Spending by category",
    total: "Total",
    aria: "Share of spending by category",
  },
  methods: {
    title: "By payment method",
    subtitle: "Type of account or card used",
    unassigned: "No account",
    aria: "Share of spending by payment method",
  },
  weekday: {
    title: "Average by weekday",
    subtitle: "Average spending on each day of the week",
    series: "Average",
    days: { one: "over {n} day", other: "over {n} days" },
  },
  compare: {
    title: "Categories vs previous period",
    category: "Category",
    current: "Now",
    previous: "Before",
    change: "Change",
    new: "new",
  },
  merchants: {
    title: "Top merchants",
    purchases: { one: "{n} purchase", other: "{n} purchases" },
  },
  accounts: {
    title: "By card / account",
  },
  byCurrency: {
    title: "Spending by currency",
    subtitle: "Original amount and equivalent in {currency}",
    noRate: "no rate",
  },
  largest: {
    title: "Largest expenses",
  },
  dayTransactions: {
    title: "Transactions of the day",
  },
  other: "Other",
  noSpending: "No spending in this period",
  empty: "No transactions in this period",
};

const es: typeof en = {
  title: "Estadísticas",
  subtitle: "{count} · {scope}",
  periods: { day: "Día", week: "Semana", month: "Mes", year: "Año" },
  nav: {
    prev: "Periodo anterior",
    next: "Periodo siguiente",
    current: "Ir al periodo actual",
  },
  delta: {
    vsPrevious: { day: "vs día anterior", week: "vs semana anterior", month: "vs mes anterior", year: "vs año anterior" },
    noPrevious: "sin datos del periodo anterior",
  },
  kpi: {
    spending: { day: "Gastos del día", week: "Gastos de la semana", month: "Gastos del mes", year: "Gastos del año" },
    transactions: "Movimientos",
    avgExpense: "prom. {amount} por gasto",
    projection: "proyección del periodo: {amount}",
    elapsed: "en {n} días",
  },
  series: {
    title: "Ingresos vs gastos",
    byDay: "Por día",
    byMonth: "Por mes",
  },
  cumulative: {
    title: "Gasto acumulado",
    subtitle: "Comparado con el mismo punto del periodo anterior",
    current: "Este periodo",
    previous: "Periodo anterior",
  },
  categories: {
    title: "Gastos por categoría",
    total: "Total",
    aria: "Participación del gasto por categoría",
  },
  methods: {
    title: "Por medio de pago",
    subtitle: "Tipo de cuenta o tarjeta usada",
    unassigned: "Sin cuenta",
    aria: "Participación del gasto por medio de pago",
  },
  weekday: {
    title: "Promedio por día de la semana",
    subtitle: "Gasto promedio de cada día de la semana",
    series: "Promedio",
    days: { one: "en {n} día", other: "en {n} días" },
  },
  compare: {
    title: "Categorías vs periodo anterior",
    category: "Categoría",
    current: "Ahora",
    previous: "Antes",
    change: "Cambio",
    new: "nueva",
  },
  merchants: {
    title: "Principales comercios",
    purchases: { one: "{n} compra", other: "{n} compras" },
  },
  accounts: {
    title: "Por tarjeta / cuenta",
  },
  byCurrency: {
    title: "Gastos por moneda",
    subtitle: "Monto original y equivalente en {currency}",
    noRate: "sin tasa",
  },
  largest: {
    title: "Gastos más grandes",
  },
  dayTransactions: {
    title: "Movimientos del día",
  },
  other: "Otras",
  noSpending: "Sin gastos en este periodo",
  empty: "Sin movimientos en este periodo",
};

export default { en, es };
