// harness.ts — shared Claude Code hooks harness for Otto-discipline hooks
//
// Exports common types and utilities used by all discipline hook scripts
// under .claude/hooks/. Import this module; do NOT wire it into
// .claude/settings.json directly — only concrete hook scripts are wired.
//
// Hook contract (Anthropic Claude Code hooks API):
//   - Hook script reads stdin JSON (the tool call payload).
//   - To ALLOW: exit 0 with no stdout output (default path).
//   - To DENY:  print the hookDecision JSON to stdout, then exit 0.
//   - Exit codes other than 0 are treated as errors, not denials.
//
// Per 081KR50HA0008QG0R002B3N54S (PR atomic child of 081KQ3HBZ0008QG0R0008RYCSX).

export type HookEventName = "PreToolUse" | "PostToolUse";

/** Raw Claude Code hook input payload (stdin JSON). */
export interface HookInput {
  readonly tool_name?: string;
  readonly tool_input?: Record<string, unknown>;
}

/** JSON output for a deny decision (the only case that requires stdout). */
export interface HookDecision {
  readonly hookSpecificOutput: {
    readonly hookEventName: HookEventName;
    readonly permissionDecision: "allow" | "deny";
    readonly permissionDecisionReason?: string;
  };
}

/** Read and parse the hook input from stdin. Returns {} on parse failure. */
export function readHookInput(): HookInput {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require("fs").readFileSync(0, "utf8") as string;
    return JSON.parse(raw) as HookInput;
  } catch {
    return {};
  }
}

/**
 * Emit a deny decision and exit 0.
 * The hook infrastructure reads the JSON from stdout; exit 0 is required
 * even for denials — a non-zero exit is treated as a hook error, not a deny.
 */
export function deny(event: HookEventName, reason: string): never {
  const decision: HookDecision = {
    hookSpecificOutput: {
      hookEventName: event,
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(decision) + "\n");
  process.exit(0);
}

/** Allow the tool call. Exit 0 with no stdout output (default path). */
export function allow(): never {
  process.exit(0);
}
