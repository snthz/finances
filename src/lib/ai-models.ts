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
  openai: ["gpt-5", "gpt-5-mini"],
};
