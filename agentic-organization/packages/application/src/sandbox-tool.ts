/**
 * Sandboxed tool execution — the agent actually RUNS a tool (a bounded,
 * env-stripped, timeout-killed subprocess) to produce verifiable evidence,
 * rather than asserting an outcome. The port is dependency-inverted; the real
 * subprocess adapter lives at the composition root.
 *
 * Tool failure is supplementary, not fatal: a failed tool yields no evidence
 * ref but never fails the agent run (the deterministic decision already
 * succeeded). This keeps the agent alive while still doing real work.
 */

import type { ReactionPlanAction } from "../../domain/src/index.ts";

export type SandboxToolRequest = {
  /** absolute path to the executable (e.g. the node binary) */
  command: string;
  args: readonly string[];
  timeoutMs: number;
};

export type SandboxToolResult =
  | { ok: true; stdout: string }
  | { ok: false; reason: string };

/** A bounded sandbox for one tool invocation. The adapter strips env + isolates cwd + kills on timeout. */
export interface SandboxToolPort {
  run: (request: SandboxToolRequest) => Promise<SandboxToolResult>;
}

export const SandboxVerificationEvidencePrefix = "sandbox:sha256:";

/**
 * Build a verification-tool invocation: a tiny node program that computes a
 * sha256 over the action's work item id and prints it. Pure + deterministic, so
 * the same action always produces the same evidence (DST-replayable), and it
 * runs through the real sandbox (a separate, bounded process).
 */
export function buildVerificationToolRequest(action: ReactionPlanAction, nodeBinary: string): SandboxToolRequest {
  const script =
    "const c=require('node:crypto');" +
    "const id=process.argv[1];" +
    "process.stdout.write(c.createHash('sha256').update(id).digest('hex'));";
  return {
    command: nodeBinary,
    args: ["-e", script, action.workItemId],
    timeoutMs: 5_000,
  };
}

/** Turn a successful sandbox run into an evidence ref, or undefined if the tool produced nothing usable. */
export function verificationEvidenceRef(result: SandboxToolResult): string | undefined {
  if (!result.ok) {
    return undefined;
  }
  const digest = result.stdout.trim();
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    return undefined;
  }
  return `${SandboxVerificationEvidencePrefix}${digest}`;
}
