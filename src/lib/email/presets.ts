// Reglas incluidas para bancos conocidos. Se instalan una vez (ver startup) y luego son editables.

import { CURRENCY_TOKEN } from "./parser";

type Preset = {
  name: string;
  priority: number;
  type: "expense" | "income" | "transfer";
  ignore?: boolean;
  fromPattern?: string;
  subjectPattern?: string;
  bodyPattern?: string;
  amountRegex?: string;
  merchantRegex?: string;
  identifierRegex?: string;
  currencyRegex?: string;
  dateRegex?: string;
  dedupeRegex?: string;
  defaultCurrency?: string;
  /** Nombre de la categoría a fijar (si existe) */
  categoryName?: string;
};

// Moneda seguida del monto: "L 65", "LPS 35,137.44", "Q 302.28", "EUR 17.16", "US$ 12.99", "$ 844.63"
const CUR = `(?:${CURRENCY_TOKEN})`;
const CUR_CAPTURE = `(${CURRENCY_TOKEN})`;
const AMOUNT = String.raw`([\d,]+(?:\.\d{1,2})?)`;

export const PRESET_RULES: Preset[] = [
  {
    name: "BAC · Transacción rechazada",
    priority: 15,
    type: "expense",
    ignore: true,
    fromPattern: "baccredomatic|credomatic",
    bodyPattern: String.raw`Estado[\s\S]{0,80}?(?:Rechazad|Denegad|Declinad)`,
  },
  {
    name: "BAC · Compra con tarjeta",
    priority: 20,
    type: "expense",
    fromPattern: "baccredomatic|credomatic",
    bodyPattern: String.raw`transacci[oó]n con su tarjeta`,
    // "Comercio  Monto" y debajo "ESPRE A AUTOSER BLVD D   L 65" (a veces sin comercio: sólo "L 254")
    amountRegex: String.raw`\bComercio\s+Monto\s+(?:.+?\s+)?${CUR}\s?${AMOUNT}`,
    currencyRegex: String.raw`\bComercio\s+Monto\s+(?:.+?\s+)?${CUR_CAPTURE}\s?\d`,
    merchantRegex: String.raw`\bComercio\s+Monto\s+(.+?)\s+${CUR}\s?\d`,
    identifierRegex: String.raw`(?:AMEX|VISA|MASTER\w*|MC|DEBITO|CREDITO)\s*[*xX•]*\s*(\d{4})\b`,
    dateRegex: String.raw`Horario\s+(\d{4}/\d{2}/\d{2}[-\s]\d{1,2}:\d{2}(?::\d{2})?)`,
  },
  {
    name: "BAC · Transferencia enviada",
    priority: 21,
    type: "expense",
    fromPattern: "baccredomatic|credomatic",
    bodyPattern: "Monto enviado",
    amountRegex: String.raw`Monto enviado\s+${AMOUNT}`,
    currencyRegex: String.raw`Monto enviado\s+[\d,.]+\s*${CUR_CAPTURE}`,
    identifierRegex: String.raw`n[uú]mero\s*[*xX•]*\s*(\d{4})\b`,
    dateRegex: String.raw`Fecha\s+(\d{1,2}/\d{1,2}/\d{4}(?:\s+a\s+las\s+\d{1,2}:\d{2}(?::\d{2})?)?)`,
  },
  {
    name: "Planilla · Boleta de pago",
    priority: 22,
    type: "income",
    bodyPattern: String.raw`BOLETA DE PAGO[\s\S]*Neto a Recibir`,
    amountRegex: String.raw`Neto a Recibir\s*\$\s*${AMOUNT}`,
    currencyRegex: String.raw`Neto a Recibir\s*(\$|L|LPS)`,
    defaultCurrency: "USD",
    merchantRegex: String.raw`^\s*([^\n]*S\.\s*DE\s*R\.\s*L\.?)\s*$`,
    dateRegex: String.raw`Fecha de Pago[\s\S]{0,160}?(\d{1,2}-[a-zA-Z]{3}-\d{2,4})`,
    // Se envía a veces repetida: una boleta por quincena
    dedupeRegex: String.raw`Planilla\s+(\d+\s*(?:ra|da|ta|er|do|°)?\.?\s+Quincena\s+de\s+\w+\s+\d{4})`,
    categoryName: "Salario",
  },
  {
    name: "Ficohsa · Compra con tarjeta",
    priority: 23,
    type: "expense",
    fromPattern: "ficohsa",
    bodyPattern: String.raw`compra con tu Tarjeta`,
    amountRegex: String.raw`\bMonto\s+${CUR}\s*${AMOUNT}`,
    currencyRegex: String.raw`\bMonto\s+${CUR_CAPTURE}`,
    merchantRegex: String.raw`\bComercio[ \t]+([^\n]+?)(?:\s+BANCO FICOHSA|[ \t]*$)`,
    identifierRegex: String.raw`Tarjeta de (?:Cr[eé]dito|D[eé]bito)\s*[*xX•]*\s*(\d{4})\b`,
    dateRegex: String.raw`D[ií]a\s+(\d{1,2}/\d{1,2}/\d{4})`,
  },
];

const CUR_V1 = String.raw`(?:LPS|HNL|USD|US\$|L\.?|\$)`;
const AMOUNT_V1 = String.raw`([\d,]+(?:\.\d{1,2})?)`;

/** Versión 1 tal como se instaló: sirve para saber qué campos no editó el usuario al actualizar. */
export const PRESET_RULES_V1: Preset[] = [
  {
    name: "BAC · Transacción rechazada",
    priority: 15,
    type: "expense",
    ignore: true,
    fromPattern: "baccredomatic|credomatic",
    bodyPattern: String.raw`Estado[\s\S]{0,80}?(?:Rechazad|Denegad|Declinad)`,
  },
  {
    name: "BAC · Compra con tarjeta",
    priority: 20,
    type: "expense",
    fromPattern: "baccredomatic|credomatic",
    bodyPattern: String.raw`transacci[oó]n con su tarjeta`,
    // "Comercio  Monto" y debajo "ESPRE A AUTOSER BLVD D   L 65"
    amountRegex: String.raw`\bComercio\s+Monto\s+.+?\s+${CUR_V1}\s?${AMOUNT_V1}`,
    currencyRegex: String.raw`\bComercio\s+Monto\s+.+?\s+(LPS|HNL|USD|US\$|L\.?|\$)\s?\d`,
    merchantRegex: String.raw`\bComercio\s+Monto\s+(.+?)\s+${CUR_V1}\s?\d`,
    identifierRegex: String.raw`(?:AMEX|VISA|MASTER\w*|MC|DEBITO|CREDITO)\s*[*xX•]*\s*(\d{4})\b`,
    dateRegex: String.raw`Horario\s+(\d{4}/\d{2}/\d{2}[-\s]\d{1,2}:\d{2}(?::\d{2})?)`,
  },
  {
    name: "BAC · Transferencia enviada",
    priority: 21,
    type: "expense",
    fromPattern: "baccredomatic|credomatic",
    bodyPattern: "Monto enviado",
    amountRegex: String.raw`Monto enviado\s+${AMOUNT_V1}`,
    currencyRegex: String.raw`Monto enviado\s+[\d,.]+\s*(LPS|HNL|USD|US\$|L)\b`,
    identifierRegex: String.raw`n[uú]mero\s*[*xX•]*\s*(\d{4})\b`,
    dateRegex: String.raw`Fecha\s+(\d{1,2}/\d{1,2}/\d{4}(?:\s+a\s+las\s+\d{1,2}:\d{2}(?::\d{2})?)?)`,
  },
  {
    name: "Planilla · Boleta de pago",
    priority: 22,
    type: "income",
    bodyPattern: String.raw`BOLETA DE PAGO[\s\S]*Neto a Recibir`,
    amountRegex: String.raw`Neto a Recibir\s*\$\s*${AMOUNT_V1}`,
    currencyRegex: String.raw`Neto a Recibir\s*(\$|L|LPS)`,
    defaultCurrency: "USD",
    merchantRegex: String.raw`^\s*([^\n]*S\.\s*DE\s*R\.\s*L\.?)\s*$`,
    dateRegex: String.raw`Fecha de Pago[\s\S]{0,160}?(\d{1,2}-[a-zA-Z]{3}-\d{2,4})`,
    // Se envía a veces repetida: una boleta por quincena
    dedupeRegex: String.raw`Planilla\s+(\d+\s*(?:ra|da|ta|er|do|°)?\.?\s+Quincena\s+de\s+\w+\s+\d{4})`,
    categoryName: "Salario",
  },
  {
    name: "Ficohsa · Compra con tarjeta",
    priority: 23,
    type: "expense",
    fromPattern: "ficohsa",
    bodyPattern: String.raw`compra con tu Tarjeta`,
    amountRegex: String.raw`\bMonto\s+${CUR_V1}\s*${AMOUNT_V1}`,
    currencyRegex: String.raw`\bMonto\s+(LPS|HNL|USD|US\$|L\.?|\$)`,
    merchantRegex: String.raw`\bComercio[ \t]+([^\n]+?)(?:\s+BANCO FICOHSA|[ \t]*$)`,
    identifierRegex: String.raw`Tarjeta de (?:Cr[eé]dito|D[eé]bito)\s*[*xX•]*\s*(\d{4})\b`,
    dateRegex: String.raw`D[ií]a\s+(\d{1,2}/\d{1,2}/\d{4})`,
  },
];

/** Versión 2 tal como se instaló: igual a la actual salvo la compra BAC, que exigía comercio antes del monto. */
export const PRESET_RULES_V2: Preset[] = PRESET_RULES.map((p) =>
  p.name === "BAC · Compra con tarjeta"
    ? {
        ...p,
        amountRegex: String.raw`\bComercio\s+Monto\s+.+?\s+${CUR}\s?${AMOUNT}`,
        currencyRegex: String.raw`\bComercio\s+Monto\s+.+?\s+${CUR_CAPTURE}\s?\d`,
      }
    : p,
);

/** Cada versión anterior tal como se instaló, para actualizar sólo los campos que el usuario no editó. */
export const PRESET_HISTORY: Record<number, Preset[]> = { 1: PRESET_RULES_V1, 2: PRESET_RULES_V2 };

/** Versión del set de presets: al subirla se instalan los que falten (por nombre) y se actualizan los campos no editados. */
export const PRESETS_VERSION = 3;
