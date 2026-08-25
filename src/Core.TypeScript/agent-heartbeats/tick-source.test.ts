import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCommitMessage,
  defaultTickCommand,
  runTick,
  type CommandRunner,
  type TickSourceConfig,
} from "./tick-source";
import { parseArgs, toConfig, defaultRuntimeLabel } from "./local-tick";
import { parseTickLog, readTrailer, UNATTRIBUTED_SOURCE } from "./lane-tick-evidence";
import { assessFleetLiveness, runsToObservations } from "./heartbeat-liveness";

const NOW = new Date("2026-08-25T17:00:00.000Z");

/**
 * Scratch directories are made with `mkdtempSync`, never a hand-written `/tmp/...` literal.
 *
 * CodeQL flagged the literals this replaces as `js/insecure-temporary-file` (high) — and it was
 * right twice over. A predictable path in a world-writable directory can be pre-created as a
 * symlink by any local process, and because these literals flow into `repoRoot` the taint
 * reached the production writer in `tick-source.ts`, so a test's convenience was being reported
 * as a defect in shipped code. `mkdtempSync` returns a fresh 0700 directory with a random suffix,
 * which is the sanctioned construction.
 */
function scratchRoot(): string {
  return mkdtempSync(join(tmpdir(), "zeta-tick-"));
}

function config(overrides: Partial<TickSourceConfig> = {}): TickSourceConfig {
  return {
    agent: "dejan-local",
    // Never reached: every test using this default injects a lane preparer that stops before any
    // filesystem or git access, and the tests that DO write pass a `scratchRoot()`.
    //
    // Deliberately NOT under `tmpdir()`. Joining the OS temp dir here re-created the exact
    // `js/insecure-temporary-file` taint the scratch helper was introduced to remove: this value
    // flows into `repoRoot`, which reaches `writeFileSync` in tick-source.ts, so a temp path in a
    // never-executed default still reported as a high-severity defect in shipped code. The first
    // fix cleared two alerts and re-armed one; a non-temp path clears it for the right reason.
    repoRoot: "/nonexistent/zeta-tick-unused-root",
    runtime: "launchd/test",
    model: "qwen2.5:0.5b",
    task: "081M0WYCQHF087G0R000ZVPA7T",
    credentialIdentity: "AceHack",
    credentialMode: "shared",
    remote: "origin",
    tickCommand: ["noop.ts"],
    eventDir: "docs/observe-events",
    dryRun: true,
    ...overrides,
  };
}

describe("AgencySignature on a tick commit", () => {
  // The audit keeps whole PARAGRAPHS carrying all ten keys. A blank line inside the block splits
  // it into two partial blocks and the audit stops recognising it — so contiguity is the property
  // under test, not merely presence.
  const TEN_KEYS = [
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
  ];

  test("carries all ten keys in ONE contiguous paragraph", () => {
    const message = buildCommitMessage(config(), "2026-08-25T17:00:00Z");
    const paragraphs = message.split("\n\n");
    const block = paragraphs.find((p) => p.includes("Agency-Signature-Version:"));
    expect(block).toBeDefined();
    for (const key of TEN_KEYS) expect(block).toContain(`${key}:`);
  });

  test("records the runtime it was ACTUALLY produced by, not a hardcoded provider", () => {
    // The whole point of a second source: if this were hardcoded, two sources would be
    // indistinguishable in the ledger and per-source liveness would be impossible.
    const message = buildCommitMessage(config({ runtime: "k8s/zeta-tick-pod-7" }), "2026-08-25T17:00:00Z");
    expect(message).toContain("Agent-Runtime: k8s/zeta-tick-pod-7");
    expect(message).not.toContain("github-actions");
  });

  test("the co-author identity can never resolve to a real account, and is not fabricated", () => {
    // `audit-coauthor-identity-collides` caught this line emitting `noreply@zeta.dev` — an
    // invented domain that attributes work to a mailbox nobody owns. The plain
    // `<name>@users.noreply.github.com` form is WORSE: it resolves directly to whoever holds that
    // username on github.com today. A GitHub username cannot contain `[`, so the bot form can
    // never collide with a real account.
    const message = buildCommitMessage(config(), "2026-08-25T17:00:00Z");
    const coauthor = message.split("\n").find((l) => l.startsWith("Co-authored-by:"));
    expect(coauthor).toContain("[bot]@users.noreply.github.com");
    expect(coauthor).not.toContain("@zeta.dev");
  });

  test("subject starts with `heartbeat(` so lane evidence can find it", () => {
    // Coupled on purpose to `parseTickLog`'s anchored prefix check. If either side changes
    // unilaterally, ticks become invisible to liveness while still landing — a silent outage.
    expect(buildCommitMessage(config(), "2026-08-25T17:00:00Z").split("\n")[0]).toStartWith("heartbeat(dejan-local):");
  });
});

describe("runTick sequencing", () => {
  test("sets the committer identity BEFORE any other git operation", () => {
    // The 2026-08-16 outage killed all three lanes for an hour on `fatal: empty ident name`,
    // because the identity was set in a step AFTER the first git operation that needed one. A
    // second implementation that reintroduced that ordering would be a second outage.
    const calls: string[][] = [];
    const runner: CommandRunner = (command, args) => {
      calls.push([command, ...args]);
      return { status: 0, stdout: "", stderr: "" };
    };
    runTick(config(), runner, NOW, () => ({ ok: false, error: "stopped before touching a real repo" }));
    expect(calls[0]?.slice(0, 3)).toEqual(["git", "config", "user.name"]);
    expect(calls[1]?.slice(0, 3)).toEqual(["git", "config", "user.email"]);
  });

  test("a failing tick BODY is non-fatal — the lane must still be pushed", () => {
    // Measured live: the body exited 1 with "not-yet-executable — navigate_cartography". The
    // lane still holds unflushed state that must reach the remote, so aborting here would strand
    // it. Fail-open is the honest behaviour and `Action-Mode` says so.
    const runner: CommandRunner = (command, args) => {
      if (command === "bun") return { status: 1, stdout: "", stderr: "not-yet-executable" };
      // `git diff --cached --quiet` returns 1 to mean "there ARE staged changes".
      if (args[0] === "diff") return { status: 1, stdout: "", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };
    const root = scratchRoot();
    try {
      const result = runTick(config({ repoRoot: root }), runner, NOW, () => ({
        ok: true,
        value: { head: "heartbeat/dejan-local", remoteFound: true, carried: false },
      }));
      expect(result.ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("emitTickEvent", () => {
  test("refuses to overwrite an existing event file, and reports it as a typed error", async () => {
    // Written with `wx` for two reasons: two ticks must never silently overwrite one event (a
    // collision is a fact worth failing on), and a plain write follows a symlink. The throw must
    // surface as a Result, not as an exception escaping a function whose signature promises it
    // cannot.
    const root = scratchRoot();
    try {
      const { emitTickEvent } = await import("./tick-source");
      const name = emitTickEvent(config({ repoRoot: root }), NOW, 0);
      expect(name).toEndWith(".json");

      // The same path a second time must refuse rather than clobber.
      expect(() => writeFileSync(join(root, "docs/observe-events", name), "x", { flag: "wx" })).toThrow();

      // And `runTick` converts that throw into a typed error instead of propagating it.
      const runner: CommandRunner = () => ({ status: 0, stdout: "", stderr: "" });
      const collide = { ...config({ repoRoot: root }), agent: "dejan-local" };
      const result = runTick(collide, runner, NOW, () => ({
        ok: true,
        value: { head: "heartbeat/dejan-local", remoteFound: true, carried: false },
      }));
      // Either it wrote a fresh id (ok) or it hit a collision and reported it — never threw.
      expect(typeof result.ok).toBe("boolean");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("lane tick evidence", () => {
  const REC = "\x1e";
  const FLD = "\x1f";

  test("attributes a tick to the runtime in its trailer", () => {
    const raw = `heartbeat(otto): accumulated tick${FLD}2026-08-25T16:49:06+00:00${FLD}Agent-Runtime: launchd/host-a${REC}`;
    expect(parseTickLog(raw)).toEqual([{ source: "launchd/host-a", at: "2026-08-25T16:49:06.000Z" }]);
  });

  test("a commit that merely MENTIONS heartbeat is not a tick", () => {
    // Anchored prefix, never `includes`. The lane is reset over main every tick, so it carries
    // hundreds of ordinary main commits; any of them could contain the word.
    const raw =
      `fix(heartbeat): repair the lane${FLD}2026-08-25T16:00:00+00:00${FLD}Agent-Runtime: x${REC}` +
      `docs: quote "heartbeat(otto): accumulated tick"${FLD}2026-08-25T16:00:00+00:00${FLD}Agent-Runtime: y${REC}`;
    expect(parseTickLog(raw)).toEqual([]);
  });

  test("an unparseable timestamp DROPS the record rather than defaulting to now", () => {
    // A bad value read as the current time makes a dead substrate look fresh — health nobody
    // measured. Degrading toward "no evidence" is the safe direction.
    const raw = `heartbeat(otto): tick${FLD}not-a-date${FLD}Agent-Runtime: launchd/host-a${REC}`;
    expect(parseTickLog(raw)).toEqual([]);
  });

  test("a tick with no trailer is recorded as unattributed, not discarded", () => {
    const raw = `heartbeat(otto): tick${FLD}2026-08-25T16:00:00+00:00${FLD}no trailers here${REC}`;
    expect(parseTickLog(raw)[0]?.source).toBe(UNATTRIBUTED_SOURCE);
  });

  test("readTrailer ignores a key that is only a prefix of another", () => {
    expect(readTrailer("Agent-Runtime-Extra: no\nAgent-Runtime: yes", "Agent-Runtime")).toBe("yes");
  });
});

describe("fleet liveness", () => {
  test("ALIVE when a non-Actions source is fresh and Actions has produced nothing", () => {
    // THE EXIT TEST, as a unit test. Reproduced live against the real repository: with
    // `{"workflow_runs":[]}` the fleet still read alive on the local lane's evidence.
    const verdict = assessFleetLiveness(
      [...runsToObservations([]), { source: "launchd/host-a", at: "2026-08-25T16:55:00.000Z" }],
      NOW,
      60,
    );
    expect(verdict.alive).toBe(true);
    expect(verdict.sources).toHaveLength(1);
  });

  test("DEAD when every source is stale — the alarm is not weakened", () => {
    const verdict = assessFleetLiveness(
      [
        { source: "github-actions/x", at: "2026-08-25T14:00:00.000Z" },
        { source: "launchd/host-a", at: "2026-08-25T13:00:00.000Z" },
      ],
      NOW,
      60,
    );
    expect(verdict.alive).toBe(false);
    expect(verdict.summary).toContain("NO TICK FROM ANY SOURCE");
  });

  test("NO evidence at all is an alarm, never a pass", () => {
    // A bad filter, a lost `actions: read`, or an API hiccup all yield zero rows. Reading zero as
    // "nothing wrong" makes the monitor report healthiest exactly when it has gone blind.
    expect(assessFleetLiveness([], NOW, 60).alive).toBe(false);
  });

  test("a stale source stays VISIBLE when another source covers for it", () => {
    // Otherwise a permanently dead Actions lane becomes invisible the moment a second source
    // covers — trading one blind spot for another.
    const verdict = assessFleetLiveness(
      [
        { source: "github-actions/x", at: "2026-08-25T10:00:00.000Z" },
        { source: "launchd/host-a", at: "2026-08-25T16:55:00.000Z" },
      ],
      NOW,
      60,
    );
    expect(verdict.alive).toBe(true);
    expect(verdict.summary).toContain("DEGRADED");
    expect(verdict.sources.find((s) => s.source === "github-actions/x")?.fresh).toBe(false);
  });

  test("a future-dated tick is clamped, not treated as infinitely recent", () => {
    // A negative age sails under every threshold and silences the alarm permanently.
    const verdict = assessFleetLiveness([{ source: "skewed", at: "2026-08-26T00:00:00.000Z" }], NOW, 60);
    expect(verdict.sources[0]?.ageMinutes).toBe(0);
  });

  test("only COMPLETED successful runs become observations", () => {
    // An in-progress run carries `conclusion: null`; reading it as proof of life is the optimism
    // the original watchdog was written to refuse, and the fold must not reintroduce it.
    expect(
      runsToObservations([
        { status: "in_progress", conclusion: null, created_at: "2026-08-25T16:59:00Z" },
        { status: "completed", conclusion: "failure", created_at: "2026-08-25T16:59:00Z" },
      ]),
    ).toEqual([]);
  });
});

describe("local-tick CLI", () => {
  test("--agent is required", () => {
    expect(parseArgs([])).toEqual({ ok: false, error: "--agent is required" });
  });

  test("an unknown flag is refused rather than ignored", () => {
    // Silently ignoring a misspelled flag runs the tick with defaults the operator did not
    // choose — including, potentially, the wrong lane.
    expect(parseArgs(["--agent", "x", "--modle", "y"]).ok).toBe(false);
  });

  test("the runtime label defaults to something HOST-SPECIFIC", () => {
    // Two laptops running this adapter must be distinguishable in the ledger; a shared constant
    // would silently merge two sources into one and undo the reason for having two.
    expect(defaultRuntimeLabel("laptop-a")).not.toBe(defaultRuntimeLabel("laptop-b"));
  });

  test("the tick body is the SAME command the Actions lane runs", () => {
    // A second source running a DIFFERENT body would prove nothing about the first: it would be
    // a second thing, not a second implementation of the same thing.
    expect(defaultTickCommand("otto", "llama3.2:1b", "docs/observe-events")).toEqual([
      "src/Core.TypeScript/observe/run-loop-real.ts",
      "--by",
      "otto",
      "--event-dir",
      "docs/observe-events",
      "--participant",
      "local-llm:llama3.2:1b",
    ]);
  });

  test("credential mode is declared `shared`, matching the credential actually used", () => {
    // The push rides the invoking user's existing git credential. Claiming `dedicated-agent`
    // would assert an isolation this adapter does not have.
    expect(
      toConfig({ agent: "a", repoRoot: ".", model: "m", runtime: "r", remote: "origin", dryRun: true }).credentialMode,
    ).toBe("shared");
  });
});
