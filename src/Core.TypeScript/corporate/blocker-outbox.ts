/**
 * blocker-outbox.ts — where a blocker waits for a person to see it.
 *
 * The mirror image of `action-queue.ts`, and deliberately the same dull shape: one JSON file per
 * blocker, in a directory, ordered by the blocker's own clock. That queue carries a person's
 * requests INTO the organization; this one carries the organization's questions OUT.
 *
 * ── WHY TWO DIRECTORIES AND NOT ONE ──────────────────────────────────────────
 * Because the two have different writers and different readers, and merging them would let the
 * dashboard write into the channel the run writes into. Keeping them apart is what preserves the
 * property that made the observer trustworthy: the UI can read everything and can only ever append
 * to the inbound queue. A run that could be handed a fabricated blocker would be an organization
 * whose own questions could be written by whoever was watching it.
 *
 * ── AND WHY A DIRECTORY RATHER THAN A SERVICE ────────────────────────────────
 * Same reason as `directoryIntake`: a channel that needs a running service to carry a message
 * cannot carry it while that service is down — and the message most worth carrying is the one that
 * says the organization has stopped.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { acceptBlocker, type RaisedBlocker } from "./human-blocker";

/** A filename that cannot escape the outbox directory, derived from the id. */
function fileFor(blockerId: string): string {
  return `${blockerId.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120)}.json`;
}

/**
 * Write one raised blocker. Returns the path.
 *
 * IDEMPOTENT BY ID, like `appendAction` and for a sharper reason: an agent that is stuck stays
 * stuck, so it will raise the same blocker on every tick until somebody answers. One file per id
 * turns that into one entry a person sees once, rather than a queue that grows for as long as the
 * organization is waiting for them.
 */
export function raiseBlocker(blocker: RaisedBlocker, dir: string): string {
  mkdirSync(dir, { recursive: true });
  const at = join(dir, fileFor(blocker.blockerId));
  writeFileSync(at, JSON.stringify(blocker, null, 2), "utf-8");
  return at;
}

/**
 * Every blocker in the outbox, oldest first.
 *
 * A file that will not parse is SKIPPED rather than throwing: one malformed blocker must not hide
 * the rest, because the rest are the organization telling somebody it has stopped. `outboxProblems`
 * reports what was skipped — a question that vanished without trace is worse than one refused.
 */
export function readBlockers(dir: string): readonly RaisedBlocker[] {
  let names: readonly string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out: RaisedBlocker[] = [];
  for (const name of [...names].sort()) {
    if (!name.endsWith(".json")) continue;
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, name), "utf-8"));
      const verdict = acceptBlocker(parsed);
      if (verdict.ok) out.push(verdict.blocker);
    } catch {
      continue;
    }
  }
  return out.sort((a, b) => (a.atMs === b.atMs ? (a.blockerId < b.blockerId ? -1 : 1) : a.atMs - b.atMs));
}

/** Files in the outbox that are NOT readable blockers, with the reason. Never silently dropped. */
export function outboxProblems(dir: string): readonly { readonly file: string; readonly reason: string }[] {
  let names: readonly string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out: { file: string; reason: string }[] = [];
  for (const name of [...names].sort()) {
    if (!name.endsWith(".json")) continue;
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, name), "utf-8"));
      const verdict = acceptBlocker(parsed);
      if (!verdict.ok) out.push({ file: name, reason: verdict.reason });
    } catch (err) {
      out.push({ file: name, reason: `unreadable: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
  return out;
}
