import { describe, expect, test } from "bun:test";
import { aiCallCost, fmtUsd } from "@/lib/ai-models";

describe("costo de la IA", () => {
  test("entrada y salida con el precio por millón del modelo", () => {
    // claude-opus-5-5: US$ 4 entrada / US$ 20 salida por millón
    expect(aiCallCost("claude-opus-5-5", { input: 10_000, cacheRead: 0, cacheWrite: 0, output: 2_000 })).toBeCloseTo(0.04 + 0.04, 10);
  });

  test("la caché: leer a 0.1× y escribir a 1.25× la entrada", () => {
    expect(aiCallCost("claude-opus-5-5", { input: 0, cacheRead: 1_000_000, cacheWrite: 0, output: 0 })).toBeCloseTo(0.4, 10);
    expect(aiCallCost("claude-opus-5-5", { input: 0, cacheRead: 0, cacheWrite: 1_000_000, output: 0 })).toBeCloseTo(5, 10);
  });

  test("ids con fecha usan el precio del modelo base; sin precio da null", () => {
    expect(aiCallCost("gpt-5-2025-08-07", { input: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0 })).toBeCloseTo(1.25, 10);
    expect(aiCallCost("modelo-desconocido", { input: 1, cacheRead: 0, cacheWrite: 0, output: 1 })).toBeNull();
  });

  test("formato con más decimales para centavos", () => {
    expect(fmtUsd(0)).toBe("US$ 0.00");
    expect(fmtUsd(0.0045)).toBe("US$ 0.0045");
    expect(fmtUsd(0.0123)).toBe("US$ 0.012");
    expect(fmtUsd(0.25)).toBe("US$ 0.250");
    expect(fmtUsd(12.5)).toBe("US$ 12.50");
  });
});
