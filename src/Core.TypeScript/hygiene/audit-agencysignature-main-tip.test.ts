import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  CANONICAL_VERSION_KEY,
  FAIL_CLOSED_CUTOVER_DEFAULT,
  MISSPELLED_VERSION_KEY,
  type CommitRecord,
  classifyCommitRecord,
  coauthorEmails,
  hasAgencySignature,
  hasAgencySignatureV1,
  hasAgencySignatureV2,
  hasAgentCoauthorSignal,
  hasAgentCoauthorTrailer,
  hasMisspelledVersionTrailer,
  loadIdentityRoster,
  main,
  parseIdentityRoster,
  V1_SHIP_DATE_DEFAULT,
  V1_SHIP_SHA_DEFAULT,
} from "./audit-agencysignature-main-tip";

/**
 * A COMPLETE, VALID block — all ten keys, contiguous, canonical values.
 *
 * The fixtures below used to be two-key stubs (`Agency-Signature-Version: 1` +
 * `Agent:`), which passed only because the auditor's entire notion of "signed"
 * was a regex for the version key. It now shares `validateBlock` with the
 * pre-merge gate, which has always required all ten — so a stub is honestly
 * INVALID-VALUES, and a test asserting CORRECT needs a real block. Both facts
 * are pinned: the real block below, and the stub's new status in the
 * taxonomy tests.
 */
const VALID_BLOCK = [
  `${CANONICAL_VERSION_KEY}: 1`,
  "Agent: the shadow",
  "Agent-Runtime: Claude Code",
  "Agent-Model: claude-opus-5",
  "Credential-Identity: AceHack via gh",
  "Credential-Mode: dedicated-agent",
  "Human-Review: not-implied-by-credential",
  "Human-Review-Evidence: none",
  "Action-Mode: supervised",
  "Task: none",
].join("\n");

describe("hasAgentCoauthorTrailer", () => {
  test.each([
    "Co-authored-by: Claude <noreply@anthropic.com>",
    "Co-Authored-By: Codex <noreply@openai.com>",
    "Co-authored-by: Grok <noreply@x.ai>",
    "Co-Authored-By: Gemini <noreply@google.com>",
    "Co-authored-by: Kiro <noreply@kiro.dev>",
    "Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>",
  ])("detects the agent trailer %s", (trailer) => {
    expect(hasAgentCoauthorTrailer(trailer)).toBe(true);
  });

  test("does not treat an ordinary human co-author as an agent signal", () => {
    expect(hasAgentCoauthorTrailer("Co-authored-by: Ada <ada@example.com>")).toBe(false);
  });
});

describe("hasAgencySignatureV1", () => {
  test("detects a signature block before a GitHub-appended co-author trailer", () => {
    const message = `feat(vision): add forecast scheduler wrapper (#8096)

Agency-Signature-Version: 1
Agent: Vera
Task: none

Co-authored-by: Codex <noreply@openai.com>
`;

    expect(hasAgencySignatureV1(message)).toBe(true);
  });

  test("detects the compact AgencySignature-v1 block used by current squash commits", () => {
    const message = `feat(core): name no-forget bounded gset policy (#8986)

Co-Authored-By: Codex <noreply@openai.com>

AgencySignature-v1:
  persona: vera
  actor: zeta-vera
`;

    expect(hasAgencySignatureV1(message)).toBe(true);
  });
});

describe("hasAgentCoauthorSignal", () => {
  test("falls back to the full commit message when parsed terminal trailers drop Co-Authored-By", () => {
    const parsedTrailers = `AgencySignature-v1: persona: vera actor: zeta-vera`;
    const message = `feat(core): name no-forget bounded gset policy (#8986)

Co-Authored-By: Codex <noreply@openai.com>

AgencySignature-v1:
  persona: vera
`;

    expect(hasAgentCoauthorSignal(parsedTrailers, message)).toBe(true);
  });
});

describe("hasAgencySignatureV2 (ADR phase 4 — Cell trailer)", () => {
  const v2Message = `feat(identity): wire cell trailer (#9999)

Agency-Signature-Version: 2
Agent: otto
Persona: otto
Cell: cowork/main@machine-a
Task: none
`;

  test("detects a v2 block", () => {
    expect(hasAgencySignatureV2(v2Message)).toBe(true);
    expect(hasAgencySignature(v2Message)).toBe(true);
  });

  test("v2 block is NOT v1 (version share must be observable for the phase-8 contract)", () => {
    expect(hasAgencySignatureV1(v2Message)).toBe(false);
  });

  test("v1 block is not v2", () => {
    const v1 = "Agency-Signature-Version: 1\nAgent: Vera\n";
    expect(hasAgencySignatureV2(v1)).toBe(false);
    expect(hasAgencySignature(v1)).toBe(true);
  });

  test("version 12 or 21 does not false-positive either matcher (word boundary)", () => {
    expect(hasAgencySignatureV1("Agency-Signature-Version: 12\n")).toBe(false);
    expect(hasAgencySignatureV2("Agency-Signature-Version: 21\n")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FAIL-CLOSED — 081M003VH9B087G0R002WXK2HD / PR #10564
//
// The audit exempted the fleet's own personas as HUMAN-AUTHORED. Every test
// below is a FALSIFIER: each one PASSES under the old fail-open rule and must
// FAIL under the new one. Verified A/B against the pre-fix file on 2026-08-14 —
// six planted commits, old exit 0 / HUMAN-AUTHORED-EXEMPT, new exit 1 /
// REGRESSION for all six.
// ---------------------------------------------------------------------------

const SHIP_TS = Math.floor(Date.parse("2026-04-26T00:00:00Z") / 1000);
const CUTOVER_TS = Math.floor(Date.parse(FAIL_CLOSED_CUTOVER_DEFAULT) / 1000);
const POST = CUTOVER_TS + 86_400;
const PRE = CUTOVER_TS - 86_400;

function record(over: Partial<CommitRecord> & { message: string }): CommitRecord {
  return {
    trailers: "",
    timestamp: POST,
    isoDate: "2026-08-16T00:00:00Z",
    // The squash-merge shape: GitHub attributes an AGENT pull request to the
    // merging human's account. 155 of the last 300 commits on origin/main look
    // exactly like this, which is why the author field is never a human signal.
    authorEmail: "aaron_bond@yahoo.com",
    committerEmail: "noreply@github.com",
    ...over,
  };
}

function classify(over: Partial<CommitRecord> & { message: string }) {
  return classifyCommitRecord(
    record(over),
    SHIP_TS,
    "2026-04-26T00:00:00Z",
    CUTOVER_TS,
    loadIdentityRoster(),
  );
}

describe("identity roster", () => {
  test("the shipped roster parses and carries both the human and the machine lanes", () => {
    const roster = loadIdentityRoster();
    expect(roster.humans.has("578953+acehack@users.noreply.github.com")).toBe(true);
    expect(roster.machineLanes.has("github-actions[bot]@users.noreply.github.com")).toBe(true);
    // The roster is an EXEMPTION list, never an agent allowlist. No persona of
    // ours may appear on it — that would restore the fail-open default.
    for (const email of [...roster.humans, ...roster.machineLanes]) {
      expect(email.endsWith("@zeta.agents")).toBe(false);
      expect(email.endsWith("@zeta.local")).toBe(false);
    }
  });

  test("a malformed roster is a hard error, never a silently-empty one", () => {
    expect(() => parseIdentityRoster("{}")).toThrow();
    expect(() => parseIdentityRoster('{"humans":[{"name":"x"}],"machineLanes":[]}')).toThrow();
    expect(() => parseIdentityRoster('{"humans":[],"machineLanes":[]}')).not.toThrow();
  });
});

describe("coauthorEmails", () => {
  test("extracts every address, lowercased, case-insensitively on the key", () => {
    expect(
      coauthorEmails(
        "x\n\nCo-authored-by: The Shadow <Shadow@Zeta.Agents>\nCo-Authored-By: Codex <noreply@openai.com>\n",
      ),
    ).toEqual(["shadow@zeta.agents", "noreply@openai.com"]);
  });

  test("a trailer with no angle brackets yields the raw value, which matches no roster row", () => {
    expect(coauthorEmails("x\n\nCo-authored-by: someone\n")).toEqual(["someone"]);
    expect(classify({ message: "x\n\nCo-authored-by: someone\n" }).status).toBe("REGRESSION");
  });
});

describe("fail-closed classification (the falsifiers)", () => {
  test("MUTATION: a Zeta-native persona with no AgencySignature is a REGRESSION", () => {
    const result = classify({
      message: "feat: something\n\nCo-authored-by: the shadow <shadow@zeta.agents>\n",
    });
    expect(result.status).toBe("REGRESSION");
    expect(result.reason).toContain("shadow@zeta.agents");
  });

  test.each([
    ["Dejan <dejan@zeta.local>"],
    ["Soraya <soraya@zeta.agents>"],
    ["Otto <otto@zeta.agents>"],
    ["Shadow <shadow@zeta.local>"],
    // The point of fail-CLOSED: a persona that does not exist yet is red on the
    // day it first commits, without anyone editing this file.
    ["Nyx <nyx@zeta.agents>"],
    ["Somebody <nobody@example.invalid>"],
  ])("MUTATION: unsigned commit co-authored %s is a REGRESSION", (who) => {
    expect(classify({ message: `feat: x\n\nCo-authored-by: ${who}\n` }).status).toBe(
      "REGRESSION",
    );
  });

  test("MUTATION: no Co-authored-by at all is a REGRESSION — absence is not a human signal", () => {
    // Live shape: 7 of the last 300 commits on origin/main carry no
    // Co-authored-by and are plainly agent squash-merges (#10368, #10410, …).
    const result = classify({ message: "fix: bound Ollama calls and ensure process exits (#10368)\n" });
    expect(result.status).toBe("REGRESSION");
    expect(result.reason).toContain("absence is not a human signal");
  });

  test("MUTATION: the git author field alone never exempts, however human it looks", () => {
    expect(
      classify({
        message: "feat: x\n\nCo-authored-by: the shadow <shadow@zeta.agents>\n",
        authorEmail: "aaron_bond@yahoo.com",
        committerEmail: "aaron_bond@yahoo.com",
      }).status,
    ).toBe("REGRESSION");
  });

  test("MUTATION: one unlisted co-author kills a roster exemption (closure)", () => {
    // Otherwise `Co-authored-by: github-actions[bot]` could be bolted onto an
    // agent commit to buy the machine-lane exemption.
    expect(
      classify({
        message:
          "feat: x\n\nCo-authored-by: AceHack <578953+AceHack@users.noreply.github.com>\nCo-authored-by: the shadow <shadow@zeta.agents>\n",
      }).status,
    ).toBe("REGRESSION");
    expect(
      classify({
        message:
          "feat: x\n\nCo-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>\nCo-authored-by: the shadow <shadow@zeta.agents>\n",
      }).status,
    ).toBe("REGRESSION");
  });

  test("MUTATION: a bot that is not on the roster is not silently exempt", () => {
    expect(
      classify({
        message:
          "chore: x\n\nCo-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>\n",
      }).status,
    ).toBe("REGRESSION");
    expect(
      classify({ message: "chore: x\n", authorEmail: "dependabot[bot]@users.noreply.github.com" })
        .status,
    ).toBe("REGRESSION");
  });

  test("the POSITIVE human signal: every co-author on the human roster exempts", () => {
    expect(
      classify({
        message: "feat: x\n\nCo-authored-by: AceHack <578953+AceHack@users.noreply.github.com>\n",
      }).status,
    ).toBe("HUMAN-ROSTER-EXEMPT");
  });

  test("the machine lanes are exempt EXPLICITLY, by name, not by fall-through", () => {
    expect(
      classify({
        message:
          "archive(pr-reviews): PR #10561\n\nCo-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>\n",
      }).status,
    ).toBe("MACHINE-LANE-EXEMPT");
    expect(
      classify({
        message: "metrics: append tick frame [skip ci]\n",
        authorEmail: "github-actions[bot]@users.noreply.github.com",
        committerEmail: "github-actions[bot]@users.noreply.github.com",
      }).status,
    ).toBe("MACHINE-LANE-EXEMPT");
    expect(
      classify({
        message: "society: evolution tick\n",
        authorEmail: "society[bot]@users.noreply.github.com",
        committerEmail: "society[bot]@users.noreply.github.com",
      }).status,
    ).toBe("MACHINE-LANE-EXEMPT");
  });

  test("a signed commit is CORRECT whoever co-authored it", () => {
    expect(
      classify({
        // `trailers` is what `git log --pretty=%(trailers)` returns — supplied
        // because this test is about the CO-AUTHOR rule, not the parse route.
        // With it empty the honest answer is RECOVERED-MALFORMED, which the
        // taxonomy tests below pin separately.
        trailers: `${VALID_BLOCK}\nCo-authored-by: the shadow <shadow@zeta.agents>\n`,
        message: `feat: x\n\n${VALID_BLOCK}\nCo-authored-by: the shadow <shadow@zeta.agents>\n`,
      }).status,
    ).toBe("CORRECT");
  });

  test("GRANDFATHER: the same persona commit BEFORE the cutover keeps its legacy status", () => {
    const result = classifyCommitRecord(
      record({
        message: "feat: x\n\nCo-authored-by: the shadow <shadow@zeta.agents>\n",
        timestamp: PRE,
      }),
      SHIP_TS,
      "2026-04-26T00:00:00Z",
      CUTOVER_TS,
      loadIdentityRoster(),
    );
    expect(result.status).toBe("HUMAN-AUTHORED-EXEMPT");
  });

  test("GRANDFATHER: a pre-cutover vendor-agent commit is still a REGRESSION (no red removed)", () => {
    expect(
      classifyCommitRecord(
        record({
          message: "feat: x\n\nCo-authored-by: Codex <noreply@openai.com>\n",
          timestamp: PRE,
        }),
        SHIP_TS,
        "2026-04-26T00:00:00Z",
        CUTOVER_TS,
        loadIdentityRoster(),
      ).status,
    ).toBe("REGRESSION");
  });
});

describe(`the ${MISSPELLED_VERSION_KEY} misspelling`, () => {
  test("is detected", () => {
    expect(hasMisspelledVersionTrailer("Agent-Signature-Version: 1\n")).toBe(true);
    expect(hasMisspelledVersionTrailer("Agency-Signature-Version: 1\n")).toBe(false);
    // Not the version key at all — the v1 block legitimately contains
    // `Agent:` and `Agent-Runtime:`; only the version key is the misspelling.
    expect(hasMisspelledVersionTrailer("Agent-Runtime: claude-code\n")).toBe(false);
  });

  test("MUTATION: a block carrying ONLY the misspelling is a REGRESSION that NAMES it", () => {
    // Live on main 2026-08-13/14: 174bcd0891, 1930217660, 90e1d6a8c5 were
    // exempt AND unsigned at once.
    const result = classify({
      message: `fix(chaos): x\n\nAgent-Persona: the shadow\n${MISSPELLED_VERSION_KEY}: 1\n\nCo-authored-by: the shadow <shadow@zeta.agents>\n`,
    });
    expect(result.status).toBe("REGRESSION");
    expect(result.reason).toContain(MISSPELLED_VERSION_KEY);
    expect(result.reason).toContain(CANONICAL_VERSION_KEY);
  });

  test("the canonical key wins when both spellings are present", () => {
    expect(
      classify({
        trailers: `${MISSPELLED_VERSION_KEY}: 1\n${VALID_BLOCK}\nCo-authored-by: the shadow <shadow@zeta.agents>\n`,
        message: `fix: x\n\n${MISSPELLED_VERSION_KEY}: 1\n${VALID_BLOCK}\nCo-authored-by: the shadow <shadow@zeta.agents>\n`,
      }).status,
    ).toBe("CORRECT");
  });
});

// ---------------------------------------------------------------------------
// End-to-end: plant commits in a throwaway repository and run `main`. This is
// the literal acceptance — "a mutation must turn it red" — against real git
// plumbing rather than a hand-built record.
// ---------------------------------------------------------------------------

interface Planted {
  readonly subject: string;
  readonly body: string;
  readonly date: string;
  readonly expected: string;
}

const PLANTED: readonly Planted[] = [
  {
    subject: "m1 zeta persona unsigned",
    body: "Co-authored-by: the shadow <shadow@zeta.agents>",
    date: "2026-08-20T00:01:00Z",
    expected: "REGRESSION",
  },
  {
    subject: "m2 never seen persona unsigned",
    body: "Co-authored-by: Nyx <nyx@zeta.agents>",
    date: "2026-08-20T00:02:00Z",
    expected: "REGRESSION",
  },
  {
    subject: "m3 no coauthor at all",
    body: "Refs: none",
    date: "2026-08-20T00:03:00Z",
    expected: "REGRESSION",
  },
  {
    subject: "m4 misspelled version key only",
    body: `${MISSPELLED_VERSION_KEY}: 1\nCo-authored-by: the shadow <shadow@zeta.agents>`,
    date: "2026-08-20T00:04:00Z",
    expected: "REGRESSION",
  },
  {
    // The sharpest misspelling falsifier: an ON-ROSTER co-author, so nothing
    // ELSE can redden it. Only the misspelling detector can, and if that
    // detector is removed this row silently becomes HUMAN-ROSTER-EXEMPT.
    subject: "m4b misspelled version key with a roster co-author",
    body: `${MISSPELLED_VERSION_KEY}: 1\nCo-authored-by: AceHack <578953+AceHack@users.noreply.github.com>`,
    date: "2026-08-20T00:04:30Z",
    expected: "REGRESSION",
  },
  {
    subject: "m5 unlisted bot",
    body: "Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>",
    date: "2026-08-20T00:05:00Z",
    expected: "REGRESSION",
  },
  {
    subject: "c1 human roster only",
    body: "Co-authored-by: AceHack <578953+AceHack@users.noreply.github.com>",
    date: "2026-08-20T00:06:00Z",
    expected: "HUMAN-ROSTER-EXEMPT",
  },
  {
    subject: "c2 machine lane",
    body: "Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>",
    date: "2026-08-20T00:07:00Z",
    expected: "MACHINE-LANE-EXEMPT",
  },
  {
    subject: "c3 signed persona",
    body: `${VALID_BLOCK}\nCo-authored-by: the shadow <shadow@zeta.agents>`,
    date: "2026-08-20T00:08:00Z",
    expected: "CORRECT",
  },
  {
    subject: "c4 pre cutover persona grandfathered",
    body: "Co-authored-by: the shadow <shadow@zeta.agents>",
    date: "2026-08-10T00:00:00Z",
    expected: "HUMAN-AUTHORED-EXEMPT",
  },
];

describe("end-to-end against real git", () => {
  let repo = "";
  let exitCode = 2;
  let output = "";

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "zeta-agsig-"));
    const env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    };
    const git = (args: readonly string[], extra: Record<string, string> = {}): void => {
      // eslint-disable-next-line sonarjs/no-os-command-from-path
      const r = spawnSync("git", args, { cwd: repo, env: { ...env, ...extra }, encoding: "utf8" });
      if ((r.status ?? 1) !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    };
    const commit = (subject: string, body: string, date: string): void => {
      git(
        ["commit", "-q", "--allow-empty", "-m", subject, "-m", body],
        { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
      );
    };

    git(["-c", "init.defaultBranch=main", "init", "-q", "."]);
    git(["config", "user.name", "Aaron Stainback"]);
    git(["config", "user.email", "aaron_bond@yahoo.com"]);
    git(["config", "commit.gpgsign", "false"]);
    // Anchor establishes the v1 ship date. All trailers contiguous, or git's
    // own trailer parser drops everything above the last block.
    commit(
      "chore: v1 anchor",
      `${CANONICAL_VERSION_KEY}: 1\nAgent: otto\nTask: none\nCo-authored-by: Claude <noreply@anthropic.com>`,
      "2026-08-01T00:00:00Z",
    );
    for (const p of PLANTED) commit(p.subject, p.body, p.date);

    const cwd = process.cwd();
    const write = process.stdout.write.bind(process.stdout);
    const chunks: string[] = [];
    try {
      process.chdir(repo);
      (process.stdout as { write: (s: string) => boolean }).write = (s: string): boolean => {
        chunks.push(s);
        return true;
      };
      exitCode = main(["--max", String(PLANTED.length)]);
    } finally {
      (process.stdout as { write: typeof write }).write = write;
      process.chdir(cwd);
    }
    output = chunks.join("");
  });

  afterAll(() => {
    if (repo !== "") rmSync(repo, { recursive: true, force: true });
  });

  test("the planted mutations turn the audit RED", () => {
    expect(exitCode).toBe(1);
  });

  test.each(PLANTED.map((p) => [p.subject, p.expected] as const))(
    "%s is classified %s",
    (subject, expected) => {
      const line = output
        .split("\n")
        .find((l) => l.trimEnd().endsWith(`— ${subject}`));
      expect(line).toBeDefined();
      expect(line ?? "").toContain(`[${expected}`);
    },
  );

  test("the summary reports each bucket, so an exemption is countable not invisible", () => {
    expect(output).toContain("HUMAN-ROSTER-EXEMPT:    1");
    expect(output).toContain("MACHINE-LANE-EXEMPT:    1");
    expect(output).toContain("REGRESSION:             6");
  });
});

// ---------------------------------------------------------------------------
// The v1 ship anchor. Two defects lived here, both of the "check that quietly
// stops checking" class, and both are falsifiable:
//
//  1. SLIDING WINDOW. `detectV1Ship` walked `--reverse --max-count=5000`, and
//     git applies max-count BEFORE reversing — so it only ever saw the newest
//     5000 commits. `main` passed 5000 (6772 on 2026-08-14), so the reported
//     ship date had drifted 13 days forward of the truth (2026-06-10 vs the
//     real 2026-05-28), silently reclassifying that gap as LEGACY. It drifted
//     further every day. Pinning the anchor removes the timer.
//
//  2. SHALLOW CLONE. With no reachable anchor every commit is LEGACY and the
//     audit PASSES having verified nothing. `--require-shipped` refuses.
// ---------------------------------------------------------------------------
describe("v1 ship anchor", () => {
  test("the pinned anchor is a real, parseable, historical instant", () => {
    const ts = Date.parse(V1_SHIP_DATE_DEFAULT);
    expect(Number.isNaN(ts)).toBe(false);
    expect(V1_SHIP_SHA_DEFAULT).toMatch(/^[0-9a-f]{40}$/);
    // It must PRE-date the fail-closed cutover, or the grandfather window is
    // empty and every historical commit is judged under the new rule.
    expect(ts).toBeLessThan(Date.parse(FAIL_CLOSED_CUTOVER_DEFAULT));
  });

  test("MUTATION: --require-shipped refuses a repo with no anchor instead of passing", () => {
    // A fresh repo with commits but no AgencySignature anywhere is exactly the
    // shallow-clone shape: nothing to anchor to.
    const repo = mkdtempSync(join(tmpdir(), "zeta-agsig-noanchor-"));
    const env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_AUTHOR_DATE: "2026-08-20T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-08-20T00:00:00Z",
    };
    const git = (args: readonly string[]): void => {
      // eslint-disable-next-line sonarjs/no-os-command-from-path
      const r = spawnSync("git", args, { cwd: repo, env, encoding: "utf8" });
      if ((r.status ?? 1) !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    };
    git(["-c", "init.defaultBranch=main", "init", "-q", "."]);
    git(["config", "user.name", "Aaron Stainback"]);
    git(["config", "user.email", "aaron_bond@yahoo.com"]);
    git(["config", "commit.gpgsign", "false"]);
    git([
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "feat: unsigned agent work",
      "-m",
      "Co-authored-by: the shadow <shadow@zeta.agents>",
    ]);

    const cwd = process.cwd();
    const outWrite = process.stdout.write.bind(process.stdout);
    const errWrite = process.stderr.write.bind(process.stderr);
    const errChunks: string[] = [];
    let withFlag: number;
    let withoutFlag: number;
    try {
      process.chdir(repo);
      (process.stdout as { write: (s: string) => boolean }).write = (): boolean => true;
      (process.stderr as { write: (s: string) => boolean }).write = (s: string): boolean => {
        errChunks.push(s);
        return true;
      };
      withFlag = main(["--commit", "HEAD", "--require-shipped"]);
      withoutFlag = main(["--commit", "HEAD"]);
    } finally {
      (process.stdout as { write: typeof outWrite }).write = outWrite;
      (process.stderr as { write: typeof errWrite }).write = errWrite;
      process.chdir(cwd);
      rmSync(repo, { recursive: true, force: true });
    }

    // WITHOUT the flag this unsigned agent commit passes as LEGACY — the
    // silent-green failure, reproduced here so the guard has something to be
    // a guard against.
    expect(withoutFlag).toBe(0);
    // WITH it, the tool refuses rather than reporting a verification it did
    // not perform.
    expect(withFlag).toBe(2);
    expect(errChunks.join("")).toContain("no v1 ship anchor is reachable");
  });
});
