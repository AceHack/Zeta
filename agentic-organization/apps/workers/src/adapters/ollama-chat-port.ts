/**
 * Ollama chat adapter — a real ChatCompletionPort backed by a model served by
 * Ollama (https://ollama.com). Runs entirely in-cluster (no external
 * credentials): the worker POSTs to the in-cluster Ollama service and the model
 * returns its choice. This is the agent's live decision backend.
 *
 * Bounded by an AbortController timeout so a slow/hung model never stalls the
 * agent run (the model-backed composer falls back to the deterministic policy
 * when this throws — the agent stays alive).
 */

import type {
  ChatCompletionPort,
  ChatCompletionRequest,
  ChatCompletionResult,
} from "../../../../packages/application/src/index.ts";

export type CreateOllamaChatPortInput = {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  /** injected for testability; defaults to global fetch */
  fetchImpl?: typeof fetch;
};

type OllamaChatResponse = {
  message?: { content?: string };
  model?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

export function createOllamaChatPort(input: CreateOllamaChatPortInput): ChatCompletionPort {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 20_000;
  const url = `${input.baseUrl.replace(/\/+$/, "")}/api/chat`;

  return {
    complete: async (request: ChatCompletionRequest): Promise<ChatCompletionResult> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: input.model,
            stream: false,
            ...createOptionalFormat(request.format),
            options: { temperature: 0 },
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.user },
            ],
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`ollama chat failed: ${response.status} ${response.statusText}`);
        }
        const body = (await response.json()) as OllamaChatResponse;
        const content = body.message?.content;
        if (typeof content !== "string") {
          throw new Error("ollama chat response had no message content");
        }
        return {
          content,
          model: body.model ?? input.model,
          ...createOptionalTokenUsage(body),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function createOptionalFormat(format: ChatCompletionRequest["format"]): { format?: ChatCompletionRequest["format"] } {
  return format === undefined ? {} : { format };
}

function createOptionalTokenUsage(body: OllamaChatResponse): {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
} {
  const promptTokens = isNonNegativeFiniteNumber(body.prompt_eval_count) ? body.prompt_eval_count : undefined;
  const completionTokens = isNonNegativeFiniteNumber(body.eval_count) ? body.eval_count : undefined;

  if (promptTokens === undefined && completionTokens === undefined) {
    return {};
  }

  return {
    ...(promptTokens === undefined ? {} : { promptTokens }),
    ...(completionTokens === undefined ? {} : { completionTokens }),
    totalTokens: (promptTokens ?? 0) + (completionTokens ?? 0),
  };
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
