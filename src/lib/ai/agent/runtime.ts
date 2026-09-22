import {
  createModels,
  createProvider,
  envApiKeyAuth,
  type Api,
  type Model,
  type Models,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

const PROVIDER_ID = "atomforge";
const PROVIDER_NAME = "AtomForge";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;

export type AgentRuntime = {
  models: Models;
  model: Model<Api>;
};

/** The provider is only reachable when both a key and an explicit model id exist. */
export function isAgentConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim() && process.env.AI_MODEL?.trim());
}

/**
 * Builds a pi-ai runtime around whatever OpenAI-compatible endpoint the
 * deployment configured. Returns null when the deployment is in Demo Mode.
 */
export function createAgentRuntime(): AgentRuntime | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  const modelId = process.env.AI_MODEL?.trim();
  if (!apiKey || !modelId) return null;

  const baseUrl = (process.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model: Model<Api> = {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: PROVIDER_ID,
    baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
  };

  const models = createModels();
  models.setProvider(
    createProvider({
      id: PROVIDER_ID,
      name: PROVIDER_NAME,
      baseUrl,
      auth: { apiKey: envApiKeyAuth("AI_API_KEY", ["AI_API_KEY"]) },
      models: [model],
      api: openAICompletionsApi(),
    }),
  );

  const resolved = models.getModel(PROVIDER_ID, modelId);
  return resolved ? { models, model: resolved } : null;
}
