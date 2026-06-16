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
  readonly harness: HarnessConfig;
}

export interface HarnessConfig {
  /** CLI command to invoke the agent (e.g. "claude", "codex", "kiro-cli") */
  readonly command: string;
  /** CLI args template — {{PROMPT}} is replaced with the work prompt */
  readonly args: readonly string[];
  /** If true, the tick runs in an IDE terminal (not launchd). No agent gate by default. */
  readonly ideNative?: boolean;
  /**
   * Harness type: "cli" (default, shells out to command) or "local-llm"
   * (calls ollama/local model directly, no external CLI required).
   * "local-llm" uses the accelerator/local-llm module at temperature 0
   * for deterministic, free, no-account-required operation.
   */
  readonly type?: "cli" | "local-llm";
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
    harness: { command: "claude", args: ["-p", "--permission-mode", "auto", "{{PROMPT}}"] },
  },
  {
    name: "kiro", label: "com.lucent.zeta.kiro-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
    harness: { command: "kiro-cli", args: ["chat", "--no-interactive", "--trust-all-tools", "{{PROMPT}}"] },
  },
  {
    name: "codex", label: "com.lucent.zeta.codex-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
    harness: { command: "codex", args: ["--approval-mode", "full-auto", "{{PROMPT}}"] },
  },
  {
    name: "riven", label: "com.lucent.zeta.riven-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 300, defaultRef: "main",
    harness: { command: "cursor", args: ["--background", "{{PROMPT}}"], ideNative: true },
  },
  {
    name: "soraya", label: "com.lucent.zeta.soraya-loop",
    scheduleInterval: 60, gateInterval: 0, gateTimeout: 0, defaultRef: "main",
    harness: { command: "soraya", args: ["{{PROMPT}}"] },
  },
  {
    name: "lior", label: "com.lucent.zeta.lior-loop",
    scheduleInterval: 60, gateInterval: 900, gateTimeout: 1800, defaultRef: "main",
    harness: { command: "agy", args: ["-p", "{{PROMPT}}", "--model", "gemini-2.5-pro", "--dangerously-skip-permissions"] },
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
    harness: {
      type: "local-llm",
      command: "ollama", // not actually shelled out — marker only
      args: [],
      model: opts?.model ?? "qwen2.5:0.5b",
      host: opts?.host ?? "http://127.0.0.1:11434",
      systemPrompt: opts?.systemPrompt ?? `You are ${name}, a local test persona. Respond concisely.`,
    },
  };
}
