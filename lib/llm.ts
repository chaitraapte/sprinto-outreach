import OpenAI from "openai";

// One place for the LLM client, so the model/provider can be swapped by editing
// only this file. Uses the OpenAI-compatible chat completions API against OpenRouter.
let client: OpenAI | null = null;

export function getLLM(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL,
    });
  }
  return client;
}

export function getModel(): string {
  const model = process.env.LLM_MODEL;
  if (!model) throw new Error("LLM_MODEL is not set");
  return model;
}
