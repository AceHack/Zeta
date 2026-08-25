// sync-prior-art.test.ts — falsifiers for the properties the port exists to hold.
//
// ┌─ ABSOLUTE SAFETY (sandbox-only) ─────────────────────────────────────────────────────────────┐
// │ NOTHING here opens a socket, clones a repository, or touches the real                        │
// │ `references/prior-art/` tree. Every git invocation and every filesystem act goes through an  │
// │ injected FAKE `SyncEffects`. A test that would reach the network is a FAIL.                  │
// │ The one real-filesystem read is `references/reference-sources.json`, which is a checked-in   │
// │ text file, and it is read to prove the SHIPPED manifest satisfies the containment rule.      │
// └───────────────────────────────────────────────────────────────────────────────────────────────┘
//
// WHY THESE ARE THE TESTS
// ------------------------------------------------------------------------------------------
// The `.sh` this replaces asserted its safety in a header comment. A comment cannot fail. The
// three properties that actually matter here are therefore checks:
//
//   1. CONTAINMENT — no manifest row can address a path outside `references/prior-art/`, so the
//      mirrors can never become committable. `..`, absolute paths, and the root itself included.
//   2. A FAILURE NEVER EXITS 0 — one unreachable source out of N must redden the run and be
//      named, and must not print like a clean sync.
//   3. DoP IS A THROUGHPUT DIAL, NOT A SEMANTICS DIAL — the report and exit code are identical
//      at --jobs 1, 4 and 16.
//
// Each block below states what defect it discriminates against, because a test that passes on
// both the correct and the broken implementation is not a falsifier.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// NO WALL-CLOCK DELAYS. `yieldTurns(n)` grants exactly n macrotask turns via ZERO-delay
// timers, so the turn count is fixed regardless of machine load. A non-zero timer delay here
// would encode a guess about speed and make these verdicts depend on how busy the runner is —
// which is what `hygiene:no-ambient-time-in-tests` exists to refuse. It caught this file: the
// first version of the three DoP tests below used millisecond sleeps, and CI was right.
import { yieldTurns } from "../../../src/Core.TypeScript/testing/deterministic-async.ts";

import {
  EXIT_CONFIG,
  EXIT_FAILED,
  EXIT_OK,
  MANIFEST_PATH,
  PRIOR_ART_DIR,
  countByStatus,
  exitCodeFor,
  failedNames,
  parseArgs,
  parseManifest,
  planPrune,
  renderSummary,
  resolveAll,
  resolveDestination,
  run,
  runFerry,
  selectEntries,
  syncOne,
  usage,
  type GitResult,
  type Outcome,
  type ReferenceSource,
  type SyncEffects,
} from "./sync-prior-art.ts";

const REPO_ROOT = "/fake/repo";

// ---------------------------------------------------------------------------
// Fake effects
// ---------------------------------------------------------------------------

interface Harness {
  readonly fx: SyncEffects;
  readonly stdout: string[];
  readonly stderr: string[];
  readonly gitCalls: string[][];
  readonly removed: string[];
  readonly made: string[];
}

interface FakeConfig {
  /** Absolute paths that "exist". */
  readonly existing?: readonly string[];
  /** Directory listing by absolute path. */
  readonly dirs?: Readonly<Record<string, readonly string[]>>;
  /** Decide the result of a git call. Default: everything succeeds, empty stdout. */
  readonly git?: (args: readonly string[], cwd?: string) => GitResult;
}

const OK: GitResult = { ok: true, stdout: "", stderr: "" };

function harness(config: FakeConfig = {}): Harness {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const gitCalls: string[][] = [];
  const removed: string[] = [];
  const made: string[] = [];
  const existing = new Set(config.existing ?? []);

  const fx: SyncEffects = {
    git: (args, cwd) => {
      gitCalls.push([...args]);
      return Promise.resolve(config.git ? config.git(args, cwd) : OK);
    },
    exists: (p) => existing.has(p),
    isDirectory: (p) => existing.has(p),
    mkdirp: (p) => {
      made.push(p);
      existing.add(p);
    },
    remove: (p) => {
      removed.push(p);
      existing.delete(p);
    },
    listDirNames: (p) => config.dirs?.[p] ?? [],
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
  };
  return { fx, stdout, stderr, gitCalls, removed, made };
}

function source(name: string, extra: Partial<ReferenceSource> = {}): ReferenceSource {
  return {
    name,
    url: `https://example.invalid/${name}.git`,
    branch: "main",
    path: `${PRIOR_ART_DIR}/${name}`,
    ...extra,
  };
}

function manifestText(entries: readonly ReferenceSource[]): string {
  return JSON.stringify(entries);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. CONTAINMENT — the defect this port closes by construction
// ═══════════════════════════════════════════════════════════════════════════
//
// Discriminates against: the `.sh`'s behaviour, which was `dest="$REPO_ROOT/$rel_path"` with no
// check at all. Every case below WOULD HAVE BEEN ACCEPTED by that line, and each one writes a
// multi-gigabyte third-party checkout into a tracked part of the tree.

test("CONTAIN-1: a plain in-tree path resolves under the prior-art root", () => {
  const outcome = resolveDestination(REPO_ROOT, `${PRIOR_ART_DIR}/sqlite`);
  expect(outcome.ok).toBe(true);
  if (outcome.ok) expect(outcome.value).toBe(resolve(REPO_ROOT, PRIOR_ART_DIR, "sqlite"));
});

test("CONTAIN-2: a path outside the prior-art tree is REFUSED", () => {
  const outcome = resolveDestination(REPO_ROOT, "src/foo");
  expect(outcome.ok).toBe(false);
  if (!outcome.ok) expect(outcome.error).toContain("outside");
});

test("CONTAIN-3: `..` traversal is refused even though the PREFIX is correct", () => {
  // This is the case a naive `startsWith("references/prior-art")` string check accepts.
  // It must be refused, and it must be refused for the RESOLVED destination.
  const outcome = resolveDestination(REPO_ROOT, `${PRIOR_ART_DIR}/../../etc/evil`);
  expect(outcome.ok).toBe(false);
  if (!outcome.ok) expect(outcome.error).toContain("outside");
});

test("CONTAIN-4: a sibling directory sharing the prefix is refused (prior-art-evil)", () => {
  // `references/prior-art-evil` startsWith `references/prior-art`. The separator matters.
  const outcome = resolveDestination(REPO_ROOT, "references/prior-art-evil/x");
  expect(outcome.ok).toBe(false);
});

test("CONTAIN-5: an absolute manifest path is refused", () => {
  const outcome = resolveDestination(REPO_ROOT, "/etc/evil");
  expect(outcome.ok).toBe(false);
  if (!outcome.ok) expect(outcome.error).toContain("absolute");
});

test("CONTAIN-6: the prior-art ROOT itself is refused — it would make --prune delete everything", () => {
  const outcome = resolveDestination(REPO_ROOT, PRIOR_ART_DIR);
  expect(outcome.ok).toBe(false);
  if (!outcome.ok) expect(outcome.error).toContain("root itself");
});

test("CONTAIN-7: resolveAll reports EVERY offending row, not just the first", () => {
  const outcome = resolveAll(REPO_ROOT, [source("a"), source("b", { path: "src/b" }), source("c", { path: "/tmp/c" })]);
  expect(outcome.ok).toBe(false);
  if (!outcome.ok) {
    expect(outcome.error).toContain("2 manifest row(s)");
    expect(outcome.error).toContain("b:");
    expect(outcome.error).toContain("c:");
  }
});

test("CONTAIN-8: an escaping row is a CONFIG error (exit 2) and syncs NOTHING", async () => {
  // The whole-run falsifier: not merely that resolveDestination says no, but that `run` refuses
  // before any git call happens. Remove the resolveAll guard in run() and this goes red.
  const h = harness();
  const code = await run(h.fx, {
    repoRoot: REPO_ROOT,
    manifestText: manifestText([source("good"), source("bad", { path: "src/bad" })]),
    options: { names: [], prune: false, dryRun: false, jobs: 1, help: false },
  });
  expect(code).toBe(EXIT_CONFIG);
  expect(h.gitCalls).toHaveLength(0);
  expect(h.stderr.join("\n")).toContain("outside references/prior-art/");
});

test("CONTAIN-9: the SHIPPED manifest satisfies containment for every row", () => {
  // Guards the live file, not a fixture. If someone adds a row pointing at `src/`, this goes red
  // in CI before the mirror can ever be created.
  const repoRoot = resolve(import.meta.dir, "..", "..", "..");
  const parsed = parseManifest(readFileSync(join(repoRoot, MANIFEST_PATH), "utf8"));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.value.length).toBeGreaterThan(0);
  const resolved = resolveAll(repoRoot, parsed.value);
  expect(resolved.ok).toBe(true);
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. A FAILURE NEVER EXITS 0
// ═══════════════════════════════════════════════════════════════════════════

test("FAIL-1: one unreachable source among three reddens the run and is NAMED", async () => {
  const h = harness({
    // Nothing exists → all three take the clone path. `b`'s clone fails.
    git: (args) => {
      if (args[0] === "clone" && args.includes("https://example.invalid/b.git")) {
        return { ok: false, stdout: "", stderr: "fatal: could not read from remote repository\nmore noise" };
      }
      if (args[0] === "rev-parse") return { ok: true, stdout: "abc1234\n", stderr: "" };
      return OK;
    },
  });
  const code = await run(h.fx, {
    repoRoot: REPO_ROOT,
    manifestText: manifestText([source("a"), source("b"), source("c")]),
    options: { names: [], prune: false, dryRun: false, jobs: 1, help: false },
  });

  expect(code).toBe(EXIT_FAILED);
  const out = h.stdout.join("\n");
  expect(out).toContain("FAILED — 1 source(s) did NOT sync");
  expect(out).toContain("b: clone failed: fatal: could not read from remote repository");
  // The other two still succeeded and are still reported as such — a partial sync is reported
  // partially, not collapsed to a single verdict.
  expect(out).toContain("✓ a — cloned");
  expect(out).toContain("✓ c — cloned");
});

test("FAIL-2: an all-failed run does NOT print like an empty run", async () => {
  // The property in one line: `Attempted: 0` and `failed: N` are different sentences.
  const allFailed = renderSummary({
    outcomes: [
      { name: "a", status: "failed", detail: "clone failed" },
      { name: "b", status: "failed", detail: "clone failed" },
    ],
    pruned: [],
    skippedByFilter: 0,
    manifestSize: 2,
    dryRun: false,
  }).join("\n");
  const empty = renderSummary({
    outcomes: [],
    pruned: [],
    skippedByFilter: 0,
    manifestSize: 0,
    dryRun: false,
  }).join("\n");

  expect(allFailed).not.toBe(empty);
  expect(allFailed).toContain("FAILED — 2 source(s) did NOT sync");
  expect(empty).toContain("the manifest declares no sources");
  expect(empty).not.toContain("FAILED");
});

test("FAIL-3: an empty manifest and a fully-filtered-out run read differently", () => {
  const emptyManifest = renderSummary({
    outcomes: [], pruned: [], skippedByFilter: 0, manifestSize: 0, dryRun: false,
  }).join("\n");
  const filteredOut = renderSummary({
    outcomes: [], pruned: [], skippedByFilter: 3, manifestSize: 3, dryRun: false,
  }).join("\n");
  expect(emptyManifest).not.toBe(filteredOut);
  expect(emptyManifest).toContain("declares no sources");
  expect(filteredOut).toContain("filtered out by --name");
});

test("FAIL-4: exitCodeFor is 1 iff something failed", () => {
  const clean: readonly Outcome[] = [{ name: "a", status: "cloned", detail: "" }];
  const dirty: readonly Outcome[] = [...clean, { name: "b", status: "failed", detail: "" }];
  expect(exitCodeFor([])).toBe(EXIT_OK);
  expect(exitCodeFor(clean)).toBe(EXIT_OK);
  expect(exitCodeFor(dirty)).toBe(EXIT_FAILED);
  expect(failedNames(dirty)).toEqual(["b"]);
});

test("FAIL-5: a mid-sequence refresh step failure is caught, not skipped past", async () => {
  // The `.sh` chained six git calls with `&&`. Dropping any link would silently "succeed".
  // Here each step is checked; `clean` failing must produce a failed outcome.
  const target = resolve(REPO_ROOT, PRIOR_ART_DIR, "a");
  const h = harness({
    existing: [join(target, ".git")],
    git: (args) => {
      if (args[0] === "remote" && args[1] === "get-url") return { ok: true, stdout: "https://example.invalid/a.git\n", stderr: "" };
      if (args[0] === "branch") return { ok: true, stdout: "other-branch\n", stderr: "" }; // not current → refresh
      if (args[0] === "clean") return { ok: false, stdout: "", stderr: "permission denied" };
      return OK;
    },
  });
  const outcome = await syncOne(h.fx, source("a"), target, false);
  expect(outcome.status).toBe("failed");
  expect(outcome.detail).toContain("git clean failed: permission denied");
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. DoP IS A THROUGHPUT DIAL, NOT A SEMANTICS DIAL
// ═══════════════════════════════════════════════════════════════════════════

test("DOP-1: the ferry writes results back by INPUT index, not completion order", async () => {
  // Discriminates against `results.push(...)`, which would order by completion. The TURN COUNTS
  // are deliberately inverted — item 0 waits the most turns, the last item waits the fewest — so
  // completion order is the exact REVERSE of input order. Deterministic in turns, not in time.
  const items = ["a", "b", "c", "d", "e"] as const;
  const completionOrder: string[] = [];
  const out = await runFerry(items, 5, async (item, index) => {
    await yieldTurns(items.length - index);
    completionOrder.push(item);
    return item;
  });
  // The premise of the test, asserted rather than assumed: completion really was reversed.
  expect(completionOrder).toEqual([...items].reverse());
  // ...and the RESULT is still in input order.
  expect(out).toEqual([...items]);
});

test("DOP-2: report and exit code are identical at --jobs 1, 4 and 16", async () => {
  const entries = Array.from({ length: 12 }, (_unused, i) => source(`src${String(i).padStart(2, "0")}`));
  const gitFake = (args: readonly string[]): GitResult => {
    if (args[0] === "clone" && args.some((a) => a.includes("src07"))) {
      return { ok: false, stdout: "", stderr: "boom" };
    }
    if (args[0] === "rev-parse") return { ok: true, stdout: "deadbee\n", stderr: "" };
    return OK;
  };

  const runs = await Promise.all(
    [1, 4, 16].map(async (jobs) => {
      const h = harness({ git: gitFake });
      const code = await run(h.fx, {
        repoRoot: REPO_ROOT,
        manifestText: manifestText(entries),
        options: { names: [], prune: false, dryRun: false, jobs, help: false },
      });
      // The live progress lines (`↓ cloning …`) are emitted as work completes and are
      // informational; the REPORT lines are the deterministic surface.
      const report = h.stdout.filter((l) => l.startsWith("✓") || l.startsWith("✗") || l.startsWith("  - ") || l.startsWith("Attempted"));
      return { code, report };
    }),
  );

  expect(runs[0]!.code).toBe(EXIT_FAILED);
  expect(runs[1]!.report).toEqual(runs[0]!.report);
  expect(runs[2]!.report).toEqual(runs[0]!.report);
  expect(runs[1]!.code).toBe(runs[0]!.code);
  expect(runs[2]!.code).toBe(runs[0]!.code);
});

test("DOP-3: the ferry never spawns more workers than items", async () => {
  let live = 0;
  let peak = 0;
  await runFerry([1, 2, 3], 16, async (item) => {
    live += 1;
    peak = Math.max(peak, live);
    await yieldTurns(1);
    live -= 1;
    return item;
  });
  expect(peak).toBeLessThanOrEqual(3);
});

test("DOP-4: DoP=1 is genuinely serial — never two in flight", async () => {
  let live = 0;
  let peak = 0;
  await runFerry([1, 2, 3, 4], 1, async (item) => {
    live += 1;
    peak = Math.max(peak, live);
    await yieldTurns(1);
    live -= 1;
    return item;
  });
  expect(peak).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. IDEMPOTENCY (§12) — re-running converges, it does not duplicate
// ═══════════════════════════════════════════════════════════════════════════

test("IDEM-1: a mirror already at origin/<branch> is skipped, with NO destructive git call", async () => {
  const target = resolve(REPO_ROOT, PRIOR_ART_DIR, "a");
  const h = harness({
    existing: [join(target, ".git")],
    git: (args) => {
      if (args[0] === "remote" && args[1] === "get-url") return { ok: true, stdout: "https://example.invalid/a.git\n", stderr: "" };
      if (args[0] === "branch") return { ok: true, stdout: "main\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "HEAD") return { ok: true, stdout: "cafebabe1234\n", stderr: "" };
      if (args[0] === "ls-remote") return { ok: true, stdout: "cafebabe1234\trefs/heads/main\n", stderr: "" };
      if (args[0] === "status") return { ok: true, stdout: "", stderr: "" };
      return OK;
    },
  });
  const outcome = await syncOne(h.fx, source("a"), target, false);
  expect(outcome.status).toBe("already-current");
  const verbs = h.gitCalls.map((c) => c[0]);
  expect(verbs).not.toContain("fetch");
  expect(verbs).not.toContain("reset");
  expect(verbs).not.toContain("clean");
  expect(verbs).not.toContain("clone");
});

test("IDEM-2: a DIRTY worktree is not 'current' even at the right commit", async () => {
  // Discriminates against dropping the `status --ignored` leg of the currency check. The `.sh`
  // had it; losing it would leave a mirror with local edits looking synced forever.
  const target = resolve(REPO_ROOT, PRIOR_ART_DIR, "a");
  const h = harness({
    existing: [join(target, ".git")],
    git: (args) => {
      if (args[0] === "remote" && args[1] === "get-url") return { ok: true, stdout: "https://example.invalid/a.git\n", stderr: "" };
      if (args[0] === "branch") return { ok: true, stdout: "main\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "HEAD") return { ok: true, stdout: "cafebabe1234\n", stderr: "" };
      if (args[0] === "rev-parse") return { ok: true, stdout: "cafebab\n", stderr: "" };
      if (args[0] === "ls-remote") return { ok: true, stdout: "cafebabe1234\trefs/heads/main\n", stderr: "" };
      if (args[0] === "status") return { ok: true, stdout: " M some-file\n", stderr: "" };
      return OK;
    },
  });
  const outcome = await syncOne(h.fx, source("a"), target, false);
  expect(outcome.status).toBe("refreshed");
  expect(h.gitCalls.map((c) => c[0])).toContain("fetch");
});

test("IDEM-3: a moved manifest URL repoints origin and forces a refresh", async () => {
  const target = resolve(REPO_ROOT, PRIOR_ART_DIR, "a");
  const h = harness({
    existing: [join(target, ".git")],
    git: (args) => {
      if (args[0] === "remote" && args[1] === "get-url") return { ok: true, stdout: "https://example.invalid/OLD.git\n", stderr: "" };
      // EVERYTHING ELSE REPORTS "PERFECTLY CURRENT" ON PURPOSE. The mirror is on the right
      // branch, at the remote tip, with a pristine worktree — so the ONLY thing that can force
      // a refresh here is the URL having moved. Without this the test was vacuous: an earlier
      // version answered `branch --show-current` with "", which fails the currency check for an
      // unrelated reason and made the run refresh no matter what `mustRefresh` was set to.
      // (Caught by mutation M22 — flipping `mustRefresh = true` to `false` survived.)
      if (args[0] === "branch") return { ok: true, stdout: "main\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "HEAD") return { ok: true, stdout: "cafebabe1234\n", stderr: "" };
      if (args[0] === "ls-remote") return { ok: true, stdout: "cafebabe1234\trefs/heads/main\n", stderr: "" };
      if (args[0] === "status") return { ok: true, stdout: "", stderr: "" };
      if (args[0] === "rev-parse") return { ok: true, stdout: "cafebab\n", stderr: "" };
      return OK;
    },
  });
  const outcome = await syncOne(h.fx, source("a"), target, false);
  expect(outcome.status).toBe("refreshed");
  const setUrl = h.gitCalls.find((c) => c[0] === "remote" && c[1] === "set-url");
  expect(setUrl).toEqual(["remote", "set-url", "origin", "https://example.invalid/a.git"]);
  // And it must NOT have consulted currency: a repointed remote is never "already current",
  // so the currency probe is skipped outright rather than asked and ignored.
  expect(h.gitCalls.map((c) => c[0])).not.toContain("ls-remote");
  expect(h.gitCalls.map((c) => c[0])).toContain("fetch");
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. DRY RUN writes nothing
// ═══════════════════════════════════════════════════════════════════════════

test("DRY-1: --dry-run performs NO git call and NO filesystem mutation", async () => {
  const h = harness();
  const code = await run(h.fx, {
    repoRoot: REPO_ROOT,
    manifestText: manifestText([source("a"), source("b")]),
    options: { names: [], prune: false, dryRun: true, jobs: 1, help: false },
  });
  expect(code).toBe(EXIT_OK);
  expect(h.gitCalls).toHaveLength(0);
  expect(h.removed).toHaveLength(0);
  expect(h.made).toHaveLength(0);
  const out = h.stdout.join("\n");
  expect(out).toContain("DRY RUN");
  expect(out).toContain("would-clone");
});

test("DRY-2: --dry-run --prune names orphans but deletes none", async () => {
  const priorArtRoot = join(REPO_ROOT, PRIOR_ART_DIR);
  const h = harness({
    existing: [priorArtRoot, join(priorArtRoot, "a"), join(priorArtRoot, "orphan")],
    dirs: { [priorArtRoot]: ["a", "orphan"] },
  });
  const code = await run(h.fx, {
    repoRoot: REPO_ROOT,
    manifestText: manifestText([source("a")]),
    options: { names: [], prune: true, dryRun: true, jobs: 1, help: false },
  });
  expect(code).toBe(EXIT_OK);
  expect(h.removed).toHaveLength(0);
  expect(h.stdout.join("\n")).toContain("orphan: orphan — would remove");
});

test("DRY-3: a real --prune DOES delete the orphan, and only the orphan", async () => {
  // The control for DRY-2: if the delete never happened in either mode, DRY-2 would be vacuous.
  const priorArtRoot = join(REPO_ROOT, PRIOR_ART_DIR);
  const h = harness({
    existing: [priorArtRoot, join(priorArtRoot, "a"), join(priorArtRoot, "orphan"), join(priorArtRoot, "a", ".git")],
    dirs: { [priorArtRoot]: ["a", "orphan"] },
    git: (args) => {
      if (args[0] === "remote" && args[1] === "get-url") return { ok: true, stdout: "https://example.invalid/a.git\n", stderr: "" };
      if (args[0] === "branch") return { ok: true, stdout: "main\n", stderr: "" };
      if (args[0] === "rev-parse" && args[1] === "HEAD") return { ok: true, stdout: "aa\n", stderr: "" };
      if (args[0] === "ls-remote") return { ok: true, stdout: "aa\trefs/heads/main\n", stderr: "" };
      if (args[0] === "status") return { ok: true, stdout: "", stderr: "" };
      return OK;
    },
  });
  const code = await run(h.fx, {
    repoRoot: REPO_ROOT,
    manifestText: manifestText([source("a")]),
    options: { names: [], prune: true, dryRun: false, jobs: 1, help: false },
  });
  expect(code).toBe(EXIT_OK);
  expect(h.removed).toEqual([join(priorArtRoot, "orphan")]);
});

test("PRUNE-1: planPrune keeps manifest names and sorts the orphans", () => {
  expect(planPrune(["z", "a", "keep", "m"], ["keep"])).toEqual(["a", "m", "z"]);
  expect(planPrune(["keep"], ["keep"])).toEqual([]);
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. --name: an unknown name must not report success
// ═══════════════════════════════════════════════════════════════════════════

test("NAME-1: a known subset is selected and the rest counted as filtered", () => {
  const entries = [source("a"), source("b"), source("c")];
  const selection = selectEntries(entries, ["a", "c"]);
  expect(selection.selected.map((e) => e.name)).toEqual(["a", "c"]);
  expect(selection.skippedByFilter).toBe(1);
  expect(selection.unknownNames).toEqual([]);
});

test("NAME-2: an unknown --name is a CONFIG error, not a silent 0-source success", async () => {
  // This is the `.sh`'s behaviour inverted on purpose. Under the `.sh`, `--name typo` printed
  // "Attempted: 0" and exited 0. Remove the unknownNames guard in run() and this goes red.
  const h = harness();
  const code = await run(h.fx, {
    repoRoot: REPO_ROOT,
    manifestText: manifestText([source("a")]),
    options: { names: ["typo"], prune: false, dryRun: false, jobs: 1, help: false },
  });
  expect(code).toBe(EXIT_CONFIG);
  expect(h.gitCalls).toHaveLength(0);
  expect(h.stderr.join("\n")).toContain("unknown source(s): typo");
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Argument grammar + manifest validation (exit 2 discipline)
// ═══════════════════════════════════════════════════════════════════════════

test("ARG-1: the .sh's grammar still parses", () => {
  expect(parseArgs([])).toEqual({ ok: true, value: { names: [], prune: false, dryRun: false, jobs: 1, help: false } });
  const named = parseArgs(["--name", "foo,bar"]);
  expect(named.ok && named.value.names).toEqual(["foo", "bar"]);
  const alias = parseArgs(["--names", "foo"]);
  expect(alias.ok && alias.value.names).toEqual(["foo"]);
  const pruned = parseArgs(["--prune"]);
  expect(pruned.ok && pruned.value.prune).toBe(true);
  expect(parseArgs(["-h"]).ok && parseArgs(["-h"])).toMatchObject({ value: { help: true } });
});

test("ARG-2: default jobs is 1 — byte-identical serial behaviour to the .sh", () => {
  const parsed = parseArgs([]);
  expect(parsed.ok && parsed.value.jobs).toBe(1);
});

test("ARG-3: malformed args are refused", () => {
  expect(parseArgs(["--bogus"]).ok).toBe(false);
  expect(parseArgs(["--name"]).ok).toBe(false);
  expect(parseArgs(["--name", "--prune"]).ok).toBe(false);
  expect(parseArgs(["--jobs"]).ok).toBe(false);
  expect(parseArgs(["--jobs", "0"]).ok).toBe(false);
  expect(parseArgs(["--jobs", "-2"]).ok).toBe(false);
  expect(parseArgs(["--jobs", "abc"]).ok).toBe(false);
});

test("MANIFEST-1: structurally broken manifests are refused with the row index", () => {
  expect(parseManifest("not json").ok).toBe(false);
  expect(parseManifest('{"not":"an array"}').ok).toBe(false);
  const missing = parseManifest('[{"name":"a","url":"u","path":"references/prior-art/a"}]');
  expect(missing.ok).toBe(false);
  if (!missing.ok) expect(missing.error).toContain('row 0 has a missing or empty "branch"');
  const blank = parseManifest('[{"name":"a","url":"","branch":"main","path":"references/prior-art/a"}]');
  expect(blank.ok).toBe(false);
});

test("MANIFEST-2: duplicate names and duplicate paths are refused", () => {
  const dupName = parseManifest(manifestText([source("a"), source("a", { path: `${PRIOR_ART_DIR}/a2` })]));
  expect(dupName.ok).toBe(false);
  if (!dupName.ok) expect(dupName.error).toContain('repeats the name "a"');
  const dupPath = parseManifest(manifestText([source("a"), source("b", { path: `${PRIOR_ART_DIR}/a` })]));
  expect(dupPath.ok).toBe(false);
  if (!dupPath.ok) expect(dupPath.error).toContain("repeats the path");
});

test("MANIFEST-3: a bad manifest exits 2 and syncs nothing", async () => {
  const h = harness();
  const code = await run(h.fx, {
    repoRoot: REPO_ROOT,
    manifestText: "{{{",
    options: { names: [], prune: false, dryRun: false, jobs: 1, help: false },
  });
  expect(code).toBe(EXIT_CONFIG);
  expect(h.gitCalls).toHaveLength(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Naming — carry PR #15210's intent forward
// ═══════════════════════════════════════════════════════════════════════════

test("NAME-3: no sense-[A] 'upstream' naming survives in the port's own surface", () => {
  // The `.sh` carried nine: UPSTREAMS_DIR, "Zeta upstream sync", "Upstreams dir", "One-upstream
  // sync", and the rest. This pins that the replacement does not reintroduce them in the two
  // places a user actually reads: the help text and the run banner.
  const helpText = usage().join("\n").toLowerCase();
  expect(helpText).not.toContain("upstream");
  expect(helpText).toContain("prior-art");
});

test("NAME-4: the run banner says prior-art, never upstream", async () => {
  const h = harness();
  await run(h.fx, {
    repoRoot: REPO_ROOT,
    manifestText: manifestText([source("a")]),
    options: { names: [], prune: false, dryRun: true, jobs: 1, help: false },
  });
  const out = h.stdout.join("\n").toLowerCase();
  expect(out).toContain("prior-art");
  expect(out).not.toContain("upstream");
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Bookkeeping
// ═══════════════════════════════════════════════════════════════════════════

test("COUNT-1: every outcome lands in exactly one bucket and the buckets total", () => {
  const outcomes: readonly Outcome[] = [
    { name: "a", status: "cloned", detail: "" },
    { name: "b", status: "refreshed", detail: "" },
    { name: "c", status: "already-current", detail: "" },
    { name: "d", status: "failed", detail: "" },
  ];
  const counts = countByStatus(outcomes);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  expect(total).toBe(outcomes.length);
  expect(counts.failed).toBe(1);
});
