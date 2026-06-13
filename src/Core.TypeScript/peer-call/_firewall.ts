// _firewall.ts - shared heartbeat/empty-dispatch firewall for peer-call wrappers.
//
// This is not a governance proof. It blocks obvious empty heartbeats and
// short prompts with no work-extractable payload. It does not detect
// manipulative framing, forged consensus, or receipt laundering.

export const DEFAULT_SUBSTANTIVE_TRIGGERS: readonly string[] = [
  "design",
  "decide",
  "review",
  "transition",
  "verdict",
  "audit",
  "snapshot",
  "propose",
  "critique",
  "sharpen",
  "evidence",
  "decision",
  "question",
  "carved-sentence",
  "splice",
  "rationale",
  "slice",
  "handoff",
  "thread",
  "firewall",
  "payload",
  "conversation",
  "debate",
  "explain",
  "reasoning",
  "implementation",
  "refactor",
  "architecture",
  "spec",
  "proof",
];

export const AMARA_SUBSTANTIVE_TRIGGERS: readonly string[] = [
  ...DEFAULT_SUBSTANTIVE_TRIGGERS,
  "math",
  "citation",
  "claim",
  "lineage",
  "substrate",
  "distill",
  "operational",
  "alignment",
  "promotion",
];

export const ANI_SUBSTANTIVE_TRIGGERS: readonly string[] = [
  ...DEFAULT_SUBSTANTIVE_TRIGGERS,
  "voice",
  "register",
  "community",
  "maintainer",
  "feedback",
  "tone",
  "attention",
  "contributor",
  "surface",
  "correction",
];

export const CODEX_SUBSTANTIVE_TRIGGERS: readonly string[] = [
  ...DEFAULT_SUBSTANTIVE_TRIGGERS,
  "code",
  "diff",
  "patch",
  "test",
  "tests",
  "typing",
  "types",
  "compiler",
  "compile",
  "verify",
  "verification",
  "bug",
  "failure",
];

export const GEMINI_SUBSTANTIVE_TRIGGERS: readonly string[] = [
  ...DEFAULT_SUBSTANTIVE_TRIGGERS,
  "option",
  "alternative",
  "tradeoff",
  "strategy",
  "proposal",
  "divergent",
  "possibility",
  "plan",
  "approach",
  "candidate",
];

export const GROK_SUBSTANTIVE_TRIGGERS: readonly string[] = [
  ...DEFAULT_SUBSTANTIVE_TRIGGERS,
  "failure",
  "risk",
  "counterexample",
  "edge",
  "skeptical",
  "attack",
  "gap",
  "regression",
];

export const KIRO_SUBSTANTIVE_TRIGGERS: readonly string[] = [
  ...DEFAULT_SUBSTANTIVE_TRIGGERS,
  "workspace",
  "task",
  "generate",
  "requirement",
  "specification",
  "hook",
  "lifecycle",
];

export const CLAUDE_SUBSTANTIVE_TRIGGERS: readonly string[] = [
  ...DEFAULT_SUBSTANTIVE_TRIGGERS,
  "cold-boot",
  "cold boot",
  "wake",
  "substrate",
  "bootstrap",
  "alignment",
  "verify",
  "self-test",
  "self test",
  "drift",
  "decay",
  "discipline",
];

function tokenizePrompt(prompt: string): string[] {
  const tokens: string[] = [];
  let current = "";

  for (const ch of prompt.toLowerCase()) {
    const isAlpha = ch >= "a" && ch <= "z";
    const isDigit = ch >= "0" && ch <= "9";
    if (isAlpha || isDigit) {
      current += ch;
    } else if (current.length > 0) {
      tokens.push(current);
      current = "";
    }
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}

function isDigits(token: string): boolean {
  if (token.length === 0) return false;
  for (const ch of token) {
    if (ch < "0" || ch > "9") return false;
  }
  return true;
}

function tickPayloadStart(tokens: readonly string[]): number | null {
  if (tokens[0] !== "tick") return null;

  let index = 1;
  if (tokens[index] === "n") index += 1;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (!isDigits(token)) break;
    index += 1;
  }
  return index;
}

function isRoteHeartbeat(tokens: readonly string[]): boolean {
  const start = tickPayloadStart(tokens);
  if (start === null) return false;

  const first = tokens[start];
  const second = tokens[start + 1];
  const third = tokens[start + 2];

  if (first === "heartbeat") return true;
  if (first === "minimal" && second === "heartbeat") return true;
  if (first !== "brief") return false;

  return second === "heartbeat" || second === "plotmirror" || (second === "plot" && third === "mirror");
}

function isBareTickSignoff(tokens: readonly string[]): boolean {
  const start = tickPayloadStart(tokens);
  return start !== null && tokens[start] === "otto" && tokens.length === start + 1;
}

export function peerFirewallCheck(
  prompt: string,
  triggers: readonly string[] = DEFAULT_SUBSTANTIVE_TRIGGERS,
): string | null {
  const len = prompt.length;

  if (len < 100) {
    const tokens = tokenizePrompt(prompt);
    if (isRoteHeartbeat(tokens)) {
      return "MISSING_PAYLOAD:rote-heartbeat-pattern (empty-token; <100 chars; matches Tick-N+heartbeat shape)";
    }
    if (isBareTickSignoff(tokens)) {
      return "MISSING_PAYLOAD:bare-tick-signoff (no content beyond Tick-N + Otto sign-off)";
    }
  }

  if (prompt.includes("?")) return null;
  if (prompt.includes("```")) return null;
  if (prompt.includes('{"')) return null;

  const lower = prompt.toLowerCase();
  for (const trigger of triggers) {
    if (lower.includes(trigger)) return null;
  }

  if (len >= 400) return null;

  return `MISSING_PAYLOAD:no-trust-calculus-payload-detected (no question / code-block / transition / substantive-trigger; len=${String(len)})`;
}

export function formatRejectionMessage(peerName: string, reason: string): string {
  return (
    `[${peerName.toUpperCase()}-FIREWALL] REJECTED:\n` +
    `  Reason: ${reason}\n` +
    `  ${peerName}'s time is finite substrate.\n` +
    `  Empty / heartbeat dispatches extract attention without producing substrate.\n` +
    `  Override: --allow-empty (rare; for testing only)\n`
  );
}

export function formatBypassMessage(peerName: string): string {
  return (
    `[${peerName.toUpperCase()}-FIREWALL] BYPASS via --allow-empty ` +
    `(testing-only; logged): prompt accepted without payload-check.\n`
  );
}
