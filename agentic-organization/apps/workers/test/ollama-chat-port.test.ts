import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import { createOllamaChatPort } from "../src/adapters/ollama-chat-port.ts";

test("Ollama chat port returns content with model and token usage", async () => {
  const calls: { url: string; body: unknown }[] = [];
  const port = createOllamaChatPort({
    baseUrl: "http://ollama:11434/",
    model: "llama3.1",
    fetchImpl: (async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          model: "llama3.1:8b",
          message: { content: "rework" },
          prompt_eval_count: 11,
          eval_count: 7,
        }),
        { status: 200 },
      );
    }) as typeof fetch,
  });

  const result = await port.complete({ system: "choose legally", user: "options" });

  deepEqual(result, {
    content: "rework",
    model: "llama3.1:8b",
    promptTokens: 11,
    completionTokens: 7,
    totalTokens: 18,
  });
  equal(calls[0]?.url, "http://ollama:11434/api/chat");
});
