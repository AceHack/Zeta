import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, test } from "bun:test";

import {
  accumulatedHistoryError,
  agencySignatureBlock,
  assertNoSkipCi,
  bufferRef,
  chooseFlushRoute,
  classifyHeadVerdict,
  prepare,
  signedFlushMessage,
  stagingRef,
} from "./flush-via-staging";

const WORKFLOW_DIR = join(import.meta.dir, "..", "..", "..", "..", ".github", "workflows");
const workflow = (name: string): string => readFileSync(join(WORKFLOW_DIR, name), "utf8");

// The telemetry lanes that flush through this tool.
const LANES = ["tick-metrics", "society", "red-state"] as const;

// The validator's REQUIRED_KEYS, duplicated deliberately: if that list changes,
// this test must go red rather than silently accept a block missing a key.
const REQUIRED_KEYS = [
  "Agency-Signature-Version",
  "Agent",
  "Agent-Runtime",
  "Agent-Model",
  "Credential-Identity",
  "Credential-Mode",
  "Human-Review",
  "Human-Review-Evidence",
  "Action-Mode",
  "Task",
] as const;

/** git's own trailer parser — the only witness that matters. */
function parsedTrailers(message: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["interpret-trailers", "--parse"], {
    encoding: "utf8",
    input: message,
  });
  return r.stdout;
}

describe("assertNoSkipCi", () => {
  test("refuses a skip token", () => {
    expect(assertNoSkipCi("metrics: append tick frame [skip ci]")).not.toBeNull();
  });

  test("accepts a clean message", () => {
    expect(assertNoSkipCi("metrics: append tick frame")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HISTORY ACCUMULATION — the defect measured on `heartbeat/tick-metrics`
// 2026-08-17 (444 commits ahead of main, 164 of them self-merges).
// ---------------------------------------------------------------------------

describe("accumulatedHistoryError", () => {
  test("a branch sitting exactly on origin/main is the only accepted state", () => {
    expect(accumulatedHistoryError(0, 0)).toBeNull();
  });

  test("one non-merge commit already violates it — prepare must not commit", () => {
    expect(accumulatedHistoryError(1, 0)).not.toBeNull();
  });

  test("the live shape (444 ahead, 164 merges) is refused", () => {
    const v = accumulatedHistoryError(444, 164);
    expect(v).not.toBeNull();
    expect(v?.error).toContain("444");
    expect(v?.error).toContain("164");
  });

  // FAILS CLOSED. An unparseable `rev-list --count` reaches this as NaN, and NaN
  // must never read as "zero commits, all clear" — a measurement that did not
  // happen must not look like one that passed.
  test("NaN (an unreadable measurement) is refused, never treated as zero", () => {
    expect(accumulatedHistoryError(Number.NaN, Number.NaN)).not.toBeNull();
  });
});

describe("telemetry flush routing", () => {
  test("without an active PR the same aggregate is published and mirrored", () => {
    expect(chooseFlushRoute("drift-sweep", null)).toEqual({
      kind: "publish",
      activeRef: "heartbeat/drift-sweep",
      bufferRef: "heartbeat/drift-sweep-buffer",
    });
  });

  test("an active PR makes its head immutable and routes newer observations to the buffer", () => {
    const route = chooseFlushRoute("drift-sweep", {
      number: 14371,
      url: "https://example.test/pull/14371",
    });
    expect(route).toEqual({
      kind: "buffer",
      activeRef: "heartbeat/drift-sweep",
      bufferRef: "heartbeat/drift-sweep-buffer",
      blockedBy: { number: 14371, url: "https://example.test/pull/14371" },
    });
    expect(route.bufferRef).not.toBe(route.activeRef);
  });

  test("the buffer ref stays inside the protected heartbeat namespace", () => {
    expect(bufferRef("society")).toBe(`${stagingRef("society")}-buffer`);
  });

  // THE FALSIFIERS FOR 081M0X15SKR087G0R001RJP5V6.
  //
  // Measured 2026-08-25: all four telemetry-flush lanes were wedged at once behind heads
  // that had gone terminally red hours earlier and that nothing was ever going to re-run.
  // `drift-sweep` sat 11h; `data/platform-drift.json` on `main` was pinned at run
  // 32816944713 while the dashboard read green. Waiting on a dead head is deadlock, not
  // backpressure, and before this fix `chooseFlushRoute` could not tell the two apart --
  // it only ever asked "is a PR open".
  const DEAD_PR = { number: 15276, url: "https://example.test/pull/15276" };

  test("a TERMINALLY RED head is superseded, not waited on forever", () => {
    expect(chooseFlushRoute("drift-sweep", DEAD_PR, "dead")).toEqual({
      kind: "supersede",
      activeRef: "heartbeat/drift-sweep",
      bufferRef: "heartbeat/drift-sweep-buffer",
      supersedes: DEAD_PR,
    });
  });

  test("a live head is still waited on -- superseding is the exception, not the default", () => {
    expect(chooseFlushRoute("drift-sweep", DEAD_PR, "under-test").kind).toBe("buffer");
    // The default argument must be the SAFE one: a caller that cannot answer the verdict
    // must not accidentally acquire force-push behaviour.
    expect(chooseFlushRoute("drift-sweep", DEAD_PR).kind).toBe("buffer");
  });
});

describe("head verdict -- when is an open PR head still under test", () => {
  const check = (name: string, status: string, conclusion: string | null) => ({ name, status, conclusion });

  test("a queued or running check means the head is under test", () => {
    expect(classifyHeadVerdict([check("gate (required)", "queued", null)])).toBe("under-test");
    expect(classifyHeadVerdict([check("gate (required)", "in_progress", null)])).toBe("under-test");
  });

  test("all-green is under test -- a passing head is waited on, never replaced", () => {
    expect(
      classifyHeadVerdict([
        check("gate (required)", "completed", "success"),
        check("lint (TS)", "completed", "skipped"),
      ]),
    ).toBe("under-test");
  });

  test("no checks at all is under test, NOT dead", () => {
    // A head one second old has no scheduled runs yet. Calling that dead would supersede
    // every head immediately and reintroduce the starvation the buffer exists to prevent.
    expect(classifyHeadVerdict([])).toBe("under-test");
  });

  test("a failing check makes the head dead", () => {
    expect(classifyHeadVerdict([check("gate (required)", "completed", "failure")])).toBe("dead");
  });

  test("CANCELLED and TIMED_OUT are dead -- a check that never ran must not read as one still running", () => {
    // The measured cause on #15276: three lint shards exited 124 when the apt mirror
    // stalled inside the toolchain install. The lints themselves never executed.
    expect(classifyHeadVerdict([check("lint (semgrep)", "completed", "cancelled")])).toBe("dead");
    expect(classifyHeadVerdict([check("lint (semgrep)", "completed", "timed_out")])).toBe("dead");
  });

  test("a parked action_required run is dead -- it never contributes a verdict (081M010H4KE)", () => {
    expect(classifyHeadVerdict([check("gate (required)", "completed", "action_required")])).toBe("dead");
  });

  test("only the LATEST run per check name counts -- a repaired head is not still dead", () => {
    // A re-run appends a second check-run with the same name; the failing one stays in the
    // list. Reading every entry would supersede a head that has just gone green, which is
    // both wasteful and hides the repair.
    expect(
      classifyHeadVerdict([
        check("gate (required)", "completed", "failure"),
        check("gate (required)", "completed", "success"),
      ]),
    ).toBe("under-test");
  });
});

// The integration proof. `prepare` is a git-effect function, so the falsifier has
// to be real git. This reproduces a gate slower than the telemetry cadence: the
// active PR holds tick 1 while ticks 2..4 accumulate on the buffer, then tick 5
// promotes the complete aggregate after the active head lands.
describe("the flush lane buffers without invalidating an active PR (real git)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-flush-lane-"));
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  const g = (cwd: string, ...args: readonly string[]): string => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const r = spawnSync("git", [...args], { cwd, encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout.trim();
  };

  test("an open PR head is stable, every tick survives, and both refs stay bounded", () => {
    const originDir = join(tmp, "origin.git");
    const workDir = join(tmp, "work");
    const seedDir = join(tmp, "seed");

    g(tmp, "init", "--quiet", "--bare", originDir);
    g(tmp, "init", "--quiet", seedDir);
    g(seedDir, "config", "user.email", "lane@zeta.local");
    g(seedDir, "config", "user.name", "lane");
    writeFileSync(join(seedDir, "base.txt"), "base\n");
    g(seedDir, "add", "-A");
    g(seedDir, "commit", "--quiet", "-m", "base");
    g(seedDir, "branch", "-M", "main");
    g(seedDir, "push", "--quiet", originDir, "main");

    g(tmp, "clone", "--quiet", originDir, workDir);
    g(workDir, "config", "user.email", "lane@zeta.local");
    g(workDir, "config", "user.name", "lane");

    const appendTick = (i: number, refs: readonly string[]): string => {
      // ANOTHER AGENT lands on main between ticks, with genuinely different
      // governance fields. This is what leaked into PR #11528's commit list.
      g(workDir, "fetch", "--quiet", "origin", "main");
      g(workDir, "checkout", "--quiet", "-B", "other", "origin/main");
      writeFileSync(join(workDir, `other-${String(i)}.txt`), `other ${String(i)}\n`);
      g(workDir, "add", "-A");
      g(
        workDir,
        "commit",
        "--quiet",
        "-m",
        `feat: another agent's work ${String(i)}\n\nAgency-Signature-Version: 1\nCredential-Mode: shared\nAction-Mode: human-directed\n`,
      );
      g(workDir, "push", "--quiet", "origin", "other:main");

      // --- THE FUNCTION UNDER TEST, called for real. Not a re-implementation of
      // it: `prepare` operates on process.cwd(), so the test moves there rather
      // than copying its git calls, which would make the mutation unfalsifiable.
      const cwd = process.cwd();
      let prepared: number;
      try {
        process.chdir(workDir);
        prepared = prepare("lane");
      } finally {
        process.chdir(cwd);
      }
      expect(prepared).toBe(0);

      // --- the generator appends a tick frame
      const telemetryPath = join(workDir, "telemetry.json");
      let prior = "";
      try {
        prior = readFileSync(telemetryPath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
      writeFileSync(join(workDir, "telemetry.json"), `${prior}tick ${String(i)}\n`);

      // --- flush
      g(workDir, "add", "--", "telemetry.json");
      g(workDir, "commit", "--quiet", "-m", signedFlushMessage("metrics: append tick frame", "tick-metrics"));
      g(workDir, "push", "--quiet", "--force-with-lease", "origin", ...refs.map((ref) => `HEAD:refs/heads/${ref}`));
      return g(workDir, "rev-parse", "HEAD");
    };

    // First tick publishes one immutable PR head and mirrors the same aggregate.
    const firstActive = appendTick(1, ["heartbeat/lane-buffer", "heartbeat/lane"]);

    // While that PR is testing, only the buffer advances. The mutation this test
    // catches is pushing heartbeat/lane here, which changes firstActive.
    for (let i = 2; i <= 4; i++) {
      appendTick(i, ["heartbeat/lane-buffer"]);
      expect(g(workDir, "ls-remote", "origin", "refs/heads/heartbeat/lane").split(/\s/)[0]).toBe(firstActive);
    }

    // The immutable active PR lands with tick 1. The buffer still carries 1..4.
    g(workDir, "fetch", "--quiet", "origin", "main", "heartbeat/lane:refs/remotes/origin/heartbeat/lane");
    g(workDir, "checkout", "--quiet", "-B", "land-active", "origin/main");
    g(workDir, "merge", "--quiet", "--squash", "-X", "theirs", "origin/heartbeat/lane");
    g(workDir, "commit", "--quiet", "-m", "merge active telemetry");
    g(workDir, "push", "--quiet", "origin", "land-active:main");

    // No active PR now: prepare prefers the buffer, and the next publish mirrors
    // the complete aggregate to a new active head and the buffer.
    appendTick(5, ["heartbeat/lane-buffer", "heartbeat/lane"]);

    g(workDir, "fetch", "--quiet", "origin", "main");
    g(workDir, "fetch", "--quiet", "origin", "heartbeat/lane:refs/remotes/origin/heartbeat/lane");
    g(workDir, "fetch", "--quiet", "origin", "heartbeat/lane-buffer:refs/remotes/origin/heartbeat/lane-buffer");

    // Both branches are disposable one-commit aggregates, not growing ledgers.
    for (const ref of ["origin/heartbeat/lane", "origin/heartbeat/lane-buffer"]) {
      expect(g(workDir, "rev-list", "--count", `origin/main..${ref}`)).toBe("1");
      expect(g(workDir, "rev-list", "--count", "--merges", `origin/main..${ref}`)).toBe("0");
    }

    // The queued overlap is resolved toward the newer aggregate. Changing
    // prepare back to `-X ours` loses ticks 2..4 after tick 1 reaches main.
    expect(g(workDir, "show", "origin/heartbeat/lane:telemetry.json")).toBe("tick 1\ntick 2\ntick 3\ntick 4\ntick 5");
    expect(g(workDir, "show", "origin/heartbeat/lane-buffer:telemetry.json")).toBe(
      "tick 1\ntick 2\ntick 3\ntick 4\ntick 5",
    );

    // The squash preimage carries exactly ONE governance block, so no other
    // agent's `Credential-Mode: shared` can enter this PR's commit list.
    const preimage = g(workDir, "log", "origin/main..origin/heartbeat/lane", "--format=%B");
    const modes = [...preimage.matchAll(/^Credential-Mode: (.+)$/gm)].map((m) => m[1]);
    expect([...new Set(modes)]).toEqual(["dedicated-agent"]);
  }, 90_000);
});

// These lanes used to emit UNSIGNED commits, which the post-merge auditor could
// only pass via the explicit MACHINE-LANE-EXEMPT roster entry (#10573). Signing
// them makes them CORRECT instead of exempt, shrinking the exemption surface.
// THE REGRESSION FALSIFIER for the ~27% `pr-archive-on-merge` failure rate measured
// on 2026-08-25 (8 of 30 runs). A lane buffer is a DISPOSABLE AGGREGATE: every flush
// resets from `origin/main` and republishes, so the ref is REWRITTEN, not advanced.
// The calling workflows check out with `fetch-depth: 0`, so the remote-tracking ref
// is already populated when `prepare` runs. Fetching without a leading `+` then
// refuses the non-fast-forward update and `prepare` returns 3.
//
// Reproduced standalone before this test was written: `git fetch origin
// buf:refs/remotes/origin/buf --quiet` against a rewritten upstream exits 1 with
// EMPTY stdout and stderr -- byte-identical to the CI symptom, where `--quiet`
// suppressed the one report line naming the rejection.
//
// Drop the `+` in `flush-via-staging.ts` and this test goes red.
describe("prepare survives a REWRITTEN lane buffer (non-fast-forward)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-flush-nff-"));
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  const g = (cwd: string, ...args: readonly string[]): string => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const r = spawnSync("git", [...args], { cwd, encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout.trim();
  };

  test("a force-updated buffer is adopted rather than rejected", () => {
    const originDir = join(tmp, "origin.git");
    const workDir = join(tmp, "work");
    const seedDir = join(tmp, "seed");
    const lane = "nff";
    const buffer = bufferRef(lane);

    g(tmp, "init", "--quiet", "--bare", originDir);
    g(tmp, "init", "--quiet", seedDir);
    g(seedDir, "config", "user.email", "lane@zeta.local");
    g(seedDir, "config", "user.name", "lane");
    writeFileSync(join(seedDir, "base.txt"), "base\n");
    g(seedDir, "add", "-A");
    g(seedDir, "commit", "--quiet", "-m", "base");
    g(seedDir, "branch", "-M", "main");
    g(seedDir, "push", "--quiet", originDir, "main");

    // Generation 1 of the buffer.
    g(seedDir, "checkout", "--quiet", "-B", "buf", "main");
    writeFileSync(join(seedDir, "buf.txt"), "gen1\n");
    g(seedDir, "add", "-A");
    g(seedDir, "commit", "--quiet", "-m", "buffer gen 1");
    g(seedDir, "push", "--quiet", originDir, `buf:${buffer}`);

    // A FULL clone -- this is what `fetch-depth: 0` produces, and it is what makes
    // the local remote-tracking ref exist before the rewrite. Without this line the
    // defect is unreachable and the test would pass either way.
    g(tmp, "clone", "--quiet", originDir, workDir);
    g(workDir, "config", "user.email", "lane@zeta.local");
    g(workDir, "config", "user.name", "lane");
    const before = g(workDir, "rev-parse", `refs/remotes/origin/${buffer}`);

    // THE REWRITE: the next flush resets from main, so generation 2 is NOT a
    // descendant of what this clone already holds.
    g(seedDir, "checkout", "--quiet", "-B", "buf", "main");
    writeFileSync(join(seedDir, "buf.txt"), "gen2\n");
    g(seedDir, "add", "-A");
    g(seedDir, "commit", "--quiet", "-m", "buffer gen 2");
    g(seedDir, "push", "--quiet", "--force", originDir, `buf:${buffer}`);

    const cwd = process.cwd();
    let prepared: number;
    try {
      process.chdir(workDir);
      prepared = prepare(lane);
    } finally {
      process.chdir(cwd);
    }

    expect(prepared).toBe(0);

    // Not merely "did not fail": it adopted the NEW generation. Asserting only the
    // exit code would still pass if the fetch were dropped entirely.
    const after = g(workDir, "rev-parse", `refs/remotes/origin/${buffer}`);
    expect(after).not.toBe(before);
    expect(readFileSync(join(workDir, "buf.txt"), "utf8")).toBe("gen2\n");
  });
});

describe("AgencySignature on telemetry flushes", () => {
  test.each([...LANES])("%s: the block carries every required key", (lane) => {
    const block = agencySignatureBlock(lane);
    for (const key of REQUIRED_KEYS) {
      expect(block).toContain(`${key}:`);
    }
    expect(block).toContain("Co-authored-by:");
  });

  test.each([...LANES])("%s: the lane is named in the Agent field", (lane: string) => {
    expect(agencySignatureBlock(lane)).toContain(`Agent: ${lane}-flush-workflow`);
  });

  test("the canonical key spelling is used, not the Agent- twin", () => {
    const block = agencySignatureBlock("tick-metrics");
    expect(block).toContain("Agency-Signature-Version: 1");
    // MUTATION: this is the slip that reached main three times and was, until
    // #10573, exempt AND unsigned at once.
    expect(/^Agent-Signature-Version:/m.test(block)).toBe(false);
  });

  test("the block is CONTIGUOUS — no blank line may split it", () => {
    // git's trailer parser reads only the final blank-line-delimited paragraph,
    // so a blank line inside the block silently drops everything above it.
    expect(agencySignatureBlock("society")).not.toContain("\n\n");
  });

  test.each([...LANES])("%s: git itself parses every required key out of the flush message", (lane) => {
    // Not "the string contains the keys" — the PARSER is the witness. A block
    // that reads correctly and does not parse is the exact failure mode
    // (Trailer Contiguity Survival Failure).
    const trailers = parsedTrailers(signedFlushMessage("metrics: append tick frame", lane));
    for (const key of REQUIRED_KEYS) {
      expect(trailers).toContain(`${key}:`);
    }
  });

  test("MUTATION: a blank line inside the block makes git drop the keys above it", () => {
    // The falsifier for the contiguity test above — proves that test is testing
    // something, by constructing the failure it is meant to exclude.
    const broken = "metrics: append tick frame\n\nAgency-Signature-Version: 1\nAgent: x\n\nTask: none\n";
    const trailers = parsedTrailers(broken);
    expect(trailers).toContain("Task:");
    expect(trailers).not.toContain("Agency-Signature-Version:");
  });

  test("the signed message keeps the original subject as its first line", () => {
    // The PR title is built from the message's first line; signing must not
    // displace it.
    const msg = signedFlushMessage("metrics: append tick frame", "tick-metrics");
    expect(msg.split("\n")[0]).toBe("metrics: append tick frame");
  });

  test("signing does not smuggle in a CI-skip token", () => {
    // A skip token in the flush commit means `gate (required)` never runs and the
    // PR hangs unmergeable forever.
    expect(assertNoSkipCi(signedFlushMessage("metrics: append tick frame", "society"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// THE PUSH CREDENTIAL ON THE LANES THAT FLUSH THROUGH THIS TOOL (2026-08-16).
//
// `flush()` above runs `git push --force-with-lease origin HEAD:refs/heads/
// heartbeat/<lane>` with whatever credential the calling workflow's checkout
// persisted. That push's ACTOR decides whether `gate (required)` ever runs on the
// flush PR: a `pull_request` run whose triggering actor is `github-actions[bot]`
// is created and then parked — `completed`/`action_required` — so it never
// executes and never contributes a check.
//
// Measured on this tool's own lanes before the fix (2026-08-16):
//   heartbeat/tick-metrics  PR #10588 head c79a60c8 — 34 `pull_request` runs, ALL
//                           `completed/action_required`, actor=github-actions[bot];
//                           6 check-runs in the rollup, no gate row; open and
//                           unmergeable since 2026-08-14.
//   heartbeat/society       PR #10708 head 46ec2994 (2026-08-17) — 36/36 parked,
//                           same actor, 6 check-runs, no gate row, 964 parked runs
//                           on 2026-08-16 alone; MERGEABLE/BLOCKED with auto-merge
//                           already armed, i.e. the missing gate and nothing else.
// And the positive control, agent-heartbeat's lane after #10986 put the PAT on the
// checkout that pushes: `gate | pull_request | actor=AceHack`, 72 check-runs.
//
// THE CONTROL #11034 DECLARED WAS READ OUT, and it is why `society` moved into
// TREATED below. #11034 treated tick-metrics and left society byte-identical on
// purpose; the same-day real-tick reading, ~10 minutes apart on one repository:
//   heartbeat/tick-metrics 00:14Z + 00:32Z (TREATED)   gate actor=AceHack, EXECUTES
//   heartbeat/society      00:21Z (UNTREATED CONTROL)  gate actor=gh-actions[bot], PARKED
// One variable, two lanes, one hour. That is the attribution the control bought.
//
// THE MECHANISM, refined by what red-state showed (see UNTREATED): the run's actor
// is the identity that produced the event. A `pull_request` **opened** event comes
// from `gh pr create` (the PAT -> AceHack), so a lane whose flush PR lands every
// run always opens a fresh, executing PR. A **synchronize** event comes from the
// `git push`, so once a flush PR is stuck open, every subsequent flush is a
// GITHUB_TOKEN-actored synchronize and parks. That is self-sustaining: parked
// gate -> unmergeable PR -> never re-created -> next flush is another synchronize.
// Society sat in that loop for three days. The push credential is what breaks it.
//
// These assertions are the pin. Each one names the regression it catches, and the
// ORDERING assertion is the load-bearing one — #10913's fallback ran, logged that
// it ran, and was denied under the same identity, so a repair that is applied and
// never re-checked is indistinguishable from one that worked.
// ---------------------------------------------------------------------------

/** Lanes whose workflow has been given the verified push credential. */
const TREATED = [
  { lane: "tick-metrics", file: "tick-metrics.yml" },
  { lane: "society", file: "society-heartbeat.yml" },
] as const;

/**
 * Lanes deliberately still on the default credential, and WHY.
 *
 * This is not an oversight and the assertion below exists so it cannot decay into
 * one. #10850 broke three lanes at once for ~16.75h by changing them together, so
 * lanes are treated one at a time with a reading in between.
 *
 * `red-state` is NOT a control showing the defect — it is a lane where the defect
 * is LATENT, and saying so is the honest register. Measured 2026-08-17: 92
 * `pull_request` runs on `heartbeat/red-state`, only 12 parked and all 12 dated
 * 2026-08-14; every run since is `actor=AceHack` and executes. The reason is in
 * the mechanism note above — its flush PRs MERGE (#11067, #11010, #10872, #10870,
 * #10858 all landed on 2026-08-16), so each run opens a fresh PR under the PAT and
 * never reaches a synchronize push. The defect returns the moment one of its PRs
 * stalls, which is exactly how society entered its loop. Treat it on a stall, or
 * pre-emptively with its own before/after reading — do not treat it blind.
 *
 * WHEN YOU TREAT A LANE: move its entry from UNTREATED into TREATED in the same
 * commit as the yaml change, and record the before/after gate reading for that lane
 * in the PR. Do not simply delete the assertion — this list is a claim about what
 * we know, not paperwork.
 */
const UNTREATED = [{ lane: "red-state", file: "proof-closure-drift.yml" }] as const;

/**
 * The preflight step's body: from its `- name:` up to the next step's `- name:`.
 *
 * Sliced structurally rather than to a named following step — tick-metrics.yml has
 * `Install bun` next and society-heartbeat.yml has `Setup bun`, and hardcoding
 * either made the other lane's slice run to the end of the file, which silently
 * widens what the `not.toContain` assertions are looking at.
 */
function preflightOf(yaml: string): string {
  const start = yaml.indexOf("      - name: Preflight the push credential");
  if (start < 0) return "";
  const next = yaml.indexOf("\n      - name: ", start + 1);
  return next < 0 ? yaml.slice(start) : yaml.slice(start, next);
}

describe("telemetry-lane push credential (the held-gate cure)", () => {
  test("every lane that flushes through this tool is classified", () => {
    // A new lane added to LANES with no credential decision is the silent-default
    // failure: it inherits GITHUB_TOKEN and parks its gate, and nothing says so.
    const classified = [...TREATED, ...UNTREATED].map((l) => l.lane).sort();
    expect(classified).toEqual([...LANES].sort());
  });

  for (const { lane, file } of TREATED) {
    describe(`${lane} (${file})`, () => {
      const yaml = workflow(file);
      const preflight = preflightOf(yaml);

      // RE-AIMED 2026-08-25: this assertion PINNED THE DEFECT. It required the `||`
      // ladder verbatim, on the reasoning that a bare secret "would check out with an
      // empty credential and kill the lane". The ladder does not prevent that outage —
      // it RENAMES it. Checkout under GITHUB_TOKEN succeeds, so the lane looks alive
      // while pushing as `github-actions[bot]`, whose `pull_request` gate run is parked
      // in `action_required` and never contributes `gate (required)` — which is the
      // exact held-gate failure THIS DESCRIBE BLOCK IS NAMED AFTER, produced by the
      // very expression the test required. A dead lane is loud; that one is silent.
      //
      // "Would kill the lane" was an argument for a LOUD REFUSAL, and there was no third
      // option on the table then. There is now: an assert step ahead of the checkout
      // names the missing secret and the exact scope, so absence is handled without
      // handing the lane an authority nobody chose.
      test("the checkout that pushes carries the PAT — one role, one secret", () => {
        expect(yaml).toContain("token: ${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN }}");
        expect(yaml).toContain("persist-credentials: true");
        // No chain. This is the property the ladder assertion used to invert.
        expect(yaml).not.toMatch(/token: \$\{\{[^}]*secrets\.[A-Za-z_]\w*[^}]*\|\|[^}]*secrets\./);
      });

      test("ABSENCE is refused BY NAME, ahead of the checkout that would use it", () => {
        // The half the ladder was defended for, done loudly instead of silently.
        const assertAt = yaml.indexOf("      - name: Assert the branch-push credential is present");
        const checkoutAt = yaml.indexOf("      - name: Checkout");
        expect(assertAt).toBeGreaterThanOrEqual(0);
        // Ordering is load-bearing: after the checkout it would report on a step that
        // has already failed for another reason.
        expect(assertAt).toBeLessThan(checkoutAt);

        const guard = yaml.slice(assertAt, checkoutAt);
        expect(guard).toContain('if [ -z "${BRANCH_PUSH_TOKEN:-}" ]; then');
        expect(guard).toContain("::error title=Missing ZETA_TELEMETRY_FLUSH_TOKEN");
        // Actionable from the log line alone — the operator should not have to open
        // the workflow to learn which grant is missing.
        expect(guard).toContain("Contents: read and write");
        expect(guard).toContain("exit 1");
      });

      test("the preflight probes the REAL remote, not a stub", () => {
        // The UNAUTHORIZED half, which the `||` ladder cannot cover: #10850
        // shipped a token that was present and powerless. Only a real request to
        // the real remote distinguishes those — #10913 asserted this against a
        // stubbed git and died on its first real tick. `--dry-run` still performs
        // the authorization handshake.
        expect(preflight).toContain("git push --dry-run origin");
        // A `credprobe/` ref, never the live lane branch: HEAD is main and the
        // lane has diverged, so a permission answer would be indistinguishable
        // from a non-fast-forward ancestry answer.
        expect(preflight).toContain("refs/heads/credprobe/");
        expect(preflight).not.toContain("refs/heads/heartbeat/");
      });

      test("RE-PROBES after the swap, and the re-probe FOLLOWS it", () => {
        // Two probe sites = probe, then re-probe. Presence alone is not enough:
        // two probes prove nothing if both run BEFORE the credential is swapped,
        // so the ordering is asserted, not the count only.
        const probeCalls = preflight.match(/\$\(probe\)/g) ?? [];
        expect(probeCalls.length).toBeGreaterThanOrEqual(2);

        const swapIndex = preflight.indexOf("git config --local --replace-all");
        const reprobeIndex = preflight.indexOf("if OUT2=$(probe); then");
        expect(swapIndex).toBeGreaterThan(-1);
        expect(reprobeIndex).toBeGreaterThan(swapIndex);
      });

      test("swaps ONLY on a credential answer", () => {
        // Swapping on ANY failure would let a network blip silently re-point the
        // credential and hide a different fault behind a credential story.
        expect(preflight).toContain("denied to|Authentication failed|Invalid username or token|error: 403");
        expect(preflight).toContain("preflight inconclusive");
      });

      test("the degrade is loud, lane-attributed, and leaks no token", () => {
        // A silent degrade is the same defect class as the missing gate: a lane
        // that looks healthy and is not. The title carries THIS lane's name — a
        // copied block still saying `tick-metrics` would send the operator to the
        // wrong workflow while the annotation looked correct.
        expect(preflight).toContain(`::error title=${lane} PAT cannot push::`);
        expect(preflight).toContain(`::error title=${lane} has no working push credential::`);
        expect(preflight).toContain(`::warning title=${lane} preflight inconclusive::`);
        expect(preflight).toContain("::add-mask::");
        expect(preflight).not.toContain('echo "$FALLBACK_TOKEN"');
      });

      test("the probe ref is namespaced to THIS lane", () => {
        // Two lanes sharing one `credprobe/` ref would race their dry runs against
        // each other's ancestry rather than against the credential.
        expect(preflight).toContain(`refs/heads/credprobe/${lane}`);
      });
    });
  }

  for (const { lane, file } of UNTREATED) {
    test(`${lane} (${file}) is DECLARED untreated — see UNTREATED above`, () => {
      const yaml = workflow(file);
      expect(yaml).not.toContain("ZETA_TELEMETRY_FLUSH_TOKEN || secrets.GITHUB_TOKEN");
      expect(yaml).not.toContain("- name: Preflight the push credential");
    });
  }
});

/**
 * The archive step's `run:` block, sliced out of the raw workflow text with node
 * builtins only. Anchored on `max_attempts`, which appears in exactly one step,
 * then widened to the enclosing block by INDENTATION -- the same rule the YAML
 * reader would apply, without the dependency. Only the backoff is neutralised;
 * the control flow under test is untouched.
 */
function archiveRunBlock(text: string): string {
  const lines = text.split("\n");
  const anchor = lines.findIndex((l) => l.includes("max_attempts=5"));
  if (anchor < 0) return "";
  let start = anchor;
  while (start > 0 && !/^\s*run:\s*\|/.test(lines[start] ?? "")) start -= 1;
  const indent = (lines[start] ?? "").search(/\S/);
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() !== "" && line.search(/\S/) <= indent) break;
    body.push(line.replace(/^(\s*)sleep .*$/, "$1:"));
  }
  return body.join("\n");
}

// THE RETRY LOOP MUST ACTUALLY RETRY -- the falsifier for the third defect in
// 081M0X93WA4087G0R0034C1A5Q.
//
// `pr-archive-on-merge` announces five attempts. It got ONE. The step runs under
// `set -euo pipefail`; `flush` was guarded with `set +e`/`rc=$?`/`set -e` but
// `prepare` was not, so a non-zero `prepare` aborted the whole script on attempt 1
// and the backoff, the ::error annotation and its operator guidance were all
// unreachable. Observed on PR #15394 (twice) and PR #15428.
//
// This runs the WORKFLOW'S OWN SCRIPT -- extracted from the yaml, not retyped --
// against stubs where `prepare` always fails, so it cannot drift from what CI does.
// Remove the `set +e` around `prepare` and this test sees exactly one attempt.
describe("the pr-archive retry loop retries (the workflow's own script, real bash)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-retry-"));
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("a failing prepare retries to exhaustion instead of aborting on attempt 1", () => {
    // NO YAML PARSER HERE, and that is not a style choice. `pr-manifest-integrity.yml`
    // runs `bun test` over this directory with NO `bun install`, and says so:
    // "these tests import node builtins and repo-local modules only." A
    // devDependency import is therefore not a missing package, it is a broken
    // invariant -- and it fails in the worst possible shape. An earlier version of
    // this test imported `yaml` and produced
    // `error: Cannot find package 'yaml' from '...flush-via-staging.test.ts'`,
    // which drops EVERY test in this file from the run instead of failing one.
    // The suite reported 289 tests where it should have reported 331, and a
    // shrinking pass count reads like a green run.
    const script = archiveRunBlock(workflow("pr-archive-on-merge.yml"));

    // The extraction must be checked, or a bad slice yields an empty script that
    // runs, prints nothing, and passes nothing -- the vacuity this test exists to
    // catch, reintroduced in the harness.
    expect(script).toContain("max_attempts");
    expect(script).toContain("[archive] attempt");
    const scriptPath = join(tmp, "step.sh");
    writeFileSync(scriptPath, script);

    // `bun` fails exactly the way the lane failed in CI: exit 3 from `prepare`.
    const bin = join(tmp, "bin");
    mkdirSync(bin, { recursive: true });
    const mkbin = (name: string, body: string): void => {
      const f = join(bin, name);
      writeFileSync(f, body);
      chmodSync(f, 0o755);
    };
    mkbin("bun", '#!/usr/bin/env bash\nfor a in "$@"; do [ "$a" = "prepare" ] && exit 3; done\nexit 0\n');
    mkbin("git", "#!/usr/bin/env bash\nexit 0\n");

    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const r = spawnSync("bash", [scriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env["PATH"] ?? ""}`,
        PR_NUMBER: "15394",
        GITHUB_SHA_OVERRIDE: "deadbeef",
      },
    });
    const out = `${r.stdout}${r.stderr}`;

    // All five attempts happen. Without the guard only the first line appears.
    for (const n of [1, 2, 3, 4, 5]) {
      expect(out).toContain(`attempt ${String(n)}/5`);
    }
    // And the operator guidance -- previously unreachable -- actually fires.
    expect(out).toContain("::error title=Archive record could not be delivered");
  });
});
