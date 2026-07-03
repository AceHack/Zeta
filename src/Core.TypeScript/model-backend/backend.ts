// backend.ts — a standards-based ModelBackend port over the chat-completions shape (shadow*).
//
// Aaron 2026-07-03: "maybe we should make this standards-based for talking to different models via
// REST more than just Manus — we can start with just Manus and assume it becomes more generic." And:
// the Manus "OpenAI-compatible" thing "might just be an OpenAI SDK drop-in replacement, same
// chat-completions interface, I don't really know." So we target the INTERFACE, not a vendor: the
// chat-completions shape (messages in → completion out). Whether a backend is a literal
// OpenAI-compatible endpoint or an SDK drop-in, this port hits the same shape. Manus is the first
// adapter, not a special case — swap the config for any OpenAI-compatible model, nothing upstream
// changes (the summon path calls `backend.complete`, oblivious to which model answered).
//
// Noninterference (§13): the network crosses ONLY through the injected `HttpTransport` — the port has
// no `fetch` of its own, so it is deterministic + fake-testable with no real socket and NO SECRET. The
// real key + real transport is the operator-gated wiring (the key lives in `op`/Keychain, biometric-
// approved, read at the edge — never in this module).
//
// HONEST SCOPE: the OpenAI chat-completions request/response shape is the well-defined STANDARD
// (`POST {baseUrl}/v1/chat/completions`, response `choices[0].message.content`). Manus's EXACT path
// and response shape are UNCONFIRMED (I could not verify the OpenAI-compat endpoint from api.manus.ai's
// docs; base URL `https://api.manus.ai` + API-key/OAuth2 auth ARE confirmed). So the adapter is the
// standard shape with the path overridable; conformance to Manus is a config tweak once a real key
// lets us test the live API. Anchors: OpenAI chat-completions API (the de-facto REST standard);
// Manus API (REST, api.manus.ai). Pure TS; the transport is injected.

/// A chat message in the standard shape.
export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/// A completion request (chat-completions shape). `model` overrides the backend default when set.
export interface CompletionRequest {
  readonly messages: readonly ChatMessage[];
  readonly model?: string;
}

/// A completion result — the assistant's text (plus the raw model id that answered, for the ledger).
export interface CompletionResult {
  readonly content: string;
  readonly model: string;
}

export type CompletionOutcome =
  | { readonly ok: true; readonly result: CompletionResult }
  | { readonly ok: false; readonly error: string };

/// The injected HTTP door — the ONLY channel to the network (noninterference §13). A real impl wraps
/// `fetch`; the fake in tests returns canned responses (no socket, no key). Never throws upward: a
/// transport error is a rejected promise the adapter catches.
export interface HttpTransport {
  post(url: string, headers: Readonly<Record<string, string>>, body: string): Promise<{ status: number; body: string }>;
}

/// Backend config: where + which model. `apiKey` is read from `op`/Keychain at the edge and passed in —
/// this module never resolves a secret itself. `chatPath` overrides the default `/v1/chat/completions`
/// for a backend whose path differs (the Manus knob until its shape is confirmed).
export interface BackendConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly chatPath?: string;
}

/// The port every model backend implements — the summon path depends on THIS, not on any vendor.
export interface ModelBackend {
  complete(req: CompletionRequest): Promise<CompletionOutcome>;
}

/// An OpenAI-compatible chat-completions backend over an injected transport. Works for any backend that
/// speaks the standard shape (literal endpoint OR SDK drop-in — same request/response). Never throws.
export function openAiCompatBackend(config: BackendConfig, transport: HttpTransport): ModelBackend {
  // strip trailing slashes without a backtracking-prone regex (ReDoS-safe)
  let base = config.baseUrl;
  while (base.endsWith("/")) base = base.slice(0, -1);
  const url = base + (config.chatPath ?? "/v1/chat/completions");
  return {
    async complete(req: CompletionRequest): Promise<CompletionOutcome> {
      const model = req.model ?? config.model;
      const body = JSON.stringify({ model, messages: req.messages });
      const headers = { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" };
      let res: { status: number; body: string };
      try {
        res = await transport.post(url, headers, body);
      } catch (e) {
        return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (res.status < 200 || res.status >= 300) {
        return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 500)}` };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(res.body);
      } catch {
        return { ok: false, error: "malformed response: not JSON" };
      }
      const content = extractContent(parsed);
      if (content === null) return { ok: false, error: "malformed response: no choices[0].message.content" };
      return { ok: true, result: { content, model } };
    },
  };
}

/// Pull `choices[0].message.content` out of an OpenAI-shaped response, or null if it isn't there.
function extractContent(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const choices = (parsed as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

/// The Manus preset (the first adapter): base URL `https://api.manus.ai`. The key comes from the edge
/// (op/Keychain, biometric-gated) — passed in, never resolved here. `chatPath` is left default; adjust
/// once the live Manus API confirms its path/shape.
export function manusBackend(apiKey: string, model: string, transport: HttpTransport): ModelBackend {
  return openAiCompatBackend({ baseUrl: "https://api.manus.ai", apiKey, model }, transport);
}
