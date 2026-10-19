import { describe, expect, test } from "bun:test";
import { extract, normalizeCurrency, parseAmount, ruleMatches } from "@/lib/email/parser";
import { PRESET_RULES } from "@/lib/email/presets";

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

describe("monedas fuera de las configuradas", () => {
  test("el catálogo reconoce símbolos y códigos que el usuario aún no tiene", () => {
    expect(normalizeCurrency("Q", CURRENCIES)).toBe("GTQ");
    expect(normalizeCurrency("€", CURRENCIES)).toBe("EUR");
    expect(normalizeCurrency("C$", CURRENCIES)).toBe("NIO");
    // Los alias del usuario mandan: "L" sigue siendo HNL
    expect(normalizeCurrency("L", CURRENCIES)).toBe("HNL");
  });

  const ficohsa = PRESET_RULES.find((p) => p.name === "Ficohsa · Compra con tarjeta")!;
  const bac = PRESET_RULES.find((p) => p.name === "BAC · Compra con tarjeta")!;

  test("Ficohsa en euros", () => {
    const email = {
      from: "BANCO FICOHSA <notificaciones@ficohsa.com>",
      subject: "Compra en comercio",
      body: "BANCO FICOHSA [https://img.masterbase.com/compraencomercio.jpg] Te informamos que se ha realizado una compra con tu Tarjeta de Crédito ****8585 BANCO FICOHSA [https://imgsslscl.masterbase.com/1_03.jpg] Monto EUR 17.16 BANCO FICOHSA [https://imgsslscl.masterbase.com/1_08.jpg] Comercio Hostinger BANCO FICOHSA [https://imgsslscl.masterbase.com/1_08.jpg] Día 17/10/2026 BANCO FICOHSA",
    };
    expect(ruleMatches(ficohsa, email)).toBe(true);
    const ex = extract(ficohsa, email, CURRENCIES);
    expect(ex).toMatchObject({ amount: 17.16, currency: "EUR", merchant: "Hostinger", identifier: "8585" });
    expect(ex.date?.ymd).toBe("2026-10-17");
  });

  test("BAC en quetzales", () => {
    const email = {
      from: "BAC Credomatic <notificacion@baccredomatic.com>",
      subject: "Notificación de transacción",
      body: "BAC Credomatic Informa:\n\nAMEX 3110\n\nEstimado cliente, notificamos que se ha realizado la siguiente transacción con su tarjeta. A continuación el detalle de la misma.\n\nDetalles del movimiento:\n\nComercio\n\nMonto\n\nRESTAURANTE MADRE T\n\nQ 302.28",
    };
    expect(ruleMatches(bac, email)).toBe(true);
    expect(extract(bac, email, CURRENCIES)).toMatchObject({ amount: 302.28, currency: "GTQ", merchant: "RESTAURANTE MADRE T", identifier: "3110" });
  });

  test("BAC en lempiras sigue igual", () => {
    const email = {
      from: "BAC <notificacion@baccredomatic.com>",
      subject: "Notificación",
      body: "AMEX 3110 transacción con su tarjeta\nComercio Monto\nESPRE A AUTOSER BLVD D   L 65",
    };
    expect(extract(bac, email, CURRENCIES)).toMatchObject({ amount: 65, currency: "HNL", merchant: "ESPRE A AUTOSER BLVD D" });
  });

  test("las reglas genéricas también leen monedas del catálogo", () => {
    const ex = extract({ fromPattern: "x" }, { from: "x", subject: "Compra", body: "Compra por Q 1,250.50 con tarjeta 4821" }, CURRENCIES);
    expect(ex).toMatchObject({ amount: 1250.5, currency: "GTQ" });
  });
});
