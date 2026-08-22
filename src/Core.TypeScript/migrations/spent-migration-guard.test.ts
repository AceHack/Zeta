/**
 * src/Core.TypeScript/migrations/spent-migration-guard.test.ts
 *
 * The three ruleset migrations mutate LIVE branch protection on Lucent-Financial-Group/Zeta, and
 * their work items closed in May 2026. Live state has since moved past all three target states, so
 * a bare run today does not re-apply a migration — it reverts one, and `b0267-safety-ruleset.ts`
 * reaches `DELETE /rulesets/15256879` before dying in step 3 on a moved script path.
 *
 * WHAT IS ASSERTED, AND WHY IT IS THE FILESYSTEM AND NOT AN EXIT CODE.
 * These are never pointed at GitHub. `gh` is replaced by a shim on PATH that appends every
 * invocation to a canary file and answers `[]`. For a tool whose destructive act IS an API call,
 * the recorded call is the write — so "did the guard hold" is answered by whether the canary file
 * exists, not by what the process returned. An exit-code-only test passes against a tool that
 * deletes a ruleset and *then* complains, which is the defect this pins.
 *
 * The shim is also the containment. The migrations spawn `gh` by NAME (`Bun.spawn(["gh", ...])`),
 * never by absolute path, so if PATH substitution somehow failed the spawn is ENOENT — it cannot
 * fall through to a real credentialed `gh`.
 *
 * HAZARD FOR WHOEVER MUTATION-PROVES THIS FILE NEXT — it bit me, so it is written down.
 * With the guard neutered, `b0266` and `b0267-branch-safety` run all the way to step 3, which
 * spawns the snapshot script and writes its stdout over the CHECKED-IN baseline
 * `src/Core.TypeScript/hygiene/github-settings.expected.json`. Under the shim that stdout is
 * `[]`-shaped nonsense, so a mutation sweep silently replaces a 391-line baseline with 12 lines of
 * garbage in your working tree. Check `git status` after any sweep of these three. Note this is
 * only reachable BECAUSE the paths were repaired: before, step 3 died `Module not found`.
 *
 * DELIBERATE OMISSION — there is no subprocess test of `--rerun-spent-migration`.
 * Exercising the re-arm would drive the live code path, and if the shim ever failed to intercept,
 * that path DELETEs a real ruleset. Same reasoning #10853 applied to `launchctl`: a test that can
 * do that is worse than the defect it guards. The re-arm is covered statically below instead, and
 * that weaker coverage is named rather than dressed up.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { stripComments } from "../hygiene/audit-workflow-cli-flags.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

const MIGRATIONS = [
  "src/Core.TypeScript/migrations/b0266-review-policy-ruleset.ts",
  "src/Core.TypeScript/migrations/b0267-safety-ruleset.ts",
  "src/Core.TypeScript/migrations/b0267-branch-safety-ruleset.ts",
];

/** A `gh` that records what it was asked and answers `[]`. Returns the canary path. */
function shimmed(): { env: Record<string, string>; canary: string } {
  const dir = mkdtempSync(join(tmpdir(), "spent-migration-gh-"));
  const canary = join(dir, "calls.log");
  const shim = join(dir, "gh");
  writeFileSync(shim, `#!/bin/sh\necho "gh $*" >> "${canary}"\necho '[]'\nexit 0\n`);
  chmodSync(shim, 0o755);
  return { env: { PATH: `${dir}:${process.env["PATH"] ?? ""}` }, canary };
}

/** The write detector: recorded calls, or [] if the canary was never created at all. */
function calls(canary: string): string[] {
  if (!existsSync(canary)) return [];
  return readFileSync(canary, "utf8").trim().split("\n").filter(Boolean);
}

function run(rel: string, args: readonly string[], env: Record<string, string>) {
  const r = spawnSync("bun", [resolve(REPO_ROOT, rel), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

describe("spent ruleset migrations refuse the live path", () => {
  for (const rel of MIGRATIONS) {
    test(`${rel}: a bare invocation makes NO api call at all`, () => {
      const { env, canary } = shimmed();
      const r = run(rel, [], env);
      // FILESYSTEM FIRST, deliberately. Removing the guard leaves this canary non-empty, because
      // the first statement past it is a GET — so this is the assertion that must be the one to
      // fail under mutation. Asserting the message or the exit code ahead of it would let the
      // mutation proof pass on a changed string while never evaluating whether a call happened.
      expect(calls(canary)).toEqual([]);
      expect(r.code).not.toBe(0);
      expect(r.out).toContain("this migration is SPENT");
    });

    test(`${rel}: CONTROL — --dry-run still reaches the api, so the shim can detect a call`, () => {
      const { env, canary } = shimmed();
      run(rel, ["--dry-run"], env);
      // Without this control a broken shim would make the test above pass vacuously.
      expect(calls(canary).length).toBeGreaterThan(0);
    });

    test(`${rel}: the re-arm flag exists and is the only way past the guard`, () => {
      // STATIC, and weaker than the subprocess cases above on purpose — see the file header.
      const src = readFileSync(resolve(REPO_ROOT, rel), "utf8");
      expect(src).toContain('const SPENT_RERUN_FLAG = "--rerun-spent-migration"');
      expect(src).toContain("!dryRun && !process.argv.includes(SPENT_RERUN_FLAG)");
      expect(src).toContain("SPENT_RERUN_FLAG]");
    });
  }
});

describe("the paths step 3 shells out to actually exist", () => {
  /**
   * #8050 relocated these files from `tools/migrations/` to `src/Core.TypeScript/migrations/` and
   * did not re-base `repoRoot`, which was `resolve(scriptDir, "../..")` — correct at the old depth,
   * one level short at the new one. That is a SECOND, independent error from the moved
   * `tools/hygiene/` prefix, and it matters: correcting only the prefix would have resolved to
   * `<root>/src/src/Core.TypeScript/hygiene/…`, which is still nothing.
   */
  const DERIVED = [
    "src/Core.TypeScript/hygiene/snapshot-github-settings.ts",
    "src/Core.TypeScript/hygiene/github-settings.expected.json",
    "src/Core.TypeScript/hygiene/check-github-settings-drift.ts",
  ];

  for (const rel of MIGRATIONS) {
    test(`${rel}: repoRoot is three levels up, not two`, () => {
      const src = readFileSync(resolve(REPO_ROOT, rel), "utf8");
      expect(src).toContain('resolve(scriptDir, "../../..")');
      expect(src).not.toContain('resolve(scriptDir, "../..")');
    });

    test(`${rel}: names no path under the retired tools/ tree`, () => {
      // Comments are STRIPPED first. The prose in these files legitimately discusses the old
      // `tools/hygiene/` location while explaining why it moved, and an assertion over raw source
      // would either fail on that prose or — the direction that actually bites — pass on a file
      // whose only mention of the correct path is in a comment. #10853 shipped a guard whose test
      // was held up by its own doc comment for exactly this reason; the fix is the same one.
      const code = stripComments(readFileSync(resolve(REPO_ROOT, rel), "utf8"));
      expect(code).not.toContain("tools/hygiene/");
      expect(code).not.toContain("tools/migrations/");
    });
  }

  for (const d of DERIVED) {
    test(`${d} exists`, () => {
      expect(existsSync(resolve(REPO_ROOT, d))).toBe(true);
    });
  }

  test("the snapshot script step 3 spawns is a runnable CLI that takes --repo", () => {
    // It is invoked as a subprocess (`bun <script> --repo SLUG` > stdout), not imported — so the
    // contract to check is the CLI surface, not an export.
    const src = readFileSync(
      resolve(REPO_ROOT, "src/Core.TypeScript/hygiene/snapshot-github-settings.ts"),
      "utf8",
    );
    expect(src).toContain("if (import.meta.main)");
    expect(src).toContain('arg === "--repo"');
    expect(src).toContain("process.stdout.write(");
  });
});
