import { describe, expect, test } from "bun:test";
import { extract, normalizeCurrency, parseAmount, ruleMatches } from "@/lib/email/parser";

const CURRENCIES = [
  { code: "HNL", aliases: ["HNL", "Lps.", "Lps", "L.", "L", "lempiras"] },
  { code: "USD", aliases: ["US$", "USD", "$"] },
];

describe("parseAmount", () => {
  test.each([
    ["1,234.56", 1234.56],
    ["1.234,56", 1234.56],
    ["RD$ 1,234", 1234],
    ["12,50", 12.5],
    ["1.234.567", 1234567],
    ["0", null],
    ["abc", null],
  ])("%s → %p", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });
});

describe("normalizeCurrency", () => {
  test("usa el alias más largo primero", () => {
    expect(normalizeCurrency("US$", CURRENCIES)).toBe("USD");
    expect(normalizeCurrency("Lps.", CURRENCIES)).toBe("HNL");
  });
  test("un alias de letra no coincide dentro de otra palabra", () => {
    expect(normalizeCurrency("TOTAL", [{ code: "HNL", aliases: ["L"] }])).toBe(null);
  });
  test("acepta códigos ISO desconocidos", () => {
    expect(normalizeCurrency(" eur ", CURRENCIES)).toBe("EUR");
  });
});

describe("reglas", () => {
  const rule = { fromPattern: "bac", subjectPattern: "compra|consumo", bodyPattern: null };
  const email = {
    from: "Notificaciones BAC <alertas@bac.hn>",
    subject: "Compra autorizada",
    body: "Tarjeta terminada en 4821\nMonto: L. 1,450.00\nComercio: SUPERMERCADO LA COLONIA",
  };

  test("filtros sin distinguir mayúsculas", () => {
    expect(ruleMatches(rule as never, email)).toBe(true);
    expect(ruleMatches({ ...rule, fromPattern: "ficohsa" } as never, email)).toBe(false);
  });

  test("extracción genérica de monto, moneda y últimos 4", () => {
    const ex = extract(rule as never, email, CURRENCIES);
    expect(ex.amount).toBe(1450);
    expect(ex.currency).toBe("HNL");
    expect(ex.identifier).toBe("4821");
  });
});
