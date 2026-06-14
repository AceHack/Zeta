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

export function getPersona(name: string): PersonaConfig | undefined {
  return PERSONAS.find((p) => p.name === name);
}

export function listPersonas(): readonly PersonaConfig[] {
  return PERSONAS;
}

export function listPersonaNames(): readonly string[] {
  return PERSONAS.map((p) => p.name);
}
