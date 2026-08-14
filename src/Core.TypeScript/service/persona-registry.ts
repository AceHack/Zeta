/**
 * service/persona-registry.ts — data-driven persona configuration.
 *
 * Adding a new persona is a DATA change (add an entry here), not a code change.
 * The unified loop-tick and IServiceManager consume this registry.
 */

export interface PersonaConfig {
  readonly name: string;
  readonly label: string;
  readonly scheduleInterval: number; // seconds between heartbeat ticks
  readonly gateInterval: number;    // seconds between agent work cycles (0 = no agent gate)
  readonly gateTimeout: number;     // max seconds for a single agent invocation
  readonly defaultRef: string;
  /** Git author name for substrate-honest attribution (e.g. "Otto") */
  readonly gitAuthorName?: string;
  /** Git author email for substrate-honest attribution (e.g. "otto@zeta.lucent-financial-group.com") */
  readonly gitAuthorEmail?: string;
  /** The persona's preferred model (used when invoking via their harness). */
  readonly preferredModel: string;
  /** Fallback models in order of preference (if primary unavailable). */
  readonly fallbackModels?: readonly string[];
  readonly harness: HarnessConfig;
}

export interface HarnessConfig {
  /** CLI command to invoke the agent (e.g. "claude", "codex", "kiro-cli") */
  readonly command: string;
  /** CLI args template — {{PROMPT}} replaced with prompt, {{MODEL}} replaced with resolved model */
  readonly args: readonly string[];
  /** If true, the tick runs in an IDE terminal (not launchd). No agent gate by default. */
  readonly ideNative?: boolean;
  /**
   * Harness type: "cli" (default, shells out to command), "local-llm"
   * (calls ollama/local model directly), "openai-stream", or "mux-duplex".
   */
  readonly type?: "cli" | "local-llm" | "openai-stream" | "mux-duplex";
  /** The harness's default model (used when persona's preferred is incompatible). */
  readonly defaultModel?: string;
  /** Models this harness supports (if set, persona model must be in this list or falls back to defaultModel). */
  readonly compatibleModels?: readonly string[];
  /** For local-llm type: the model name (default: "qwen2.5:0.5b"). */
  readonly model?: string;
  /** For local-llm type: ollama host (default: "http://127.0.0.1:11434"). */
  readonly host?: string;
  /** For local-llm type: system prompt / persona preamble. */
  readonly systemPrompt?: string;
}

export const PERSONAS: readonly PersonaConfig[] = [
  {
    name: "otto", label: "com.lucent.zeta.otto-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
    gitAuthorName: "Otto", gitAuthorEmail: "otto@zeta.lucent-financial-group.com",
    preferredModel: "claude-opus-4-8",
    fallbackModels: ["claude-sonnet-4-6"],
    harness: { command: "claude", args: ["-p", "--model", "{{MODEL}}", "--permission-mode", "auto", "{{PROMPT}}"], defaultModel: "claude-opus-4-8" },
  },
  {
    name: "kiro", label: "com.lucent.zeta.kiro-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
    gitAuthorName: "Kiro", gitAuthorEmail: "kiro@zeta.lucent-financial-group.com",
    preferredModel: "auto",
    harness: { command: "kiro-cli", args: ["chat", "--no-interactive", "--trust-all-tools", "{{PROMPT}}"], defaultModel: "auto" },
  },
  {
    // Alexa runs cell-3 (harness=kiro) in tools/setup/manifests/cluster-cells,
    // and registry/personas.yaml id=3 describes her as the Kiro-surface builder.
    // Both independent sources agree on the harness, so it is copied verbatim
    // from the kiro entry above rather than invented. NOT ideNative: the
    // manifest assigns her a launchd cell, and ideNative means "IDE terminal,
    // not launchd".
    //
    // She was absent from this registry until 2026-08-14 while the manifest kept
    // provisioning a cell for her — the drift meant `loop-tick --persona alexa`
    // would have exited 1 on "Unknown persona", and loop-liveness could not even
    // see the cell to report it dead.
    name: "alexa", label: "com.lucent.zeta.alexa-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
    gitAuthorName: "Alexa", gitAuthorEmail: "alexa@zeta.lucent-financial-group.com",
    preferredModel: "auto",
    harness: { command: "kiro-cli", args: ["chat", "--no-interactive", "--trust-all-tools", "{{PROMPT}}"], defaultModel: "auto" },
  },
  {
    name: "codex", label: "com.lucent.zeta.codex-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
    gitAuthorName: "Codex", gitAuthorEmail: "codex@zeta.lucent-financial-group.com",
    preferredModel: "gpt-5.5",
    fallbackModels: ["o3"],
    harness: { command: "codex", args: ["--approval-mode", "full-auto", "--model", "{{MODEL}}", "{{PROMPT}}"], defaultModel: "gpt-5.5" },
  },
  {
    // Vera runs cell-1 (harness=codex) in the cluster-cells manifest, and
    // registry/personas.yaml id=5 describes her as the Codex-surface builder.
    // Harness copied verbatim from the codex entry above. Same drift story as
    // alexa: manifest provisioned her, this registry did not know her.
    name: "vera", label: "com.lucent.zeta.vera-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
    gitAuthorName: "Vera", gitAuthorEmail: "vera@zeta.lucent-financial-group.com",
    preferredModel: "gpt-5.5",
    fallbackModels: ["o3"],
    harness: { command: "codex", args: ["--approval-mode", "full-auto", "--model", "{{MODEL}}", "{{PROMPT}}"], defaultModel: "gpt-5.5" },
  },
  {
    name: "riven", label: "com.lucent.zeta.riven-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
    gitAuthorName: "Riven", gitAuthorEmail: "riven@zeta.lucent-financial-group.com",
    preferredModel: "grok-4-3",
    fallbackModels: ["grok-4-3"],
    harness: { command: "cursor-agent", args: ["--print", "--model", "{{MODEL}}", "{{PROMPT}}"], ideNative: true, defaultModel: "grok-4-3" },
  },
  {
    name: "soraya", label: "com.lucent.zeta.soraya-loop",
    scheduleInterval: 60, gateInterval: 0, gateTimeout: 0, defaultRef: "main",
    gitAuthorName: "Soraya", gitAuthorEmail: "soraya@zeta.lucent-financial-group.com",
    preferredModel: "claude-opus-4-8",
    fallbackModels: ["claude-sonnet-4-6"],
    harness: { command: "claude", args: ["-p", "--model", "{{MODEL}}", "--permission-mode", "auto", "{{PROMPT}}"], defaultModel: "claude-opus-4-8" },
  },
  {
    name: "lior", label: "com.lucent.zeta.lior-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 1800, defaultRef: "main",
    gitAuthorName: "Lior", gitAuthorEmail: "lior@zeta.lucent-financial-group.com",
    preferredModel: "gemini-3.5-flash",
    fallbackModels: ["gemini-3.1-pro"],
    harness: { command: "agy", args: ["-p", "{{PROMPT}}", "--model", "{{MODEL}}", "--dangerously-skip-permissions"], defaultModel: "gemini-3.5-flash" },
  },
  {
    name: "tariq", label: "com.lucent.zeta.tariq-loop",
    scheduleInterval: 120, gateInterval: 0, gateTimeout: 0, defaultRef: "main",
    gitAuthorName: "Tariq", gitAuthorEmail: "tariq@zeta.lucent-financial-group.com",
    preferredModel: "claude-opus-4-8",
    fallbackModels: ["claude-sonnet-4-6"],
    harness: { command: "claude", args: ["-p", "--model", "{{MODEL}}", "--permission-mode", "auto", "{{PROMPT}}"], defaultModel: "claude-opus-4-8" },
  },
];

/** Mutable runtime registry — starts with the static PERSONAS, can be extended at runtime. */
const registry: PersonaConfig[] = [...PERSONAS];

export function getPersona(name: string): PersonaConfig | undefined {
  return registry.find((p) => p.name === name);
}

export function listPersonas(): readonly PersonaConfig[] {
  return registry;
}

export function listPersonaNames(): readonly string[] {
  return registry.map((p) => p.name);
}

/**
 * Register a persona at runtime (ephemeral — not persisted to disk).
 * Use for test personas, local-LLM personas, or personas that don't
 * need a permanent entry in the static array.
 *
 * If a persona with the same name already exists, it is replaced.
 */
export function registerPersona(config: PersonaConfig): void {
  const idx = registry.findIndex((p) => p.name === config.name);
  if (idx >= 0) {
    registry[idx] = config;
  } else {
    registry.push(config);
  }
}

/**
 * Create a local-LLM persona config (convenience helper).
 * No external CLI required — calls ollama directly.
 */
export function localLlmPersona(name: string, opts?: {
  model?: string;
  systemPrompt?: string;
  host?: string;
}): PersonaConfig {
  return {
    name,
    label: `local-llm-${name}`,
    scheduleInterval: 0,
    gateInterval: 0,
    gateTimeout: 60,
    defaultRef: "main",
    preferredModel: opts?.model ?? "qwen3.6:0.6b",
    harness: {
      type: "local-llm",
      command: "ollama", // not actually shelled out — marker only
      args: [],
      model: opts?.model ?? "qwen3.6:0.6b",
      defaultModel: "qwen2.5:0.5b", // fallback to what's installed locally
      host: opts?.host ?? "http://127.0.0.1:11434",
      systemPrompt: opts?.systemPrompt ?? `You are ${name}, a local test persona. Respond concisely.`,
    },
  };
}
