import { describe, expect, test } from "bun:test";
import { bucketize, cardBucket, cardCurrencyList } from "@/lib/card-currencies";

// Tasas en moneda base HNL: 1 USD = 25 HNL, 1 GTQ = 3.2 HNL
const RATES: Record<string, number | null> = { HNL: 1, USD: 25, GTQ: 3.2, EUR: null };
const rateOf = (c: string) => RATES[c];

describe("saldos por moneda de las tarjetas", () => {
  test("la moneda principal va primero y no se repite", () => {
    expect(cardCurrencyList("HNL", ["USD", "HNL", "USD"])).toEqual(["HNL", "USD"]);
    expect(cardCurrencyList("HNL", [])).toEqual(["HNL"]);
  });

  test("cada cargo va al saldo de su moneda si la tarjeta la maneja", () => {
    expect(cardBucket("HNL", ["HNL", "USD"], rateOf)).toEqual({ currency: "HNL", factor: 1 });
    expect(cardBucket("USD", ["HNL", "USD"], rateOf)).toEqual({ currency: "USD", factor: 1 });
  });

  test("una compra en otra moneda se carga al saldo en dólares, convertida", () => {
    expect(cardBucket("GTQ", ["HNL", "USD"], rateOf)).toEqual({ currency: "USD", factor: 3.2 / 25 });
  });

  test("sin moneda adicional o sin tasa, queda aparte", () => {
    expect(cardBucket("GTQ", ["HNL"], rateOf)).toEqual({ currency: "GTQ", factor: 1 });
    expect(cardBucket("EUR", ["HNL", "USD"], rateOf)).toEqual({ currency: "EUR", factor: 1 });
  });

  test("bucketize suma lempiras y dólares por separado", () => {
    const out = bucketize(["HNL", "USD"], rateOf, ["balance"] as const, [
      { currency: "HNL", balance: -1213.61 },
      { currency: "USD", balance: -1 },
      { currency: "GTQ", balance: -215 },
    ]);
    expect([...out.keys()]).toEqual(["HNL", "USD"]);
    expect(out.get("HNL")).toEqual({ balance: -1213.61 });
    expect(out.get("USD")).toEqual({ balance: -28.52 });
  });

  test("las monedas de la tarjeta aparecen aunque no tengan movimientos", () => {
    const out = bucketize(["HNL", "USD"], rateOf, ["balance", "paid"] as const, []);
    expect(out.get("USD")).toEqual({ balance: 0, paid: 0 });
  });
});
