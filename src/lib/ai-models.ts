// Proveedores y modelos de IA que cada usuario puede elegir. Sin dependencias de servidor (lo usan formularios).

export type AiProviderId = "anthropic" | "openai";

export const AI_PROVIDER_NAMES: Record<AiProviderId, string> = { anthropic: "Claude (Anthropic)", openai: "OpenAI" };

/** Modelo recomendado al guardar una clave nueva. */
export const DEFAULT_AI_MODELS: Record<AiProviderId, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5",
};

/** Sugerencias mientras no se haya consultado la lista real de modelos de la clave. */
export const SUGGESTED_AI_MODELS: Record<AiProviderId, string[]> = {
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  openai: ["gpt-5.5", "gpt-5", "gpt-5-mini", "gpt-5-nano"],
};

/** Página oficial de precios de cada proveedor. */
export const AI_PRICING_URLS: Record<AiProviderId, string> = {
  anthropic: "https://platform.claude.com/docs/en/about-claude/pricing",
  openai: "https://openai.com/api/pricing/",
};

/**
 * Precio de referencia en USD por millón de tokens (entrada / salida), revisado en octubre de 2026.
 * Sólo modelos con precio confirmado: los demás se muestran sin precio en lugar de con uno dudoso.
 */
const AI_MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "gpt-5.5": { input: 5, output: 30 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
};

/** Precio de un modelo; acepta ids con fecha ("gpt-5-2025-08-07"). */
export function aiModelPrice(model: string) {
  return AI_MODEL_PRICES[model] ?? AI_MODEL_PRICES[model.replace(/-(\d{4}-\d{2}-\d{2}|\d{8})$/, "")] ?? null;
}
