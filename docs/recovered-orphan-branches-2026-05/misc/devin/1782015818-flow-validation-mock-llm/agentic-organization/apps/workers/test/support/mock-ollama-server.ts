/**
 * Mock Ollama provider — a deterministic, dependency-free HTTP server that
 * speaks the subset of the Ollama `/api/chat` protocol the worker's
 * `createOllamaChatPort` adapter uses. It lets the agent's model-backed
 * decision flow be exercised end-to-end (over a real network boundary, JSON
 * encode/decode, timeout handling) without a real model or any credentials —
 * the "mock LLM provider" the flow harness boots with.
 *
 * In-process: `startMockOllamaServer({ decide })` returns the bound base URL,
 * the captured requests, and a close handle. Standalone (e.g. in a
 * container/KIND): `runMockOllamaServerCli()` reads `PORT` /
 * `MOCK_OLLAMA_STRATEGY` from the environment and serves until killed.
 *
 * Stays within the repo's curated node typings shim (`packages/test-node.d.ts`):
 * request bodies arrive as string chunks (no Buffer), and the bound port is read
 * from `Server.address()`.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { env } from "node:process";

export type MockOllamaChatRequest = {
  model?: string;
  stream?: boolean;
  format?: unknown;
  options?: { temperature?: number };
  messages?: ReadonlyArray<{ role?: string; content?: string }>;
};

export type MockOllamaDecision = (request: MockOllamaChatRequest) => string;

export type MockOllamaServerHandle = {
  baseUrl: string;
  requests: readonly MockOllamaChatRequest[];
  /** Replace the decision hook between assertions. */
  setDecision: (decide: MockOllamaDecision) => void;
  /** When set, the server answers `/api/chat` with this HTTP status (models an outage). */
  setFailureStatus: (status: number | undefined) => void;
  close: () => Promise<void>;
};

export type StartMockOllamaServerInput = {
  /** Default: name the LAST legal move (distinguishable from the deterministic-first fallback). */
  decide?: MockOllamaDecision;
  /** Bind host; defaults to 127.0.0.1. */
  host?: string;
  /** Bind port; defaults to 0 (ephemeral). */
  port?: number;
};

const ChatPath = "/api/chat";

/** Parse the legal `actionType` tokens out of the composer's user prompt. */
export function parseLegalActionTypes(request: MockOllamaChatRequest): readonly string[] {
  const user = request.messages?.find((message) => message.role === "user")?.content ?? "";
  const tokens: string[] = [];
  for (const line of user.split("\n")) {
    const match = /^-\s+([a-z0-9_]+)\s+->/i.exec(line.trim());
    if (match?.[1] !== undefined) {
      tokens.push(match[1]);
    }
  }
  return tokens;
}

/** Default strategy: pick the last legal move so the model's choice is observable. */
export function decideLastLegalMove(request: MockOllamaChatRequest): string {
  const tokens = parseLegalActionTypes(request);
  return tokens.length > 0 ? tokens[tokens.length - 1]! : "";
}

/** Strategy that always names the first legal move (matches the deterministic baseline). */
export function decideFirstLegalMove(request: MockOllamaChatRequest): string {
  const tokens = parseLegalActionTypes(request);
  return tokens.length > 0 ? tokens[0]! : "";
}

export async function startMockOllamaServer(input: StartMockOllamaServerInput = {}): Promise<MockOllamaServerHandle> {
  const requests: MockOllamaChatRequest[] = [];
  let decide: MockOllamaDecision = input.decide ?? decideLastLegalMove;
  let failureStatus: number | undefined;

  const server = createServer((req, res) => {
    void handleRequest({
      req,
      res,
      onChat: (parsed) => {
        requests.push(parsed);
        if (failureStatus !== undefined) {
          return { failureStatus };
        }
        return { content: decide(parsed), model: parsed.model ?? "mock-ollama" };
      },
    });
  });

  const host = input.host ?? "127.0.0.1";
  await new Promise<void>((resolve) => server.listen(input.port ?? 0, host, resolve));

  return {
    baseUrl: `http://${host}:${resolveBoundPort(server, input.port ?? 0)}`,
    requests,
    setDecision: (next) => {
      decide = next;
    },
    setFailureStatus: (status) => {
      failureStatus = status;
    },
    close: () => closeServer(server),
  };
}

function resolveBoundPort(server: Server, fallbackPort: number): number {
  const address = server.address();
  if (address !== null && typeof address === "object") {
    return address.port;
  }
  return fallbackPort;
}

type ChatOutcome = { content: string; model: string } | { failureStatus: number };

type HandleRequestInput = {
  req: IncomingMessage;
  res: ServerResponse;
  onChat: (request: MockOllamaChatRequest) => ChatOutcome;
};

async function handleRequest(input: HandleRequestInput): Promise<void> {
  const { req, res, onChat } = input;
  const url = req.url ?? "";

  if (req.method === "GET" && (url === "/" || url === "/api/version")) {
    respondJson(res, 200, { version: "mock-ollama" });
    return;
  }

  if (req.method !== "POST" || !url.startsWith(ChatPath)) {
    respondJson(res, 404, { error: "not found" });
    return;
  }

  const parsed = parseBody(await readBody(req));
  const outcome = onChat(parsed);

  if ("failureStatus" in outcome) {
    respondJson(res, outcome.failureStatus, { error: "mock ollama unavailable" });
    return;
  }

  respondJson(res, 200, {
    model: outcome.model,
    created_at: "1970-01-01T00:00:00.000Z",
    message: { role: "assistant", content: outcome.content },
    done: true,
    prompt_eval_count: 12,
    eval_count: 4,
  });
}

function parseBody(raw: string): MockOllamaChatRequest {
  if (raw.length === 0) {
    return {};
  }
  try {
    return JSON.parse(raw) as MockOllamaChatRequest;
  } catch {
    return {};
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise<string>((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk ?? "";
    });
    req.on("end", () => resolve(body));
  });
}

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function closeServer(server: Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

/** Standalone entrypoint for container/KIND use. Serves until the process is killed. */
export async function runMockOllamaServerCli(): Promise<void> {
  const port = Number.parseInt(env.PORT ?? "11434", 10);
  const strategy = env.MOCK_OLLAMA_STRATEGY === "first" ? decideFirstLegalMove : decideLastLegalMove;
  const handle = await startMockOllamaServer({ decide: strategy, host: "0.0.0.0", port });
  process.stdout.write(`${JSON.stringify({ event: "mock_ollama.listening", baseUrl: handle.baseUrl })}\n`);
}
