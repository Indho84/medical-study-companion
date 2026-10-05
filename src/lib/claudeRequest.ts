import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { toResponse } from "./postprocess";
import { buildUserPrompt, schemaFor, systemFor } from "./prompts";
import type { ModelId } from "./models";
import type { GenerateRequest, GenerateResponse } from "./types";

const isHard = (req: GenerateRequest) => req.kind === "quiz" || req.kind === "casereport";

/** Build the Messages API request for a generation, adapted to the model's API surface. */
export function buildParams(req: GenerateRequest, model: ModelId): Omit<MessageCreateParamsStreaming, "stream"> {
  const base = {
    model,
    system: systemFor(req),
    messages: [{ role: "user" as const, content: buildUserPrompt(req) }],
  };
  const format = { type: "json_schema" as const, schema: schemaFor(req) };

  if (model === "claude-haiku-4-5") {
    // Haiku 4.5 uses a fixed thinking budget and has no effort setting; 64K max output.
    return {
      ...base,
      max_tokens: 32000,
      ...(isHard(req) && { thinking: { type: "enabled", budget_tokens: 6000 } }),
      output_config: { format },
    };
  }

  return {
    ...base,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: isHard(req) ? "high" : "medium", format },
  };
}

/** Stream one generation to completion and turn it into a GenerateResponse. */
export async function runGeneration(client: Anthropic, req: GenerateRequest, model: ModelId): Promise<GenerateResponse> {
  const message = await client.beta.messages.stream(buildParams(req, model)).finalMessage();
  return parseMessage(req, message);
}

function parseMessage(req: GenerateRequest, message: BetaMessage): GenerateResponse {
  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined to generate this content. Try a different section of the slides.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("The response was too long and got cut off. Try a smaller number of items.");
  }
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return toResponse(req, JSON.parse(text));
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error("Claude returned malformed output. Please try again.");
    throw e;
  }
}

/** Plain-language message for an API error, shared by the server route and browser mode. */
export function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "Your API key was rejected. Check it in Settings (it starts with sk-ant-).";
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return "This API key isn't allowed to use this model. Check your key in Settings.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Too many requests right now. Wait a minute and try again.";
  }
  if (error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)) {
    return "Your Anthropic credit has run out. Add credit at console.anthropic.com → Billing.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach Claude. Check your internet connection and try again.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Claude API error (${error.status}): ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}
