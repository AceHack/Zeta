// src/Core.TypeScript/io/exclusive-lock.test.ts
//
// THE FALSIFIERS FOR THE LOCK. A lock test that runs one acquirer at a time proves
// nothing about mutual exclusion — the defect these tests exist for is visible ONLY
// under a real race, so the central cases spawn N genuinely concurrent processes and
// count winners.
//
// MUTANT KILLS RECORDED IN THE PR. Each `MUTANT:` note names an edit to
// `exclusive-lock.ts` that must turn the test RED. A test that passes with and
// without the fix is not a falsifier.

import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claimGeneration,
  collectSuperseded,
  currentHolder,
  generationOf,
  generationPath,
  generations,
  releaseGeneration,
  takeExclusiveLock,
  topGenerationOf,
} from "./exclusive-lock.ts";

const MODULE = join(import.meta.dir, "exclusive-lock.ts");

/** Nothing is ever alive: every planted owner reads as stale. */
const never = (): boolean => false;
/** Everything is alive: a planted owner reads as a live holder. */
const always = (): boolean => true;

function scratch(name: string): string {
  return mkdtempSync(join(tmpdir(), `${name}-`));
}

/**
 * Plant a generation file directly, the way a crashed process leaves one behind.
 * Written through the same names the protocol uses so the test exercises the real layout.
 */
function plant(lockRoot: string, generation: number, owner: { pid: number; startedAt: string }): void {
  mkdirSync(lockRoot, { recursive: true });
  writeFileSync(join(lockRoot, `${String(generation)}.lock`), JSON.stringify(owner));
}

/** Ordinal comparison — no locale collation anywhere near a lock's identity. */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function generationNames(lockRoot: string): string[] {
  return readdirSync(lockRoot).sort(ordinal);
}

/** The owner recorded in one generation, typed rather than read off an `any`. */
function ownerIn(lockRoot: string, generation: number): { pid: number; startedAt: string } {
  return JSON.parse(readFileSync(generationPath(lockRoot, generation), "utf-8")) as {
    pid: number;
    startedAt: string;
  };
}

/**
 * Race `count` SEPARATE PROCESSES at one lock and report how many won.
 *
 * Separate processes, not promises: the defect under test is a filesystem interleaving
 * between two `open` calls, and a single-process test can never produce it — every
 * `openSync` in one process is serialised by that process's own execution.
 */
async function raceForLock(lockRoot: string, count: number, plantedStale: boolean): Promise<string[]> {
  const racer = join(scratch("lock-racer"), "racer.ts");
  writeFileSync(
    racer,
    [
      `import { takeExclusiveLock } from ${JSON.stringify(MODULE)};`,
      // A STARTING-GUN BARRIER, and it is load-bearing. Process startup is staggered by tens
      // of milliseconds, which is long enough for a winner to publish a LIVE pid before the
      // next racer even scans — so without a barrier every racer after the first loses for an
      // honest reason and the test passes even with O_EXCL removed. MEASURED: the `wx` -> `w`
      // mutant SURVIVED the unbarriered version of this test. All racers spin to one
      // wall-clock instant so the `open` calls actually interleave.
      `const startAt = Number(process.argv[3]);`,
      `while (Date.now() < startAt) { /* starting gun */ }`,
      // Liveness: the planted owner's pid is near the pid ceiling and never running, so it
      // reads stale; a real racer's pid is its own and reads live.
      `const isHeld = (o: { pid: number }): boolean => {`,
      `  try { process.kill(o.pid, 0); return true; } catch (e) {`,
      `    return (e as NodeJS.ErrnoException).code === "EPERM";`,
      `  }`,
      `};`,
      `const held = takeExclusiveLock(process.argv[2]!, { isHeld });`,
      // A winner HOLDS for a moment before releasing, so a second winner overlaps it in
      // time rather than following it. Without the hold the test could pass by serialising.
      `if (held.ok) {`,
      `  const until = Date.now() + 250;`,
      `  while (Date.now() < until) { /* hold the lock */ }`,
      `  process.stdout.write("WON " + String(held.generation) + "\\n");`,
      `  held.release();`,
      `} else {`,
      `  process.stdout.write("LOST\\n");`,
      `}`,
    ].join("\n"),
  );
  if (plantedStale) plant(lockRoot, 0, { pid: 2_147_000_001, startedAt: "2026-01-01T00:00:00.000Z" });

  // Enough head start for every child to boot and reach the barrier.
  const startAt = Date.now() + 3_000;
  const runs = Array.from({ length: count }, () =>
    new Promise<string>((resolve) => {
      const child = spawn(process.execPath, [racer, lockRoot, String(startAt)], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (b: Buffer) => { out += b.toString("utf-8"); });
      child.on("close", () => { resolve(out.trim()); });
    }));
  const results = await Promise.all(runs);
  return results.filter((r) => r.startsWith("WON"));
}

describe("exclusive-lock — the pieces the protocol is decomposed into", () => {
  // `takeExclusiveLock` was one function carrying the whole protocol and tripped the cognitive
  // complexity ceiling. The decomposition is only worth anything if the parts are reachable on
  // their own, so each one is pinned here rather than exercised solely through the loop.

  test("generationOf parses a generation name ordinally and rejects everything else", () => {
    // MUTANT: drop the `Number.isSafeInteger` guard. "99999999999999999999.lock" then parses to
    // a non-integer double and `topGenerationOf` starts handing out generations that collide.
    expect(generationOf("0.lock")).toBe(0);
    expect(generationOf("10.lock")).toBe(10);
    expect(generationOf("README")).toBe(-1);
    expect(generationOf("1.lock.bak")).toBe(-1);
    expect(generationOf("-1.lock")).toBe(-1);
    expect(generationOf("1e3.lock")).toBe(-1);
    expect(generationOf("99999999999999999999.lock")).toBe(-1);
  });

  test("topGenerationOf folds instead of indexing — an empty scan is -1, so the first claim is 0", () => {
    // The empty case is the fresh-acquisition path, not an impossible one. A `gens[0]!` here
    // would be an unchecked claim about the exact input this lock sees most often.
    expect(topGenerationOf([])).toBe(-1);
    expect(topGenerationOf([0])).toBe(0);
    expect(topGenerationOf([9, 10, 2])).toBe(10);
  });

  test("generationPath renders the number with String(), never locale formatting", () => {
    expect(generationPath("/lock", 10)).toBe(join("/lock", "10.lock"));
    expect(generationPath("/lock", 1_000_000)).toBe(join("/lock", "1000000.lock"));
  });

  test("generations ignores non-generation names and reads a missing directory as none", () => {
    const root = scratch("lock-scan");
    const lockRoot = join(root, "run.lock.d");
    try {
      expect(generations(lockRoot)).toEqual([]);
      plant(lockRoot, 2, { pid: 1, startedAt: "2026-09-12T00:00:00.000Z" });
      plant(lockRoot, 10, { pid: 1, startedAt: "2026-09-12T00:00:00.000Z" });
      writeFileSync(join(lockRoot, "README"), "not a generation");
      expect(generations(lockRoot)).toEqual([10, 2]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("claimGeneration claims once and says retry to everyone after — never twice", () => {
    // MUTANT: `openSync(path, "wx")` -> `"w"`. The second call then also reports "claimed" and
    // this assertion goes red, which is the single mutation the whole protocol rests on.
    const root = scratch("lock-claim");
    const lockRoot = join(root, "run.lock.d");
    try {
      mkdirSync(lockRoot, { recursive: true });
      const me = { pid: 4711, startedAt: "2026-09-12T00:00:00.000Z" };
      expect(claimGeneration(lockRoot, 0, me)).toBe("claimed");
      expect(claimGeneration(lockRoot, 0, { pid: 5813, startedAt: "2026-09-12T00:00:01.000Z" })).toBe("retry");
      // The loser wrote nothing: the claim still names the winner.
      expect(ownerIn(lockRoot, 0).pid).toBe(4711);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("claimGeneration says retry when the lock directory is gone, and does not create it", () => {
    const root = scratch("lock-enoent");
    try {
      const lockRoot = join(root, "never-made.d");
      expect(claimGeneration(lockRoot, 0, { pid: 4711, startedAt: "2026-09-12T00:00:00.000Z" })).toBe("retry");
      expect(generations(lockRoot)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("collectSuperseded removes strictly-lower generations and never our own or above", () => {
    const root = scratch("lock-gc");
    const lockRoot = join(root, "run.lock.d");
    try {
      for (const g of [0, 1, 2, 3]) plant(lockRoot, g, { pid: 1, startedAt: "2026-09-12T00:00:00.000Z" });
      collectSuperseded(lockRoot, [0, 1, 2, 3], 2);
      expect(generationNames(lockRoot)).toEqual(["2.lock", "3.lock"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("releaseGeneration is idempotent, removes only its own generation, and rmdirs only when empty", () => {
    const root = scratch("lock-rel");
    const lockRoot = join(root, "run.lock.d");
    try {
      plant(lockRoot, 0, { pid: 4711, startedAt: "2026-09-12T00:00:00.000Z" });
      plant(lockRoot, 1, { pid: 5813, startedAt: "2026-09-12T00:00:01.000Z" });
      const release = releaseGeneration(lockRoot, 0);
      release();
      release(); // second call must be a no-op, not a theft
      expect(generationNames(lockRoot)).toEqual(["1.lock"]);
      releaseGeneration(lockRoot, 1)();
      expect(generations(lockRoot)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("exclusive-lock — mutual exclusion under a real race", () => {
  test("EIGHT concurrent processes on a fresh lock: exactly one wins", async () => {
    // MUTANT: change `openSync(minePath, "wx", 0o600)` to `openSync(minePath, "w", 0o600)`.
    // Without O_EXCL every racer "wins" and this assertion reports 8.
    const root = scratch("lock-fresh");
    try {
      const winners = await raceForLock(join(root, "run.lock.d"), 8, false);
      expect(winners).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("EIGHT concurrent processes TAKING OVER one stale lock: exactly one wins", async () => {
    // THIS IS ALERT #955 / #811 REPRODUCED. Under the old check-then-unlink recovery
    // (`read the holder` -> judge stale -> `unlink(path)` -> `open(path,"wx")`) two racers
    // both read the same dead owner, the second unlink deletes the FIRST racer's freshly
    // created live lock, and both end up holding. Here takeover is a single `O_EXCL` create
    // of generation 1, so the losers can only lose.
    //
    // MUTANT: in the EEXIST branch of `takeExclusiveLock`, replace `continue` with
    // `rmSync(minePath, { force: true })` before retrying — i.e. reinstate "delete whatever
    // the path names and try again". Winners go above 1.
    const root = scratch("lock-stale");
    try {
      const winners = await raceForLock(join(root, "run.lock.d"), 8, true);
      expect(winners).toHaveLength(1);
      // The winner took over at generation 1: generation 0 is the planted stale owner.
      expect(winners[0]).toBe("WON 1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("exclusive-lock — nobody deletes a lock they did not create", () => {
  test("a busy acquisition leaves the incumbent's file byte-identical", () => {
    // MUTANT: add `rmSync(join(lockRoot, `${top}.lock`), { force: true })` to the busy branch.
    // The read below throws ENOENT and the test goes red.
    const root = scratch("lock-busy");
    const lockRoot = join(root, "run.lock.d");
    try {
      plant(lockRoot, 0, { pid: 4711, startedAt: "2026-09-12T00:00:00.000Z" });
      const before = readFileSync(join(lockRoot, "0.lock"), "utf-8");
      const got = takeExclusiveLock(lockRoot, { isHeld: always, pid: 99, nowIso: "2026-09-12T00:00:01.000Z" });
      expect(got.ok).toBe(false);
      if (!got.ok) expect(got.heldBy?.pid).toBe(4711);
      expect(readFileSync(join(lockRoot, "0.lock"), "utf-8")).toBe(before);
      expect(generationNames(lockRoot)).toEqual(["0.lock"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("release removes ONLY our own generation — a successor's lock survives it", () => {
    // The original defect in `store-lock.ts`: release read the lock, compared the pid, and
    // then unlinked the PATH. A takeover landing between the read and the unlink meant the
    // outlived run deleted its successor's lock — exactly what the read was written to stop.
    //
    // MUTANT: change `release` to `rmSync(join(lockRoot, `${generations(lockRoot)[0]}.lock`),
    // { force: true })` (delete the current top generation instead of our own). Red.
    const root = scratch("lock-release");
    const lockRoot = join(root, "run.lock.d");
    try {
      const mine = takeExclusiveLock(lockRoot, { isHeld: never, pid: 4711, nowIso: "2026-09-12T00:00:00.000Z" });
      expect(mine.ok).toBe(true);
      if (!mine.ok) return;
      expect(mine.generation).toBe(0);
      // A successor took over after this run was presumed dead.
      plant(lockRoot, 1, { pid: 5813, startedAt: "2026-09-12T00:00:05.000Z" });
      mine.release();
      expect(generationNames(lockRoot)).toEqual(["1.lock"]);
      expect(ownerIn(lockRoot, 1).pid).toBe(5813);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("release is idempotent and does not reach a lock taken at the same generation later", () => {
    const root = scratch("lock-idem");
    const lockRoot = join(root, "run.lock.d");
    try {
      const mine = takeExclusiveLock(lockRoot, { isHeld: never, pid: 4711, nowIso: "2026-09-12T00:00:00.000Z" });
      expect(mine.ok).toBe(true);
      if (!mine.ok) return;
      mine.release();
      const next = takeExclusiveLock(lockRoot, { isHeld: never, pid: 5813, nowIso: "2026-09-12T00:00:02.000Z" });
      expect(next.ok).toBe(true);
      mine.release(); // second call: must be a no-op, not a theft
      expect(currentHolder(lockRoot, always)?.pid).toBe(5813);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("exclusive-lock — takeover, corruption, and reporting", () => {
  test("a stale generation is SUPERSEDED, never deleted before the successor exists", () => {
    const root = scratch("lock-supersede");
    const lockRoot = join(root, "run.lock.d");
    try {
      plant(lockRoot, 0, { pid: 2_147_000_001, startedAt: "2026-09-12T00:00:00.000Z" });
      const mine = takeExclusiveLock(lockRoot, { isHeld: never, pid: 4711, nowIso: "2026-09-12T00:00:09.000Z" });
      expect(mine.ok).toBe(true);
      if (!mine.ok) return;
      expect(mine.generation).toBe(1);
      expect(mine.tookOverFrom?.pid).toBe(2_147_000_001);
      // GC is allowed to clear the superseded generation AFTER ours exists, never before.
      expect(generationNames(lockRoot)).toEqual(["1.lock"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a CORRUPT lock file is superseded rather than obeyed or deleted-then-recreated", () => {
    // A lock nobody can parse used to be `rmSync`-ed, which is the same unconditional
    // delete as the stale path. Superseding it needs no delete at all.
    const root = scratch("lock-corrupt");
    const lockRoot = join(root, "run.lock.d");
    try {
      mkdirSync(lockRoot, { recursive: true });
      writeFileSync(join(lockRoot, "0.lock"), "{ not json");
      const mine = takeExclusiveLock(lockRoot, { isHeld: always, pid: 4711, nowIso: "2026-09-12T00:00:00.000Z" });
      expect(mine.ok).toBe(true);
      if (mine.ok) expect(mine.generation).toBe(1);
      expect(currentHolder(lockRoot, always)?.pid).toBe(4711);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("currentHolder reports a live holder and reports nobody for a stale one", () => {
    const root = scratch("lock-holder");
    const lockRoot = join(root, "run.lock.d");
    try {
      plant(lockRoot, 0, { pid: 4711, startedAt: "2026-09-12T00:00:00.000Z" });
      expect(currentHolder(lockRoot, always)?.pid).toBe(4711);
      expect(currentHolder(lockRoot, never)).toBeUndefined();
      expect(currentHolder(join(root, "absent.d"), always)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a generation-shaped name is parsed ordinally; a non-generation name is ignored", () => {
    const root = scratch("lock-names");
    const lockRoot = join(root, "run.lock.d");
    try {
      plant(lockRoot, 9, { pid: 4711, startedAt: "2026-09-12T00:00:00.000Z" });
      // Not a generation: must not be read as one, and must not be deleted by GC either.
      writeFileSync(join(lockRoot, "README"), "not a generation");
      // 10 > 9 numerically but "10" < "9" lexicographically — the sort must be ordinal on the
      // parsed integer, or a takeover would pick generation 10 and collide with an existing one.
      const mine = takeExclusiveLock(lockRoot, { isHeld: never, pid: 5813, nowIso: "2026-09-12T00:00:01.000Z" });
      expect(mine.ok).toBe(true);
      if (mine.ok) expect(mine.generation).toBe(10);
      expect(generationNames(lockRoot)).toEqual(["10.lock", "README"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
