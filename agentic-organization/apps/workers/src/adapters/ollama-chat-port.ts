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

import type { ChatCompletionPort, ChatCompletionRequest } from "../../../../packages/application/src/index.ts";

export type CreateOllamaChatPortInput = {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  /** injected for testability; defaults to global fetch */
  fetchImpl?: typeof fetch;
};

type OllamaChatResponse = {
  message?: { content?: string };
};

export function createOllamaChatPort(input: CreateOllamaChatPortInput): ChatCompletionPort {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 20_000;
  const url = `${input.baseUrl.replace(/\/+$/, "")}/api/chat`;

  return {
    complete: async (request: ChatCompletionRequest): Promise<string> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: input.model,
            stream: false,
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
        return content;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
