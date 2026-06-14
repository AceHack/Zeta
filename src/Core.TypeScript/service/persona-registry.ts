/**
 * service/persona-registry.ts — data-driven persona configuration.
 *
 * Adding a new persona is a DATA change (add an entry here), not a code change.
 * The unified loop-tick and IServiceManager consume this registry.
 */

export interface PersonaConfig {
  readonly name: string;
  readonly label: string;
  readonly scheduleInterval: number; // seconds
  readonly defaultRef: string;
}

export const PERSONAS: readonly PersonaConfig[] = [
  { name: "kiro",   label: "com.lucent.zeta.kiro-loop",   scheduleInterval: 60, defaultRef: "main" },
  { name: "otto",   label: "com.lucent.zeta.otto-loop",   scheduleInterval: 60, defaultRef: "main" },
  { name: "riven",  label: "com.lucent.zeta.riven-loop",  scheduleInterval: 60, defaultRef: "main" },
  { name: "soraya", label: "com.lucent.zeta.soraya-loop", scheduleInterval: 60, defaultRef: "main" },
  { name: "lior",   label: "com.lucent.zeta.lior-loop",   scheduleInterval: 60, defaultRef: "main" },
  { name: "codex",  label: "com.lucent.zeta.codex-loop",  scheduleInterval: 60, defaultRef: "main" },
];

export function getPersona(name: string): PersonaConfig | undefined {
  return PERSONAS.find((p) => p.name === name);
}

export function listPersonas(): readonly string[] {
  return PERSONAS.map((p) => p.name);
}
