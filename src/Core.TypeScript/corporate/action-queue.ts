/**
 * action-queue.ts — where a person's requests wait for the organization to read them.
 *
 * One file per action, in a directory. Deliberately the dullest possible transport, for the same
 * reason `directoryIntake` is: a queue that needs a running service to accept work cannot accept
 * work while that service is down, and the thing most likely to be down is the thing you are trying
 * to talk to.
 *
 * ── WHY A QUEUE AND NOT A CALL ──────────────────────────────────────────────
 * The dashboard writes here; the run reads here. Neither reaches into the other. So the observer
 * keeps the property that made it trustworthy — it cannot change the organization — while a person
 * still gets to say something. What they say is a REQUEST, recorded, that the organization will
 * consider on its own terms. A dashboard that could reach into a running cycle would be a second
 * writer racing the first, and the first one has no idea it is in a race.
 *
 * Ordering is by the action's own `atMs`, never by filename or write order, so a queue read halfway
 * through a write still replays in the order the person acted.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { acceptAction, type HumanAction } from "./human-action";

/** A filename that cannot escape the queue directory, derived from the id. */
function fileFor(actionId: string): string {
  return `${actionId.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120)}.json`;
}

/**
 * Write one action. Returns the path.
 *
 * IDEMPOTENT BY ID: the same action written twice occupies the same file, so a UI that retries a
 * request does not enqueue the instruction twice. An operator clicking "approve" during a flaky
 * connection must not approve twice.
 */
export function appendAction(action: HumanAction, dir: string): string {
  mkdirSync(dir, { recursive: true });
  const at = join(dir, fileFor(action.actionId));
  writeFileSync(at, JSON.stringify(action, null, 2), "utf-8");
  return at;
}

/**
 * Every action in the queue, oldest first.
 *
 * A file that will not parse, or that fails validation, is SKIPPED rather than throwing: one
 * malformed action must not make the rest of the queue unreadable — that would turn a bad request
 * into an outage. It is skipped silently only in the sense that it does not appear; `queueProblems`
 * reports it, because a request that vanished with no trace is worse than one that was refused.
 */
export function readActions(dir: string): readonly HumanAction[] {
  let names: readonly string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out: HumanAction[] = [];
  for (const name of [...names].sort()) {
    if (!name.endsWith(".json")) continue;
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, name), "utf-8"));
      const verdict = acceptAction(parsed);
      if (verdict.ok) out.push(verdict.action);
    } catch {
      continue;
    }
  }
  return out.sort((a, b) => (a.atMs === b.atMs ? (a.actionId < b.actionId ? -1 : 1) : a.atMs - b.atMs));
}

/** Files in the queue that are NOT readable actions, with the reason. Never silently dropped. */
export function queueProblems(dir: string): readonly { readonly file: string; readonly reason: string }[] {
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
      const verdict = acceptAction(parsed);
      if (!verdict.ok) out.push({ file: name, reason: verdict.reason });
    } catch (err) {
      out.push({ file: name, reason: `unreadable: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
  return out;
}
