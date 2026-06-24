/**
 * Agent persona registry — port of
 * `full-ai-cluster/nixos/modules/zeta-ai-agent.nix` `personas` let-binding
 * (Merge1 §09).
 *
 * The systemd persona registry (≥3 vendor-diverse AI agents, each
 * independently restartable, mutually reparable, cluster-reparable from outside
 * the failure domain) becomes the room agent persona registry. Each room is
 * initialized with one or more personas; a persona's `binary` + `invocationArgs`
 * become the room's agent invocation contract.
 *
 * Vendor diversity is load-bearing: ≥3 distinct vendors give outage resilience
 * AND self-modification safety (a BFT margin when one vendor update breaks ≥1
 * agent — see mutual-repair.ts).
 *
 * NOTE (donor↔doc reconciliation): the §09 doc sketch lists lior as
 * `binary: "gemini"`. The donor nix (the source of truth) ships lior as
 * `binary: "agy"` (Antigravity CLI, `-p` flag) per B-0850.3d. We port the
 * donor's actual values.
 */

export interface AgentPersonaConfig {
  readonly name: string;
  readonly vendor: string;
  /** Non-interactive CLI binary (resolved from the persona's vendor toolchain). */
  readonly binary: string;
  /** Per-vendor non-interactive invocation args (e.g. Claude `--print`, Codex `exec`). */
  readonly invocationArgs: readonly string[];
  readonly description: string;
}

/**
 * The canonical persona registry — 5 vendor-diverse AI agents.
 * Port of `zeta-ai-agent.nix` `personas`.
 */
export const PERSONA_REGISTRY: Readonly<Record<string, AgentPersonaConfig>> = {
  otto: {
    name: "otto",
    vendor: "anthropic",
    binary: "claude",
    invocationArgs: ["--print", "<<autonomous-loop>>"],
    description: "Otto AI agent — Claude Code (Anthropic)",
  },
  alexa: {
    name: "alexa",
    vendor: "alibaba-qwen",
    binary: "kiro",
    invocationArgs: [],
    description: "Alexa AI agent — Kiro (Qwen Coder)",
  },
  riven: {
    name: "riven",
    vendor: "xai-grok",
    binary: "grok",
    invocationArgs: [],
    description: "Riven AI agent — Grok / Grok-Build (xAI)",
  },
  vera: {
    name: "vera",
    vendor: "openai",
    binary: "codex",
    invocationArgs: ["exec", "<<autonomous-loop>>"],
    description: "Vera AI agent — Codex (OpenAI)",
  },
  lior: {
    name: "lior",
    vendor: "google-gemini",
    binary: "agy",
    invocationArgs: ["-p", "<<autonomous-loop>>"],
    description: "Lior AI agent — Antigravity CLI (Google)",
  },
} as const;

/** Get a persona config by name. */
export function getPersona(name: string): AgentPersonaConfig | undefined {
  return PERSONA_REGISTRY[name];
}

/** List all personas, in a deterministic (name-sorted) order for DST replay. */
export function listPersonas(): readonly AgentPersonaConfig[] {
  return Object.values(PERSONA_REGISTRY).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Distinct vendors represented in the registry (the BFT diversity surface). */
export function distinctVendors(): readonly string[] {
  return [...new Set(listPersonas().map((p) => p.vendor))].sort();
}
