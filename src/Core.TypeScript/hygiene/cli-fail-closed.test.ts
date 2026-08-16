/**
 * cli-fail-closed.test.ts — the sibling class filed as 081M03HRHBS087G0R001HRAFQ0.
 *
 * `rebuild-legacy-b-id-aliases.ts` decided whether to rewrite ~1,700 files by asking
 * `process.argv.includes("--dry-run")` — so EVERY other string, including the `--help` an agent
 * actually typed, meant "go". PR #10841 fixed that one tool and filed eight siblings with the
 * same shape. This file pins property 1 across all of them: **an unrecognised argument is an
 * error, and the process exits non-zero BEFORE any write.**
 *
 * WHY THESE TESTS ASSERT ON THE FILESYSTEM AND NOT ON THE EXIT CODE
 * ---------------------------------------------------------------------------
 * A test that only checked the exit code would pass against a tool that rewrote the repository
 * and *then* complained — which is the exact defect being fixed, so an exit-code-only test lands
 * in the same vacuity class as the bug. Every subprocess case here snapshots the fixture tree
 * (relative path, byte length, and `mtimeMs`) before and after, and asserts on the tree. mtime is
 * included so a rewrite that happens to produce identical bytes still fails.
 *
 * WHY EACH SUBPROCESS CASE CARRIES A POSITIVE CONTROL
 * ---------------------------------------------------------------------------
 * "Nothing was written" is only evidence if this fixture *could* have detected a write. So every
 * tool below is also run in a mode that DOES write, in the same fixture, and that write is
 * asserted. Without the control, a broken fixture (wrong cwd, unresolvable script) would produce
 * a green suite that proves nothing.
 *
 * WHAT IS *NOT* TESTED HERE, AND WHERE IT IS INSTEAD
 * ---------------------------------------------------------------------------
 * `ops/setup-dual-background-agents.ts` (writes launchd plists, `launchctl bootstrap`) and
 * `zflash/flash-usb-windows.ts` (writes a block device) cannot be driven end-to-end in a test
 * without either faking the platform or trusting a shim to intercept a genuinely destructive
 * call. Their guards were mutation-proven by hand under `HOME=`-redirection + PATH shims (recorded
 * in the PR), and what is pinned mechanically here is the static property — that their parsers
 * are closed — plus, for the flasher, its exported pure predicate.
 */
import { describe, test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, statSync, chmodSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { hasClosedFlagSet, stripComments } from "./audit-workflow-cli-flags";
import { firstUnknownArg } from "../observe/backfill-tick-shards";
import { firstUnknownFlag } from "../zflash/flash-usb-windows";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const tool = (rel: string): string => join(REPO_ROOT, rel);

/** The eight siblings PR #10841 found and deliberately did not fix. */
const SIBLINGS: readonly string[] = [
  "src/Core.TypeScript/hygiene/healers/run-tier0.ts",
  "src/Core.TypeScript/hygiene/mutation-runner.ts",
  "src/Core.TypeScript/migrations/b0266-review-policy-ruleset.ts",
  "src/Core.TypeScript/migrations/b0267-safety-ruleset.ts",
  "src/Core.TypeScript/migrations/b0267-branch-safety-ruleset.ts",
  "src/Core.TypeScript/ops/setup-dual-background-agents.ts",
  "src/Core.TypeScript/zflash/flash-usb-windows.ts",
  "src/Core.TypeScript/observe/backfill-tick-shards.ts",
];

/** Path, size and mtime of every file under `root` — the write detector. */
function snapshot(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const st = statSync(full);
      out.push(`${relative(root, full)} ${String(st.size)} ${String(st.mtimeMs)}`);
    }
  };
  walk(root);
  return out.sort();
}

function run(args: readonly string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
  const r = spawnSync("bun", [...args], {
    encoding: "utf8",
    ...(opts.cwd === undefined ? {} : { cwd: opts.cwd }),
    env: { ...process.env, ...(opts.env ?? {}) },
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ENROLMENT PROPERTY — the reason this work pays for itself twice.
// ─────────────────────────────────────────────────────────────────────────────

describe("enrolment in audit-workflow-cli-flags", () => {
  /**
   * `audit-workflow-cli-flags.ts` refuses a workflow that passes a flag its tool rejects — but
   * ONLY for tools whose parser demonstrably rejects unknown flags, which it decides by finding an
   * `unknown arg` diagnostic in the source. Before this change every tool below was *skipped* by
   * that audit: the absence of a guard bought exemption from the lint that would have caught a bad
   * invocation of it. This test is the ratchet — a sibling that loses its guard, or whose
   * diagnostic gets reworded past `hasClosedFlagSet`, silently leaves the auditor's scope again,
   * and that is the failure this pins.
   */
  for (const rel of SIBLINGS) {
    test(`${rel} has a closed flag set`, () => {
      expect(hasClosedFlagSet(readFileSync(tool(rel), "utf8"))).toBe(true);
    });

    /**
     * AND THE DIAGNOSTIC IS IN CODE, NOT IN PROSE.
     *
     * `hasClosedFlagSet` runs its regex over the RAW source, comments included — unlike
     * `extractAcceptedFlags`, which strips them first. So a file that merely *discusses* unknown
     * arguments in a comment reads as having a closed parser, and the assertion above passes for a
     * tool with no guard at all.
     *
     * Caught here on 2026-08-15, on my own work: removing the guard from
     * `setup-dual-background-agents.ts` left the suite fully green, because the comment I had
     * written ABOVE the guard explaining why the phrase matters still contained the phrase. The
     * doc-comment was holding the test up. Stripping comments first is what makes this a
     * falsifier rather than a description.
     */
    test(`${rel}: the diagnostic survives comment-stripping (it is code, not prose)`, () => {
      expect(hasClosedFlagSet(stripComments(readFileSync(tool(rel), "utf8")))).toBe(true);
    });
  }

  /**
   * CLOSED 2026-08-16. This was a DEFECT PIN: it asserted, deliberately, that `hasClosedFlagSet`
   * was fooled by prose — "so the day that stops being true is visible." PR #10860 made
   * `hasClosedFlagSet` read `stripComments(source)`, so the day arrived and the pin fired: it went
   * red on `main` (`Expected: true, Received: false`). That is exactly what a pin is for.
   *
   * What was missing is the other half of the handshake — a pin that fires must be REWRITTEN to
   * assert the fix, not left red. So the same input now pins the FIXED behaviour, in both
   * directions: a file that only discusses unknown arguments in a comment no longer reads as
   * having a closed parser, and the detector is insensitive to whether the caller stripped
   * comments first (it strips them itself, so pre-stripped text must give the same answer).
   */
  test("hasClosedFlagSet is NOT fooled by prose — a comment alone does not read as a parser", () => {
    const noParserAtAll = [
      "// This tool does not reject an unknown arg. It has no parser.",
      'const dryRun = process.argv.includes("--dry-run");',
    ].join("\n");
    expect(hasClosedFlagSet(noParserAtAll)).toBe(false);
    expect(hasClosedFlagSet(stripComments(noParserAtAll))).toBe(false);
    // …and it still recognises the real thing, so the tightening did not simply
    // turn the detector off.
    expect(hasClosedFlagSet("throw new Error(`unknown arg: ${a}`);")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PURE PREDICATES — exhaustive, cheap, and the only reachable surface for the flasher.
// ─────────────────────────────────────────────────────────────────────────────

describe("backfill-tick-shards.firstUnknownArg", () => {
  test("accepts the only flag it has", () => {
    expect(firstUnknownArg(["--dry-run"])).toBeNull();
  });
  test("accepts no arguments", () => {
    expect(firstUnknownArg([])).toBeNull();
  });
  test("rejects the near-miss that motivated the class", () => {
    expect(firstUnknownArg(["--dry-runn"])).toBe("--dry-runn");
  });
  test("rejects the probe that fired the original incident", () => {
    expect(firstUnknownArg(["--help"])).toBe("--help");
  });
  test("rejects a stray positional — this tool takes none", () => {
    expect(firstUnknownArg(["data/tick-history.json"])).toBe("data/tick-history.json");
  });
  test("a valid flag does not launder an invalid one beside it", () => {
    expect(firstUnknownArg(["--dry-run", "--force"])).toBe("--force");
  });
});

describe("flash-usb-windows.firstUnknownFlag", () => {
  test("accepts every documented flag", () => {
    expect(firstUnknownFlag(["--short", "--dry-run", "--no-inject"])).toBeNull();
    expect(firstUnknownFlag(["--help"])).toBeNull();
    expect(firstUnknownFlag(["-h"])).toBeNull();
  });
  test("accepts --ssh-key and does not judge its value", () => {
    expect(firstUnknownFlag(["--ssh-key", "/home/a/.ssh/id_ed25519.pub"])).toBeNull();
  });
  test("an ISO path is a positional, not an unknown flag", () => {
    // Positional COUNT is bounded by the pre-existing `positional.length > 1` check; this
    // predicate must not duplicate or contradict that judgement.
    expect(firstUnknownFlag(["/tmp/zeta-installer-1.iso"])).toBeNull();
    expect(firstUnknownFlag(["--dry-run", "/tmp/zeta-installer-1.iso"])).toBeNull();
  });
  test("rejects the near-miss — before the guard, this meant DESTROY THE USB", () => {
    // The old parser filtered every `-`-prefixed token out of `positional`, so an unknown flag
    // was not ignored, it was actively discarded, and `--dry-runn` read as "not a dry run".
    expect(firstUnknownFlag(["--dry-runn"])).toBe("--dry-runn");
  });
  test("rejects an unknown short flag", () => {
    expect(firstUnknownFlag(["-n"])).toBe("-n");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBPROCESS + FILESYSTEM — the real CLIs, each with a positive control.
// ─────────────────────────────────────────────────────────────────────────────

describe("run-tier0 — rewrites markdown/TS across --repo-root", () => {
  /** An import the unused-import healer will definitely strip. */
  const DIRTY = 'import { readFileSync } from "node:fs";\nimport { join } from "node:path";\n\nexport const p = join("a", "b");\n';

  function fixture(): string {
    const root = mkdtempSync(join(tmpdir(), "failclosed-tier0-"));
    writeFileSync(join(root, "drifted.ts"), DIRTY);
    return root;
  }

  test("an unrecognised flag exits non-zero and writes NOTHING", () => {
    const root = fixture();
    const before = snapshot(root);
    const r = run([tool("src/Core.TypeScript/hygiene/healers/run-tier0.ts"), "--repo-root", root, "--dry-runn"]);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("unknown arg: --dry-runn");
    expect(snapshot(root)).toEqual(before);
  });

  test("an unrecognised flag does NOT exit 2 — that code means 'blast radius exceeded'", () => {
    // agent-heartbeat.yml treats rc=2 as a tolerated ::warning:: and ends the step cleanly. A
    // mistyped flag routed through that branch would report a heal that never ran as a known
    // condition — a check that cannot fail, wearing the costume of one that passed.
    const root = fixture();
    const r = run([tool("src/Core.TypeScript/hygiene/healers/run-tier0.ts"), "--repo-root", root, "--nope"]);
    expect(r.code).toBe(1);
  });

  test("CONTROL: the same fixture DOES get rewritten by a valid invocation", () => {
    const root = fixture();
    const before = snapshot(root);
    const r = run([tool("src/Core.TypeScript/hygiene/healers/run-tier0.ts"), "--repo-root", root, "--max-files", "25"]);
    expect(r.code).toBe(0);
    expect(snapshot(root)).not.toEqual(before);
    expect(readFileSync(join(root, "drifted.ts"), "utf8")).not.toContain("readFileSync");
  });

  test("the heartbeat's exact invocation still works", () => {
    const root = fixture();
    const planOut = join(mkdtempSync(join(tmpdir(), "failclosed-plan-")), "heal-plan.txt");
    const r = run([
      tool("src/Core.TypeScript/hygiene/healers/run-tier0.ts"),
      "--repo-root", root, "--max-files", "25", "--plan-out", planOut,
    ]);
    expect(r.code).toBe(0);
    expect(readFileSync(planOut, "utf8").trim()).toBe("drifted.ts");
  });

  test("--dry-run is still accepted and still writes nothing", () => {
    const root = fixture();
    const before = snapshot(root);
    const r = run([tool("src/Core.TypeScript/hygiene/healers/run-tier0.ts"), "--repo-root", root, "--dry-run"]);
    expect(r.code).toBe(0);
    expect(snapshot(root)).toEqual(before);
  });

  test("a value-taking flag with no value is refused rather than swallowing the next flag", () => {
    const root = fixture();
    const before = snapshot(root);
    const r = run([tool("src/Core.TypeScript/hygiene/healers/run-tier0.ts"), "--repo-root", root, "--max-files"]);
    expect(r.code).toBe(1);
    expect(snapshot(root)).toEqual(before);
  });
});

describe("mutation-runner — writes a mutant into a source file, appends to db/", () => {
  const ROOM = "src/a.ts::src/a.test.ts::false-to-true";
  const SCRIPT = "src/Core.TypeScript/hygiene/mutation-runner.ts";

  test("an unrecognised flag exits non-zero and writes NOTHING", () => {
    const root = mkdtempSync(join(tmpdir(), "failclosed-mutation-"));
    const before = snapshot(root);
    const r = run([
      tool(SCRIPT), "--repo-root", root, "--agent", "failclosed",
      "--room", ROOM, "--choose", "3", "--reason", "pinned", "--dry-runn",
    ]);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("unknown arg: --dry-runn");
    expect(snapshot(root)).toEqual(before);
  });

  test("an unrecognised flag exits 1, never 3/4/5 — those codes are FINDINGS", () => {
    // The heartbeat renders rc=3/4/5 into the run summary as a measurement. A mistyped flag must
    // not be able to publish itself as one.
    const root = mkdtempSync(join(tmpdir(), "failclosed-mutation-code-"));
    const r = run([tool(SCRIPT), "--repo-root", root, "--agent", "failclosed", "--nope"]);
    expect(r.code).toBe(1);
  });

  test("CONTROL: the same invocation without the bogus flag DOES append to the ledger", () => {
    const root = mkdtempSync(join(tmpdir(), "failclosed-mutation-ctl-"));
    const before = snapshot(root);
    const r = run([
      tool(SCRIPT), "--repo-root", root, "--agent", "failclosed",
      "--room", ROOM, "--choose", "3", "--reason", "pinned",
    ]);
    expect(r.code).toBe(0);
    expect(snapshot(root)).not.toEqual(before);
  });
});

describe("backfill-tick-shards — writes shards under the caller's cwd", () => {
  const SCRIPT = "src/Core.TypeScript/observe/backfill-tick-shards.ts";

  function fixture(): string {
    const root = mkdtempSync(join(tmpdir(), "failclosed-backfill-"));
    mkdirSync(join(root, "data"));
    writeFileSync(
      join(root, "data", "tick-history.json"),
      JSON.stringify({ frames: [{ t: "2026-08-01T00:00:00.000Z", agent: "failclosed" }] }),
    );
    return root;
  }

  test("an unrecognised flag exits non-zero and writes NOTHING", () => {
    const root = fixture();
    const before = snapshot(root);
    const r = run([tool(SCRIPT), "--dry-runn"], { cwd: root });
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("unknown arg: --dry-runn");
    expect(snapshot(root)).toEqual(before);
  });

  test("CONTROL: the same fixture DOES get shards from a bare run", () => {
    const root = fixture();
    const before = snapshot(root);
    const r = run([tool(SCRIPT)], { cwd: root });
    expect(r.code).toBe(0);
    expect(snapshot(root)).not.toEqual(before);
  });

  test("--dry-run is still accepted and still writes nothing", () => {
    const root = fixture();
    const before = snapshot(root);
    const r = run([tool(SCRIPT), "--dry-run"], { cwd: root });
    expect(r.code).toBe(0);
    expect(snapshot(root)).toEqual(before);
  });
});

describe("the three ruleset migrations — mutate LIVE branch protection", () => {
  /**
   * These are never pointed at GitHub. `gh` is replaced by a shim on PATH that records every
   * invocation to a file and answers `[]`, so "did the tool reach its API call" is answered on the
   * filesystem. For a tool whose destructive act IS an API call, the recorded call is the write —
   * and the mutation proof in the PR shows the unguarded versions reaching
   * `POST /rulesets` and `PUT /rulesets/15256879` on a bogus flag.
   */
  const MIGRATIONS = [
    "src/Core.TypeScript/migrations/b0266-review-policy-ruleset.ts",
    "src/Core.TypeScript/migrations/b0267-safety-ruleset.ts",
    "src/Core.TypeScript/migrations/b0267-branch-safety-ruleset.ts",
  ];

  function shimmed(): { env: Record<string, string>; canary: string } {
    const dir = mkdtempSync(join(tmpdir(), "failclosed-gh-"));
    const canary = join(dir, "calls.log");
    const shim = join(dir, "gh");
    writeFileSync(shim, `#!/bin/sh\necho "gh $*" >> "${canary}"\necho '[]'\nexit 0\n`);
    chmodSync(shim, 0o755);
    return { env: { PATH: `${dir}:${process.env["PATH"] ?? ""}` }, canary };
  }

  function calls(canary: string): string[] {
    try {
      return readFileSync(canary, "utf8").trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  for (const rel of MIGRATIONS) {
    test(`${rel}: an unrecognised flag makes NO api call at all`, () => {
      const { env, canary } = shimmed();
      const r = run([tool(rel), "--dry-runn"], { env });
      expect(r.code).not.toBe(0);
      expect(r.out).toContain("unknown arg: --dry-runn");
      expect(calls(canary)).toEqual([]);
    });

    test(`${rel}: CONTROL — --dry-run still reaches the api, so the shim can detect a call`, () => {
      const { env, canary } = shimmed();
      run([tool(rel), "--dry-run"], { env });
      expect(calls(canary).length).toBeGreaterThan(0);
    });
  }
});
