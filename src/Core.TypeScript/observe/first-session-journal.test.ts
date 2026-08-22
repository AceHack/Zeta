/**
 * first-session-journal.test.ts — assert the ARTIFACT, never the transition.
 *
 * The failure this file is written against: `first-session.test.ts` is green and
 * proves nothing about whether a stranger's choice had an effect, because every
 * assertion in it is over `simulateFirstSession`, a pure function. A test that
 * asserts a pure state transition cannot distinguish "the action landed" from
 * "the action was a shape that does not do anything".
 *
 * So every test below opens the file. The question each one asks is: after a
 * real (non-dry-run) run, what is on disk, and does it read back as what
 * actually happened?
 *
 * Mutation-checked — each durable effect was broken (write skipped, path
 * changed, error swallowed, ordering key swapped) and a named test here failed.
 * See the PR body for the killed-mutant table.
 */

import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  JOURNAL_FILENAME,
  appendFirstSessionEvent,
  journalPathFor,
  readFirstSessionJournal,
  reconcileSessionRecord,
  replayFirstSession,
  type FirstSessionJournalEntry,
} from "./first-session-journal";
import { defaultNodeSession, foldFirstSession, type FirstSessionAction } from "./first-session";
import { parseArgs, runFirstSession, type RunOptions } from "./first-session-run";
import type { ShellRunner } from "./first-session-executor";

function tempDir(tag: string): string {
  return mkdtempSync(join(tmpdir(), `zeta-journal-${tag}-`));
}

function fakeRunner(overrides: Partial<ShellRunner>): ShellRunner {
  return {
    run: overrides.run ?? (() => ({ exitCode: 1 })),
    spawnInteractive: overrides.spawnInteractive ?? (() => ({ exitCode: 0 })),
    which: overrides.which ?? ((cmd) => (cmd === "gh" ? "/usr/bin/gh" : null)),
  };
}

/** `gh auth status` succeeds → the probe reports gh ready and the menu advances. */
function ghReadyRunner(): ShellRunner {
  return fakeRunner({
    run: (cmd, args) => (cmd === "gh" && args[0] === "auth" ? { exitCode: 0 } : { exitCode: 1 }),
  });
}

function silently<T>(fn: () => T | Promise<T>): Promise<{ value: T; log: string }> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  return Promise.resolve()
    .then(fn)
    .then((value) => ({ value, log: lines.join("\n") }))
    .finally(() => {
      console.log = original;
    });
}

const SKIP_GH: FirstSessionAction = {
  kind: "skip_credential",
  vendor: "gh",
  reason: "test skip",
};

/** The raw bytes on disk, split — deliberately NOT via readFirstSessionJournal. */
function rawLines(journalPath: string): string[] {
  return readFileSync(journalPath, "utf8").trim().split("\n");
}

/** Parse one raw line as the entry shape production writes. */
function parseLine(raw: string | undefined): FirstSessionJournalEntry {
  expect(raw).toBeTypeOf("string");
  return JSON.parse(raw ?? "") as FirstSessionJournalEntry;
}

// ─── 1. the append is a real file, with real bytes in it ─────────────────────

describe("appendFirstSessionEvent — the write happens, and the bytes are readable", () => {
  it("creates the file, the parent directory, and one parseable JSON line", () => {
    const journal = join(tempDir("append"), "nested", JOURNAL_FILENAME);
    expect(existsSync(journal)).toBe(false);

    const result = appendFirstSessionEvent(journal, SKIP_GH);

    expect(result.ok).toBe(true);
    // The artifact, not the return value: open it.
    expect(existsSync(journal)).toBe(true);
    const lines = rawLines(journal);
    expect(lines).toHaveLength(1);
    const parsed = parseLine(lines[0]);
    expect(parsed.seq).toBe(1);
    expect(parsed.action.kind).toBe("skip_credential");
    expect(parsed.action).toHaveProperty("vendor", "gh");
    expect(Number.isNaN(Date.parse(parsed.at))).toBe(false);
  });

  it("appends rather than overwrites — two events, two lines, seq 1 then 2", () => {
    const journal = join(tempDir("append2"), JOURNAL_FILENAME);
    appendFirstSessionEvent(journal, SKIP_GH);
    appendFirstSessionEvent(journal, { kind: "offer_cloud_helpers", reason: "test" });

    const lines = rawLines(journal);
    expect(lines).toHaveLength(2);
    expect(parseLine(lines[0]).seq).toBe(1);
    expect(parseLine(lines[1]).seq).toBe(2);
    expect(parseLine(lines[1]).action.kind).toBe("offer_cloud_helpers");
  });

  it("writes to the path it was given — the sibling of the marker, nowhere else", () => {
    const dir = tempDir("path");
    const marker = join(dir, "first-session-complete");
    const journal = journalPathFor(marker);

    appendFirstSessionEvent(journal, SKIP_GH);

    expect(journal).toBe(join(dir, JOURNAL_FILENAME));
    expect(existsSync(join(dir, JOURNAL_FILENAME))).toBe(true);
  });

  it("reports failure instead of throwing when the destination is unwritable", () => {
    const dir = tempDir("readonly");
    const journal = join(dir, "locked", JOURNAL_FILENAME);
    writeFileSync(join(dir, "locked"), "not a directory\n");

    // `locked` is a FILE, so mkdirSync/appendFileSync cannot make it a directory.
    const result = appendFirstSessionEvent(journal, SKIP_GH);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });
});

// ─── 2. read-back and replay ─────────────────────────────────────────────────

describe("readFirstSessionJournal / replayFirstSession — the record reads back", () => {
  it("a missing journal is an empty log, and replay refuses to invent a state", () => {
    const journal = join(tempDir("absent"), JOURNAL_FILENAME);
    expect(readFirstSessionJournal(journal).entries).toHaveLength(0);
    // undefined, NOT defaultNodeSession() — an honest unknown beats a fabricated
    // observation. This is the distinction the conductor's short-circuit needs.
    expect(replayFirstSession(journal)).toBeUndefined();
  });

  it("counts malformed lines instead of silently dropping them", () => {
    const journal = join(tempDir("malformed"), JOURNAL_FILENAME);
    appendFirstSessionEvent(journal, SKIP_GH);
    writeFileSync(journal, `${readFileSync(journal, "utf8")}{"not":"an entry"}\nnot json at all\n`);

    const read = readFirstSessionJournal(journal);
    expect(read.entries).toHaveLength(1);
    expect(read.malformedLines).toBe(2);
  });

  it("replay reproduces exactly the state the same actions produce in memory", () => {
    const journal = join(tempDir("roundtrip"), JOURNAL_FILENAME);
    const actions: FirstSessionAction[] = [
      { kind: "setup_credential", vendor: "gh", reason: "r" },
      { kind: "offer_cloud_helpers", reason: "r" },
      { kind: "skip_optional_credentials", reason: "r" },
      { kind: "complete_first_session", reason: "r" },
    ];
    for (const a of actions) appendFirstSessionEvent(journal, a);

    const replayed = replayFirstSession(journal);
    const inMemory = foldFirstSession(defaultNodeSession(), actions);

    expect(replayed).toEqual(inMemory);
    expect(replayed?.credentials.gh).toBe("ready");
    expect(replayed?.credentials.claude).toBe("skipped");
    expect(replayed?.complete).toBe(true);
  });

  it("orders the fold by seq, NEVER by the local `at` clock", () => {
    // Two entries whose wall-clock order is the REVERSE of their sequence — a
    // node whose clock stepped backwards mid-session. Folding by `at` would
    // apply the skip after the setup and report gh skipped.
    // (.claude/rules/local-time-never-enters-the-shared-fold.md)
    const journal = join(tempDir("clockskew"), JOURNAL_FILENAME);
    writeFileSync(
      journal,
      [
        JSON.stringify({
          seq: 1,
          at: "2026-08-18T12:00:00.000Z",
          action: { kind: "skip_credential", vendor: "gh", reason: "first" },
        }),
        JSON.stringify({
          seq: 2,
          at: "2026-08-18T11:00:00.000Z",
          action: { kind: "setup_credential", vendor: "gh", reason: "second" },
        }),
        "",
      ].join("\n"),
    );

    // seq order: skip then setup → the setup wins → "ready".
    expect(replayFirstSession(journal)?.credentials.gh).toBe("ready");
  });
});

// ─── 2b. observable-now vs chosen-then ───────────────────────────────────────

describe("reconcileSessionRecord — probe ready > recorded skipped > missing", () => {
  const probed = (gh: "missing" | "ready" | "skipped") => ({
    ...defaultNodeSession(),
    credentials: { ...defaultNodeSession().credentials, gh },
  });

  it("a live credential beats a remembered one — the probe wins on `ready`", () => {
    const recorded = {
      ...defaultNodeSession(),
      credentials: { ...defaultNodeSession().credentials, gh: "skipped" as const },
      complete: true,
    };
    expect(reconcileSessionRecord(probed("ready"), recorded).credentials.gh).toBe("ready");
  });

  it("a deliberate skip survives, because no probe can see the difference", () => {
    // probe = missing is identical for "chose to skip" and "never asked"; only
    // the record separates them, so the record supplies it.
    const recorded = {
      ...defaultNodeSession(),
      credentials: { ...defaultNodeSession().credentials, gh: "skipped" as const },
      complete: true,
    };
    expect(reconcileSessionRecord(probed("missing"), recorded).credentials.gh).toBe("skipped");
  });

  it("nothing chosen and nothing observed stays missing — no invention", () => {
    const recorded = { ...defaultNodeSession(), complete: true };
    expect(reconcileSessionRecord(probed("missing"), recorded).credentials.gh).toBe("missing");
  });

  it("cloudHelpersOffered comes from the record — nothing on disk implies it", () => {
    const recorded = { ...defaultNodeSession(), complete: true, cloudHelpersOffered: true };
    expect(reconcileSessionRecord(probed("ready"), recorded).cloudHelpersOffered).toBe(true);
  });
});

// ─── 3. the conductor actually writes it (the wiring, not the unit) ──────────

describe("runFirstSession — a real run leaves a real record of the real choices", () => {
  it("journals every applied action, in order, beside the marker", async () => {
    const dir = tempDir("run");
    const marker = join(dir, "first-session-complete");
    const opts: RunOptions = {
      ...parseArgs(["--demo", "--script", "skip-gh,offer-cloud,skip-optional,complete"]),
      runner: fakeRunner({}),
      home: "/home/zeta",
      markerPath: marker,
    };

    const { value: final } = await silently(() => runFirstSession(opts));
    expect(final.complete).toBe(true);

    const journal = journalPathFor(marker);
    expect(existsSync(journal)).toBe(true);
    const kinds = readFirstSessionJournal(journal).entries.map((e) => e.action.kind);
    expect(kinds).toEqual([
      "skip_credential",
      "offer_cloud_helpers",
      "skip_optional_credentials",
      "complete_first_session",
    ]);
  });

  it("--dry-run leaves NO journal — dry-run means no durable effects", async () => {
    const dir = tempDir("dryrun");
    const marker = join(dir, "first-session-complete");
    const opts: RunOptions = {
      ...parseArgs(["--demo", "--script", "setup-gh,local-only", "--dry-run"]),
      runner: fakeRunner({}),
      home: "/home/zeta",
      markerPath: marker,
    };

    await silently(() => runFirstSession(opts));

    expect(existsSync(marker)).toBe(false);
    expect(existsSync(journalPathFor(marker))).toBe(false);
  });

  it("a second run replays the record instead of fabricating an all-missing session", async () => {
    // This is the payoff, and the fix for a gap the previous author pinned:
    // the short-circuit used to return defaultNodeSession(), reporting gh
    // "missing" on a machine where gh was authenticated. Now it reads back
    // what the first run recorded.
    const dir = tempDir("replay");
    const marker = join(dir, "first-session-complete");
    const ghReady = ghReadyRunner();

    const first: RunOptions = {
      ...parseArgs(["--demo", "--script", "local-only"]),
      runner: ghReady,
      home: "/home/zeta",
      markerPath: marker,
    };
    await silently(() => runFirstSession(first));
    expect(existsSync(journalPathFor(marker))).toBe(true);

    const second: RunOptions = {
      ...parseArgs([]),
      runner: ghReady,
      home: "/home/zeta",
      markerPath: marker,
    };
    const { value: final, log } = await silently(() => runFirstSession(second));

    expect(log).toContain("zeta-first-session: already-complete");
    expect(final.complete).toBe(true);
    // The first run probed gh as ready and applied use_local_llm_only; the
    // replay must say so rather than reporting every credential missing.
    expect(final.credentials.gh).toBe("ready");
    expect(final.credentials.claude).toBe("skipped");
  });

  it("marker without a journal still short-circuits, and SAYS the credentials are unknown", async () => {
    // CI writes the marker with `echo` (agent-heartbeat.yml). No journal exists,
    // so the all-missing default is the only answer available — the requirement
    // is that it is announced rather than passed off as an observation.
    const dir = tempDir("nojournal");
    const marker = join(dir, "first-session-complete");
    writeFileSync(marker, "2026-07-08\n");

    const opts: RunOptions = {
      ...parseArgs([]),
      runner: ghReadyRunner(),
      home: "/home/zeta",
      markerPath: marker,
    };
    const { value: final, log } = await silently(() => runFirstSession(opts));

    expect(final.complete).toBe(true);
    expect(final.credentials.gh).toBe("missing");
    expect(log).toContain("already-complete no-journal");
  });

  it("a journal that cannot be written is reported, and does not strand the run", async () => {
    // The error path, exercised: finishing first login on a fresh machine must
    // outrank keeping the record of it — but a lost record is never silent.
    const dir = tempDir("unwritable");
    const marker = join(dir, "first-session-complete");
    // Occupy the journal's own path with a DIRECTORY: appendFileSync fails
    // (EISDIR) while the marker, a sibling, still writes normally. That
    // isolation is the point — only the journal write is broken.
    mkdirSync(journalPathFor(marker), { recursive: true });

    const opts: RunOptions = {
      ...parseArgs(["--demo", "--script", "skip-gh,complete"]),
      runner: fakeRunner({}),
      home: "/home/zeta",
      markerPath: marker,
    };
    const { value: final, log } = await silently(() => runFirstSession(opts));

    expect(log).toContain("journal-failed");
    // The person still got through their first login.
    expect(final.complete).toBe(true);
  });
});

// ─── 4. the guard on the guard ───────────────────────────────────────────────

describe("the journal records what was APPLIED, not what was chosen", () => {
  it("a setup that the vendor refuses is not journalled as a setup", async () => {
    // `gh` is absent from PATH → executeSetupCredential returns `failed` →
    // nothing was applied. A journal line here would be a durable lie: the log
    // would claim a credential step happened on a machine where it did not.
    const dir = tempDir("refused");
    const marker = join(dir, "first-session-complete");
    const opts: RunOptions = {
      ...parseArgs(["--demo", "--script", "setup-gh,skip-gh,complete"]),
      runner: fakeRunner({ which: () => null }),
      home: "/nonexistent-home",
      markerPath: marker,
    };

    await silently(() => runFirstSession(opts));

    const kinds = readFirstSessionJournal(journalPathFor(marker)).entries.map((e) => e.action.kind);
    expect(kinds).not.toContain("setup_credential");
    expect(kinds).toEqual(["skip_credential", "complete_first_session"]);
  });

  it("a setup the provider DOWNGRADES is journalled as the skip it became", async () => {
    // The case the "refused" test above does NOT reach. With auth mode `skip`,
    // the person chooses `setup_credential` and `executeSetupCredential` returns
    // `skipped` — so the applied action is a `skip_credential` and the chosen one
    // is not. Journalling the CHOSEN action here would durably record a GitHub
    // setup step on a node that never ran one, and `canSelfRegister` would then
    // read `ready` off a credential that does not exist.
    //
    // This test exists because a mutant that swapped `outcome.applied` for
    // `action` in the conductor survived the whole suite without it.
    const dir = tempDir("downgrade");
    const marker = join(dir, "first-session-complete");
    const previous = process.env.ZETA_IDENTITY_AUTH_MODE;
    process.env.ZETA_IDENTITY_AUTH_MODE = "skip";
    try {
      const opts: RunOptions = {
        ...parseArgs(["--demo", "--script", "setup-gh,complete"]),
        runner: fakeRunner({}),
        home: "/nonexistent-home",
        markerPath: marker,
      };
      const { value: final } = await silently(() => runFirstSession(opts));

      const entries = readFirstSessionJournal(journalPathFor(marker)).entries;
      expect(entries.map((e) => e.action.kind)).toEqual([
        "skip_credential",
        "complete_first_session",
      ]);
      // And the replayed record agrees with the session the live run reached —
      // gh skipped, never ready.
      expect(final.credentials.gh).toBe("skipped");
      expect(replayFirstSession(journalPathFor(marker))?.credentials.gh).toBe("skipped");
    } finally {
      if (previous === undefined) delete process.env.ZETA_IDENTITY_AUTH_MODE;
      else process.env.ZETA_IDENTITY_AUTH_MODE = previous;
    }
  });
});
