// Saldos por moneda de las tarjetas de crédito (ej. una tarjeta con saldo en lempiras y en dólares).
// Funciones puras: las usan las consultas, el formulario y los tests.

/** Monedas del saldo de la tarjeta: la principal primero y luego las adicionales, sin repetir. */
export function cardCurrencyList(primary: string, extras: readonly string[]) {
  return [primary, ...extras.filter((c, i) => c !== primary && extras.indexOf(c) === i)];
}

/** Valor de 1 unidad de la moneda en la moneda base (null si no hay tasa). */
export type RateOf = (code: string) => number | null | undefined;

/**
 * A qué saldo va un monto en `currency`: al de su misma moneda si la tarjeta la maneja; si no, al de la
 * primera moneda adicional (el banco cobra en dólares una compra en quetzales), convertido con las tasas.
 * Sin monedas adicionales o sin tasa, queda aparte en su propia moneda.
 */
export function cardBucket(currency: string, list: readonly string[], rateOf: RateOf): { currency: string; factor: number } {
  if (list.includes(currency) || list.length < 2) return { currency, factor: 1 };
  const target = list[1];
  const from = rateOf(currency);
  const to = rateOf(target);
  if (!from || !to) return { currency, factor: 1 };
  return { currency: target, factor: from / to };
}

/**
 * Agrupa sumas por moneda en los saldos de la tarjeta. Cada fila trae su moneda y sus montos (`keys`);
 * el resultado tiene una entrada por cada moneda de la tarjeta (en orden) más las que quedaron aparte.
 */
export function bucketize<K extends string>(
  list: readonly string[],
  rateOf: RateOf,
  keys: readonly K[],
  rows: readonly ({ currency: string } & Record<K, number>)[],
): Map<string, Record<K, number>> {
  const zero = () => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  const out = new Map<string, Record<K, number>>(list.map((c) => [c, zero()]));
  for (const row of rows) {
    const { currency, factor } = cardBucket(row.currency, list, rateOf);
    const acc = out.get(currency) ?? zero();
    for (const k of keys) acc[k] = Math.round((acc[k] + row[k] * factor) * 100) / 100;
    out.set(currency, acc);
  }
  return out;
}
