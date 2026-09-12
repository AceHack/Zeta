// src/Core.TypeScript/io/exclusive-lock.ts
//
// THE FOURTH OPERATION THIS TREE HAND-ROLLS: AN ADVISORY FILE LOCK.
//
// `safe-io.ts` was commissioned because fifty-one code-scanning alerts were
// forty authors independently writing the same three IO operations. This file
// is the fourth: two separate places in this tree grew a "lock file with stale
// recovery", both got the same detail wrong, and both were reported by CodeQL
// as `js/file-system-race` — `corporate/store-lock.ts` (alert #955) and
// `bus/claim.ts` (alert #811).
//
// ═══════════════════════════════════════════════════════════════════════════
// THE DEFECT, STATED EXACTLY — IT IS NOT THE SCANNER BEING FUSSY
// ═══════════════════════════════════════════════════════════════════════════
//
// Both implementations acquired correctly: `openSync(path, "wx")` is O_CREAT|
// O_EXCL, which is a genuine atomic test-and-set and mutually excludes. The
// break was in RECOVERY. Both handled a lock left behind by a crashed process
// this way:
//
//     open(path, "wx")            -> EEXIST
//     read(path)                  -> owner, judged DEAD
//     unlink(path)                -> "reclaim the stale lock"
//     open(path, "wx")            -> retry, now succeeds
//
// The third line deletes WHATEVER THE PATH NAMES AT THAT MOMENT, which is not
// necessarily the object the second line judged. Interleave two runs, A and B,
// against one stale lock:
//
//     A: open wx -> EEXIST        B: open wx -> EEXIST
//     A: read -> owner S (dead)   B: read -> owner S (dead)
//                                 B: unlink(S)
//                                 B: open wx -> CREATED, B HOLDS THE LOCK
//     A: unlink(path)             <- DELETES B'S LIVE LOCK
//     A: open wx -> CREATED, A HOLDS THE LOCK
//
// Both runs now believe they hold it. For `store-lock.ts` that is two runs
// interleaving one organization's record and both pushing; for `claim.ts` it is
// two agents claiming one backlog item. A check-then-create lock does not
// mutually exclude — the mutual exclusion it does have is destroyed by its own
// recovery path.
//
// The same shape bites RELEASE. `store-lock.ts` read the lock, compared the pid
// to its own, and then unlinked — so a run that was presumed dead and taken
// over could still delete its successor's lock, which is precisely what the
// read was written to prevent.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THE OBVIOUS FIXES DO NOT WORK, WRITTEN DOWN SO NOBODY RE-TRIES THEM
// ═══════════════════════════════════════════════════════════════════════════
//
// `claim.ts` had already tried the two natural narrowings and had honestly
// recorded that neither closes the window:
//
//   - read pid and mtime through ONE descriptor, so recovery cannot mix an old
//     holder with a new clock. Correct, and it fixes a real bug — but the
//     unlink still re-resolves the path.
//   - `statSync` the path again and compare dev+ino before unlinking. Narrows
//     the window; does not close it. There is no `funlinkat`: POSIX offers no
//     unlink conditioned on an inode, so a path-based unlink of an object you
//     did not create CANNOT be made race-free with the APIs Node exposes.
//
// That is the correct diagnosis, and it points at the fix: **stop unlinking
// objects you did not create.**
//
// ═══════════════════════════════════════════════════════════════════════════
// THE PROTOCOL: MONOTONIC GENERATIONS, AND NOBODY DELETES ANOTHER'S LOCK
// ═══════════════════════════════════════════════════════════════════════════
//
// One lock is a DIRECTORY. Inside it, a holder is a file named by an integer
// generation:
//
//     <lockRoot>/0.lock      { "pid": 4711, "startedAt": "2026-09-12T..." }
//     <lockRoot>/1.lock      the generation that took over from a dead 0
//
// Acquire:
//   1. `mkdir -p <lockRoot>`
//   2. `readdir` -> the highest generation g present (-1 when none)
//   3. read `<g>.lock` -> owner. If the owner is HELD (caller's predicate:
//      liveness, age floor), return busy. Never touch the file.
//   4. `open(<g+1>.lock, "wx")` -> exactly one process wins generation g+1.
//      EEXIST means someone else won it: rescan from 2. ENOENT means the
//      directory was removed by a releaser: rescan from 1.
//
// Release: unlink `<our own generation>.lock` and nothing else, then a
// best-effort `rmdir` of the now-empty directory.
//
// THE INVARIANT THAT MAKES IT SOUND: **every unlink in this protocol targets a
// name that exactly one process could ever have created** (`wx` guarantees it),
// and that process is the one doing the unlinking. There is no check-then-act
// on a shared path anywhere, because there is no act on a shared path at all —
// a stale generation is SUPERSEDED, never deleted, and superseding is a single
// atomic `O_EXCL` create.
//
// Re-run the interleaving above under this protocol:
//
//     A: readdir -> {0}, owner S dead    B: readdir -> {0}, owner S dead
//                                        B: open 1.lock wx -> CREATED, B holds
//     A: open 1.lock wx -> EEXIST        <- A LOSES, exactly as it should
//     A: rescan -> {0,1}, 1 is B, live -> busy
//
// Garbage collection is separated from correctness on purpose. The holder of
// generation N may unlink generations < N, and that is safe for a reason worth
// stating: while our N exists, `max(generations)` is >= N for every concurrent
// scanner, so removing lower entries can never make a scanner compute a smaller
// maximum, and a lower generation is never consulted for exclusion. GC is
// therefore unconditional — no check precedes it, so it reintroduces no
// check-then-act — and if it is skipped entirely nothing breaks. Crash-left
// generations are the only thing it removes.
//
// KNOWN LIMIT, STATED RATHER THAN IMPLIED: this is advisory and cooperative,
// and staleness is decided by the caller's predicate — typically `kill(pid, 0)`
// liveness, which cannot distinguish a recycled pid from the original process.
// The `startedAt` field is recorded so a caller that cares can discriminate.
// What this protocol removes is the FILESYSTEM race; it does not turn pid
// liveness into a perfect failure detector, and nothing can.

import { closeSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, rmdirSync, writeSync } from "node:fs";
import { join } from "node:path";

/** Who holds a lock. `startedAt` is an ISO-8601 instant recorded by the holder. */
export interface LockOwner {
  readonly pid: number;
  readonly startedAt: string;
}

/** The outcome of an acquisition attempt. `release` is idempotent. */
export type LockHold =
  | { readonly ok: true; readonly release: () => void; readonly generation: number; readonly tookOverFrom?: LockOwner }
  | { readonly ok: false; readonly heldBy?: LockOwner };

export interface ExclusiveLockOptions {
  /** The pid recorded as the owner. Injected so tests can record a pid other than their own. */
  readonly pid?: number;
  /** The instant recorded as the owner's start. Injected so tests need no clock. */
  readonly nowIso?: string;
  /**
   * Does this owner still hold the lock? Default: nothing holds it — callers are expected to
   * supply liveness. Returning `true` for an unreadable owner is impossible by construction: a
   * generation whose file cannot be parsed is treated as not-held and SUPERSEDED, never deleted,
   * so a corrupt lock file can never wedge a store.
   */
  readonly isHeld?: (owner: LockOwner) => boolean;
  /** How many times to rescan after losing a generation race. */
  readonly attempts?: number;
}

const GENERATION_FILE = /^(\d+)\.lock$/;

/** Ordinal, invariant parse of a generation file name. `-1` when the name is not one. */
export function generationOf(name: string): number {
  const m = GENERATION_FILE.exec(name);
  // NARROWED, NOT ASSERTED. `m[1]` is `string | undefined` to the type system even though the
  // pattern has one group, and `m[1]!` would be the same unchecked claim in shorter syntax. The
  // `undefined` branch is unreachable for this regex and costs one line to say so honestly.
  const digits = m === null ? undefined : m[1];
  if (digits === undefined) return -1;
  const n = Number.parseInt(digits, 10);
  return Number.isSafeInteger(n) && n >= 0 ? n : -1;
}

/** Every generation present, highest first. Missing directory reads as none. */
export function generations(lockRoot: string): number[] {
  let names: string[];
  try {
    names = readdirSync(lockRoot);
  } catch {
    return [];
  }
  const gens: number[] = [];
  for (const name of names) {
    const g = generationOf(name);
    if (g >= 0) gens.push(g);
  }
  gens.sort((a, b) => b - a);
  return gens;
}

/** The one place a generation number becomes a path. `String(n)`, never locale formatting. */
export function generationPath(lockRoot: string, generation: number): string {
  return join(lockRoot, `${String(generation)}.lock`);
}

/**
 * The highest generation in a scan, or `-1` for none.
 *
 * A fold rather than `gens[0]!`: indexing a possibly-empty array and then asserting the result
 * away is an unchecked claim, and the empty case is REAL here -- a lock directory that nobody has
 * ever taken is exactly the fresh-acquisition path. `-1` makes the first generation `0`.
 */
export function topGenerationOf(gens: readonly number[]): number {
  let top = -1;
  for (const g of gens) if (g > top) top = g;
  return top;
}

/** The owner recorded in one generation, or undefined when it is absent or unreadable. */
function ownerOf(lockRoot: string, generation: number): LockOwner | undefined {
  try {
    const raw: unknown = JSON.parse(readFileSync(generationPath(lockRoot, generation), "utf-8"));
    if (typeof raw !== "object" || raw === null) return undefined;
    const rec = raw as { pid?: unknown; startedAt?: unknown };
    if (typeof rec.pid !== "number" || !Number.isInteger(rec.pid)) return undefined;
    if (typeof rec.startedAt !== "string") return undefined;
    return { pid: rec.pid, startedAt: rec.startedAt };
  } catch {
    return undefined;
  }
}

/**
 * Who holds this lock right now, if anyone the predicate calls held does.
 * Reads only — never creates, never deletes, never judges by the caller's clock.
 */
export function currentHolder(lockRoot: string, isHeld: (owner: LockOwner) => boolean): LockOwner | undefined {
  for (const g of generations(lockRoot)) {
    const owner = ownerOf(lockRoot, g);
    // A generation with no readable owner is not a holder; keep walking down so an
    // unreadable top generation cannot hide a live one beneath it.
    if (owner !== undefined) return isHeld(owner) ? owner : undefined;
  }
  return undefined;
}

/** What one attempt at claiming a generation did. `retry` means another process got there first. */
export type ClaimOutcome = "claimed" | "retry";

/**
 * Claim ONE generation, atomically, or say to rescan.
 *
 * The single mutation that makes the protocol exclusive, kept alone in a function so it can be
 * read and tested without the surrounding loop. `wx` is `O_CREAT|O_EXCL`, so exactly one process
 * in any race creates this name; everyone else is told to rescan and will find the winner.
 *
 * EEXIST means another process won this generation. ENOENT means a releaser removed the lock
 * directory between our `mkdir` and now. Both are ordinary race outcomes and both say `retry`;
 * every other errno is a real failure and is rethrown.
 */
export function claimGeneration(lockRoot: string, generation: number, owner: LockOwner): ClaimOutcome {
  const path = generationPath(lockRoot, generation);
  let fd: number;
  try {
    fd = openSync(path, "wx", 0o600);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "ENOENT") return "retry";
    throw err;
  }
  try {
    writeSync(fd, JSON.stringify(owner));
  } catch (err) {
    closeSync(fd);
    // Our own generation, created by us, removed by us. No other process can be here.
    rmSync(path, { force: true });
    throw err;
  }
  closeSync(fd);
  return "claimed";
}

/**
 * Remove generations strictly below the one we hold.
 *
 * UNCONDITIONAL AND WITHOUT CORRECTNESS ROLE, which is why it is safe and why it introduces no
 * check-then-act: while our generation exists every concurrent scanner computes a maximum at
 * least as high, so removing anything below it cannot change an exclusion decision. Skipping it
 * entirely is also correct; it only reclaims files left by crashes.
 */
export function collectSuperseded(lockRoot: string, seen: readonly number[], mine: number): void {
  for (const g of seen) {
    if (g >= mine) continue;
    try {
      rmSync(generationPath(lockRoot, g), { force: true });
    } catch {
      /* leftovers are harmless; GC has no correctness role */
    }
  }
}

/**
 * The release for one held generation: idempotent, and it can reach nothing else.
 *
 * `wx` proved no other process created this name, so this unlink cannot touch a successor's lock
 * however long this run outlived its own takeover -- which is the defect the old single-file
 * release had.
 */
export function releaseGeneration(lockRoot: string, generation: number): () => void {
  const path = generationPath(lockRoot, generation);
  let released = false;
  return (): void => {
    if (released) return;
    released = true;
    rmSync(path, { force: true });
    try {
      rmdirSync(lockRoot);
    } catch {
      /* another holder's generation is in there, or it is already gone */
    }
  };
}

/** What one scan of the lock directory found. */
interface Scan {
  readonly seen: readonly number[];
  readonly top: number;
  readonly incumbent: LockOwner | undefined;
}

/** Read the directory once and report the top generation and whoever it names. */
function scan(lockRoot: string): Scan {
  // A regular file sitting at the lock's own name is a caller error, not a race — it throws.
  mkdirSync(lockRoot, { recursive: true });
  const seen = generations(lockRoot);
  const top = topGenerationOf(seen);
  return { seen, top, incumbent: top >= 0 ? ownerOf(lockRoot, top) : undefined };
}

/**
 * Take the lock, or say who has it.
 *
 * The whole protocol is in the module header. The shape to hold on to while reading: the only
 * mutations are `open(..., "wx")` of a generation nobody else can create (`claimGeneration`) and
 * `unlink` of a generation only this process created (`releaseGeneration`, `collectSuperseded`).
 */
export function takeExclusiveLock(lockRoot: string, options: ExclusiveLockOptions = {}): LockHold {
  const isHeld = options.isHeld ?? ((): boolean => false);
  const attempts = options.attempts ?? 8;
  const me: LockOwner = { pid: options.pid ?? process.pid, startedAt: options.nowIso ?? new Date().toISOString() };

  let lastSeen: LockOwner | undefined;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const { seen, top, incumbent } = scan(lockRoot);
    if (incumbent !== undefined) {
      lastSeen = incumbent;
      // Busy is reported WITHOUT touching the incumbent's file. That is the whole fix:
      // the losing path has no write in it at all.
      if (isHeld(incumbent)) return { ok: false, heldBy: incumbent };
    }

    const mine = top + 1;
    if (claimGeneration(lockRoot, mine, me) === "retry") continue;
    collectSuperseded(lockRoot, seen, mine);

    const release = releaseGeneration(lockRoot, mine);
    return incumbent !== undefined
      ? { ok: true, release, generation: mine, tookOverFrom: incumbent }
      : { ok: true, release, generation: mine };
  }

  return lastSeen !== undefined ? { ok: false, heldBy: lastSeen } : { ok: false };
}
