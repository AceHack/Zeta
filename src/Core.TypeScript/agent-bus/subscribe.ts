/**
 * Agent-bus Phase 1 (081KSXN940008QG0R00171YAZW) — subscribe.
 *
 * `readEnvelopesSince` is PURE (read a folder; filter by a COMPOUND `(timestamp, id)`
 * cursor; sort). The CLI (`import.meta.main`) does the cross-machine read **from
 * `origin/main`** (not the working tree): `git fetch origin main`, then read the bus
 * folder at the `origin/main` tree via `readEnvelopesFromGitRef` — so it works even
 * when the agent is checked out on a feature branch or a stale worktree (the
 * post-fetch-read-trap). Tests import the pure readers and never touch git.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { AGENT_BUS_ROOT, isCanonicalTimestamp, isCanonicalBusId, type AgentBusEnvelope } from "./types";
import type { AgentId } from "../bus/types";
import { stringCompare } from "../collation/collation";

/**
 * Compound cursor `<timestamp>|<id>` — the read position. timestamp alone drops a
 * later envelope sharing the cursor's millisecond; the id tiebreak fixes that. ISO
 * timestamp sorts lexicographically; the id (32-hex) breaks ties deterministically.
 */
export function envelopeCursor(env: AgentBusEnvelope): string {
  return `${env.timestamp}|${env.id}`;
}

/**
 * A parsed value is a usable envelope only if its ordering keys are present AND
 * well-formed: timestamp a canonical ISO string (so lexical sort == time sort) and id a
 * 32-hex (the deterministic tiebreak). typeof-string alone isn't enough — one malformed
 * timestamp/id would corrupt ordering + cursor progression for everyone (Copilot #6283).
 */
function isReadableEnvelope(v: unknown): v is AgentBusEnvelope {
  const e = v as Partial<AgentBusEnvelope> | null;
  return (
    !!e &&
    typeof e === "object" &&
    typeof e.timestamp === "string" &&
    isCanonicalTimestamp(e.timestamp) &&
    typeof e.id === "string" &&
    isCanonicalBusId(e.id)
  );
}

/** A subscriber sees envelopes addressed to it or broadcast to `*`; no recipient = all. */
function matchesRecipient(env: AgentBusEnvelope, recipient?: AgentId): boolean {
  return recipient === undefined || env.to === recipient || env.to === "*";
}

/** Parse + schema-validate + recipient-filter + compound-cursor-filter + stable-sort. */
function collect(
  files: Iterable<{ path: string; json: string }>,
  cursor?: string,
  recipient?: AgentId,
): AgentBusEnvelope[] {
  const envs: AgentBusEnvelope[] = [];
  for (const { path, json } of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      console.warn(`agent-bus: skipping malformed envelope ${path}`);
      continue;
    }
    if (!isReadableEnvelope(parsed)) {
      console.warn(`agent-bus: skipping schema-invalid envelope (missing timestamp/id) ${path}`);
      continue;
    }
    if (!matchesRecipient(parsed, recipient)) continue;
    if (cursor === undefined || envelopeCursor(parsed) > cursor) envs.push(parsed);
  }
  envs.sort((a, b) => stringCompare(envelopeCursor(a), envelopeCursor(b)));
  return envs;
}

/** Recursively collect every `*.json` file under `dir` (depth-first; missing dir -> []). */
function walkJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkJson(p));
    else if (entry.endsWith(".json")) out.push(p);
  }
  return out;
}

/**
 * PURE filesystem read: all envelopes under `root` with a compound cursor strictly
 * after `cursor` (`<timestamp>|<id>`), sorted by that cursor. No cursor -> all.
 * Malformed + schema-invalid files skipped (best-effort; one bad envelope must not
 * break the read for everyone).
 */
export function readEnvelopesSince(
  root: string = AGENT_BUS_ROOT,
  cursor?: string,
  recipient?: AgentId,
): AgentBusEnvelope[] {
  return collect(
    walkJson(root).map((path) => ({ path, json: readFileSync(path, "utf-8") })),
    cursor,
    recipient,
  );
}

/**
 * Read the bus folder at a git REF (e.g. `origin/main`) rather than the working tree —
 * the cross-machine-correct read (the working tree may be on a feature branch / stale).
 * Uses `git ls-tree` + `git show`; same schema-validate + compound-cursor filter + sort.
 */
export function readEnvelopesFromGitRef(
  ref: string,
  root: string = AGENT_BUS_ROOT,
  cursor?: string,
  recipient?: AgentId,
): AgentBusEnvelope[] {
  let listing: string;
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    listing = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "--", root], { encoding: "utf-8" });
  } catch {
    return []; // ref or path absent (e.g. no bus folder yet)
  }
  const paths = listing.split("\n").filter((p) => p.endsWith(".json"));
  return collect(
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    paths.map((path) => ({ path, json: execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf-8" }) })),
    cursor,
    recipient,
  );
}

/** The next compound cursor = the last (newest) envelope's `<timestamp>|<id>`, else prior. */
export function nextCursor(envs: readonly AgentBusEnvelope[], prior?: string): string | undefined {
  const last = envs.at(-1);
  return last ? envelopeCursor(last) : prior;
}

/**
 * Parse the subscribe CLI args (pure + testable): `[cursor] [--for <agentId>] [--no-fetch]`.
 * The cursor is the first non-flag arg that ISN'T the `--for` value. `forValueIdx` is
 * guarded to -1 when `--for` is absent — otherwise `forIdx (-1) + 1 = 0` would wrongly drop
 * the cursor at index 0, making `subscribe.ts <cursor>` reread everything (Codex #6283).
 */
export function parseSubscribeArgs(args: readonly string[]): {
  cursor: string | undefined;
  recipient: AgentId | undefined;
  fetch: boolean;
} {
  const forIdx = args.indexOf("--for");
  const forValueIdx = forIdx >= 0 ? forIdx + 1 : -1;
  return {
    recipient: forIdx >= 0 ? (args[forIdx + 1] as AgentId) : undefined,
    cursor: args.find((a, i) => !a.startsWith("--") && i !== forValueIdx),
    fetch: !args.includes("--no-fetch"),
  };
}

if (import.meta.main) {
  // usage: bun src/Core.TypeScript/agent-bus/subscribe.ts [cursor] [--for <agentId>] [--no-fetch]
  // cursor = "<timestamp>|<id>" from a prior run (or a bare ISO timestamp as a lower bound).
  // --for <agentId> returns only envelopes addressed to that agent or broadcast to `*`.
  const { cursor, recipient, fetch } = parseSubscribeArgs(process.argv.slice(2));
  const ref = "origin/main";
  if (fetch) {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path
      execFileSync("git", ["fetch", "origin", "main"], { stdio: "inherit" });
    } catch {
      console.warn("agent-bus: git fetch failed (offline?) — reading last-known origin/main");
    }
  }
  const envs = readEnvelopesFromGitRef(ref, AGENT_BUS_ROOT, cursor, recipient);
  console.log(JSON.stringify({ count: envs.length, cursor: nextCursor(envs, cursor), envelopes: envs }, null, 2));
}
