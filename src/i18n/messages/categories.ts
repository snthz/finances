// Textos de categorías. `en` es la fuente de verdad; `es` debe tener la misma forma.

const en = {
  title: "Categories",
  subtitle: "Keywords assign the category based on the merchant or description.",
  recategorize: "Re-categorize",
  recategorizing: "Categorizing…",
  newShort: "New",
  groups: { expense: "Expenses", income: "Income" } as Record<string, string>,
  addInGroup: "+ Add",
  noKeywords: "No keywords",
  ofBudget: "of {amount}",
  form: {
    newTitle: "New category",
    name: "Name",
    namePlaceholder: "E.g. Gym",
    type: "Type",
    keywords: "Keywords",
    keywordsHint: "If the merchant or description contains any of them, the transaction is assigned to this category.",
    keywordsPlaceholder: "uber, lyft, gas…",
    monthlyBudget: "Monthly budget ({currency})",
    monthlyBudgetHint: "Optional. Compared with the month's spending on the overview.",
    noBudget: "No budget",
    confirmDelete: "Delete?",
    create: "Create category",
  },
  errors: {
    nameRequired: "Name is required",
    invalidBudget: "Invalid budget",
  },
  autoResult: {
    one: "{n} of {total} uncategorized transactions was categorized",
    other: "{n} of {total} uncategorized transactions were categorized",
  },
};

const es: typeof en = {
  title: "Categorías",
  subtitle: "Las palabras clave asignan la categoría según el comercio o la descripción.",
  recategorize: "Re-categorizar",
  recategorizing: "Categorizando…",
  newShort: "Nueva",
  groups: { expense: "Gastos", income: "Ingresos" },
  addInGroup: "+ Agregar",
  noKeywords: "Sin palabras clave",
  ofBudget: "de {amount}",
  form: {
    newTitle: "Nueva categoría",
    name: "Nombre",
    namePlaceholder: "Ej. Gimnasio",
    type: "Tipo",
    keywords: "Palabras clave",
    keywordsHint: "Si el comercio o la descripción contiene alguna, el movimiento se asigna a esta categoría.",
    keywordsPlaceholder: "uber, didi, gasolina…",
    monthlyBudget: "Presupuesto mensual ({currency})",
    monthlyBudgetHint: "Opcional. Se compara con el gasto del mes en el resumen.",
    noBudget: "Sin presupuesto",
    confirmDelete: "¿Eliminar?",
    create: "Crear categoría",
  },
  errors: {
    nameRequired: "Nombre requerido",
    invalidBudget: "Presupuesto inválido",
  },
  autoResult: {
    one: "{n} de {total} transacciones sin categoría fue categorizada",
    other: "{n} de {total} transacciones sin categoría fueron categorizadas",
  },
};

export default { en, es };
