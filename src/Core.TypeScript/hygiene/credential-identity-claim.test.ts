// credential-identity-claim.test.ts — falsifiers for the Credential-Identity
// claim check.
//
// THE TWO THAT MATTER are at the bottom, under "THE LIVE PAIR". They are not
// fixtures: they are the two real commits of PR #15691, which differ ONLY in the
// two fields under test, on the same branch with the same author. One must be
// refuted and one must pass, and if either direction stops holding the check has
// stopped meaning what it says.

import { describe, expect, test } from "bun:test";

import {
  MODE_SCOPE_NOTE,
  isRefutation,
  judgeAll,
  judgeCommit,
  loadCredentialRoster,
  normalizeIdentity,
  parseCommitsJsonl,
  parseCredentialRoster,
  render,
  main,
  type CommitRecord,
} from "./credential-identity-claim.ts";

const BLOCK = (identity: string, mode: string): string =>
  [
    "Agency-Signature-Version: 1",
    "Agent: shadow",
    "Agent-Runtime: claude-code",
    "Agent-Model: claude-opus-5",
    `Credential-Identity: ${identity}`,
    `Credential-Mode: ${mode}`,
    "Human-Review: not-implied-by-credential",
    "Human-Review-Evidence: none",
    "Action-Mode: autonomous-fail-closed",
    "Task: none",
  ].join("\n");

const commit = (over: Partial<CommitRecord> = {}): CommitRecord => ({
  sha: "0".repeat(40),
  message: `subject\n\nbody\n\n${BLOCK("AceHack", "shared")}\n`,
  authorEmail: "aaron_bond@yahoo.com",
  committerEmail: "aaron_bond@yahoo.com",
  ...over,
});

const roster = loadCredentialRoster();

describe("roster", () => {
  test("the shipped roster parses and names the shared maintainer credential", () => {
    expect(roster.byEmail.get("aaron_bond@yahoo.com")).toBe("acehack");
    expect(roster.byClaim.get("acehack")).toBe("acehack");
    expect(roster.byId.get("acehack")?.mode).toBe("shared");
  });

  test("github:AceHack and AceHack are ONE credential (both spellings live on main)", () => {
    expect(normalizeIdentity("github:AceHack")).toBe("acehack");
    expect(roster.byClaim.get(normalizeIdentity("  GITHUB:AceHack "))).toBe("acehack");
  });

  test("no lane credential asserts a mode — an unmeasured mode must stay unchecked", () => {
    expect(roster.byId.get("github-actions[bot]")?.mode).toBeUndefined();
  });

  // THE FALSE-POSITIVE CLASS THIS CHECK WAS CAUGHT BY, PINNED.
  // The first draft rostered `society[bot]` as its own credential and refuted
  // two honest commits. society-heartbeat.yml sets that name with `git config`
  // (a DISPLAY identity) while pushing with ZETA_TELEMETRY_FLUSH_TOKEN or
  // GITHUB_TOKEN, so `Credential-Identity: github-actions[bot]` on a
  // society[bot]-authored commit is TRUE. Display identities of one credential
  // FAMILY share one row; splitting them again must fail here first.
  test("society[bot] is a DISPLAY identity of the actions credential, not its own", () => {
    expect(roster.byEmail.get("society[bot]@users.noreply.github.com")).toBe("github-actions[bot]");
    expect(roster.byId.has("society[bot]")).toBe(false);
  });

  test("REGRESSION cbc6f1a1c11d / 93310a63126d — society-lane blocks are NOT refuted", () => {
    const laneCommit = (sha: string): CommitRecord => ({
      sha,
      message: `society: evolution tick\n\n${BLOCK("github-actions[bot]", "unknown")}`,
      authorEmail: "society[bot]@users.noreply.github.com",
      committerEmail: "society[bot]@users.noreply.github.com",
    });
    const report = judgeAll([laneCommit("cbc6f1a1c11d"), laneCommit("93310a63126d")], roster, false);
    expect(report.exitCode).toBe(0);
    expect(report.verdicts.map((v) => v.kind)).toEqual(["VERIFIED", "VERIFIED"]);
  });

  // A roster that cannot be read must be a TOOLING error, never an empty roster
  // that quietly refutes nobody.
  test("malformed rosters THROW rather than degrading to a permissive default", () => {
    expect(() => parseCredentialRoster("{}")).toThrow();
    expect(() => parseCredentialRoster('{"credentialIdentities":[{"credential":"x"}]}')).toThrow();
    expect(() =>
      parseCredentialRoster('{"credentialIdentities":[{"credential":"x","gitEmails":[],"claimSpellings":["x"]}]}'),
    ).toThrow();
    // Ambiguous resolution would produce arbitrary refutations.
    expect(() =>
      parseCredentialRoster(
        JSON.stringify({
          credentialIdentities: [
            { credential: "a", gitEmails: ["e@x"], claimSpellings: ["a"] },
            { credential: "b", gitEmails: ["e@x"], claimSpellings: ["b"] },
          ],
        }),
      ),
    ).toThrow();
    // Non-ASCII would make ordinal lowercasing runtime-dependent.
    expect(() =>
      parseCredentialRoster(
        JSON.stringify({
          credentialIdentities: [{ credential: "a", gitEmails: ["é@x"], claimSpellings: ["a"] }],
        }),
      ),
    ).toThrow();
  });

  test("an empty credentialIdentities array parses — and then refutes nothing", () => {
    const empty = parseCredentialRoster('{"credentialIdentities":[]}');
    const v = judgeCommit(commit({ message: `s\n\n${BLOCK("alexa", "dedicated-agent")}` }), empty, false);
    expect(v[0]?.kind).toBe("UNVERIFIABLE-UNROSTERED-COMMITTER");
  });
});

describe("the rule", () => {
  test("a truthful block passes", () => {
    const v = judgeCommit(commit(), roster, false);
    expect(v).toHaveLength(1);
    expect(v[0]?.kind).toBe("VERIFIED");
    expect(v[0]?.resolvedCredential).toBe("acehack");
  });

  test("REFUTED: the claim names an identity that did not sign", () => {
    const v = judgeCommit(commit({ message: `s\n\n${BLOCK("alexa", "dedicated-agent")}` }), roster, false);
    expect(v[0]?.kind).toBe("REFUTED-IDENTITY");
    // Requirement: name BOTH values, so the report is actionable without a lookup.
    expect(v[0]?.detail).toContain("alexa");
    expect(v[0]?.detail).toContain("acehack");
    expect(v[0]?.detail).toContain("aaron_bond@yahoo.com");
  });

  test("REFUTED: a claim naming a DIFFERENT ROSTERED credential also fails", () => {
    // Distinct from the case above: here the claim resolves, just not to the
    // signer. Without this, the rule could be satisfied by rostering anything.
    const v = judgeCommit(commit({ message: `s\n\n${BLOCK("github-actions[bot]", "unknown")}` }), roster, false);
    expect(v[0]?.kind).toBe("REFUTED-IDENTITY");
    expect(v[0]?.detail).toContain("github-actions[bot]");
  });

  test("the committer counts too, not only the author", () => {
    const v = judgeCommit(
      commit({ authorEmail: "someone@unrostered.example", committerEmail: "aaron_bond@yahoo.com" }),
      roster,
      false,
    );
    expect(v[0]?.kind).toBe("VERIFIED");
  });

  test("UNVERIFIABLE, never REFUTED, when the commit's identity is unrostered", () => {
    // THE FAIL-OPEN DIRECTION THAT IS CORRECT: a fresh agent credential with its
    // own git identity must never be accused. If this ever flips to a refutation,
    // adding an agent becomes a roster-edit gate, which is the allowlist-of-agents
    // failure the roster note forbids.
    const v = judgeCommit(
      commit({
        message: `s\n\n${BLOCK("alexa", "dedicated-agent")}`,
        authorEmail: "alexa@agents.example",
        committerEmail: "alexa@agents.example",
      }),
      roster,
      false,
    );
    expect(v[0]?.kind).toBe("UNVERIFIABLE-UNROSTERED-COMMITTER");
    expect(isRefutation(v[0]?.kind ?? "NO-BLOCK")).toBe(false);
  });

  test("REFUTED-MODE: dedicated-agent on the declared-SHARED credential", () => {
    const v = judgeCommit(commit({ message: `s\n\n${BLOCK("AceHack", "dedicated-agent")}` }), roster, false);
    expect(v[0]?.kind).toBe("REFUTED-MODE");
    expect(v[0]?.detail).toContain("shared");
  });

  test("`shared` is not PROVED — every other mode on acehack passes unchecked", () => {
    // The honest limit made a falsifier: the instrument must not start claiming
    // it verified a mode it cannot see.
    for (const mode of ["shared", "operator-delegated", "human-only", "unknown"]) {
      const v = judgeCommit(commit({ message: `s\n\n${BLOCK("AceHack", mode)}` }), roster, false);
      expect(v[0]?.kind).toBe("VERIFIED");
      expect(v[0]?.detail).toContain("NOT checked");
    }
  });

  test("no mode is refuted on a credential the roster does not declare shared", () => {
    const v = judgeCommit(
      commit({
        message: `s\n\n${BLOCK("github-actions[bot]", "dedicated-agent")}`,
        authorEmail: "github-actions[bot]@users.noreply.github.com",
        committerEmail: "github-actions[bot]@users.noreply.github.com",
      }),
      roster,
      false,
    );
    expect(v[0]?.kind).toBe("VERIFIED");
  });

  test("a commit with no block is NO-BLOCK, not a refutation", () => {
    // Presence is the other instruments' job. If this check also failed on
    // absence it would double-report and could not be read independently.
    const v = judgeCommit(commit({ message: "subject only" }), roster, false);
    expect(v[0]?.kind).toBe("NO-BLOCK");
    expect(isRefutation(v[0]?.kind ?? "NO-BLOCK")).toBe(false);
  });

  test("every block in a multi-block message is judged", () => {
    const msg = `s\n\n${BLOCK("AceHack", "shared")}\n\ntail\n\n${BLOCK("alexa", "unknown")}\n`;
    const v = judgeCommit(commit({ message: msg }), roster, false);
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.kind)).toEqual(["VERIFIED", "REFUTED-IDENTITY"]);
  });
});

describe("squash attribution", () => {
  const squashed = commit({
    message: `s\n\n${BLOCK("github-actions[bot]", "unknown")}`,
    authorEmail: "aaron_bond@yahoo.com",
    committerEmail: "noreply@github.com",
  });

  // THE MEASUREMENT THIS ENCODES: 319 of the last 600 main commits claim
  // `github-actions[bot]` while authored `aaron_bond@yahoo.com`, because GitHub
  // squash-merge rewrites authorship to the merging account. Comparing a claim
  // to a squash object's author would refute those 319 honest records.
  test("main-tip reports ATTRIBUTION-REWRITTEN, never a refutation", () => {
    const v = judgeCommit(squashed, roster, true);
    expect(v[0]?.kind).toBe("UNVERIFIABLE-ATTRIBUTION-REWRITTEN");
    expect(judgeAll([squashed], roster, true).exitCode).toBe(0);
  });

  test("pull-request-commits does NOT excuse it — branch authorship is real", () => {
    // The same object read in the other role. If the excuse leaked into the
    // pre-merge source, a PR whose commits happened to carry a github.com
    // committer would be exempt, and the check would have a hole shaped like a
    // git config setting.
    expect(judgeCommit(squashed, roster, false)[0]?.kind).toBe("REFUTED-IDENTITY");
  });
});

describe("input + CLI", () => {
  test("JSONL parses page-by-page; a bad line is a TOOLING error", () => {
    const line = JSON.stringify({
      sha: "abc",
      message: "m",
      authorEmail: "a@b",
      committerEmail: "a@b",
    });
    expect(parseCommitsJsonl(`${line}\n\n${line}\n`)).toHaveLength(2);
    expect(() => parseCommitsJsonl("{not json}")).toThrow();
    expect(() => parseCommitsJsonl('{"sha":"a"}')).toThrow();
  });

  test("--source is required; a missing or bogus one exits 2, not 0", () => {
    // Exit 2 is "the check did not run", and must never be spendable as a pass.
    let out = "";
    expect(
      main(
        [],
        () => "",
        (s) => {
          out += s;
        },
      ),
    ).toBe(2);
    expect(
      main(
        ["--source", "guess"],
        () => "",
        () => {},
      ),
    ).toBe(2);
    expect(out).toContain("--source is REQUIRED");
  });

  test("bad stdin exits 2 (tooling), never 0 (pass) and never 1 (refuted)", () => {
    expect(
      main(
        ["--source", "main-tip"],
        () => "{oops}",
        () => {},
      ),
    ).toBe(2);
  });

  test("the mode-scope note is printed on EVERY run, including a green one", () => {
    let out = "";
    const line = JSON.stringify({
      sha: "abc",
      message: `s\n\n${BLOCK("AceHack", "shared")}`,
      authorEmail: "aaron_bond@yahoo.com",
      committerEmail: "aaron_bond@yahoo.com",
    });
    expect(
      main(
        ["--source", "pull-request-commits"],
        () => line,
        (s) => {
          out += s;
        },
      ),
    ).toBe(0);
    expect(out).toContain(MODE_SCOPE_NOTE);
    expect(out).toContain("VERIFIED");
  });

  test("an empty input says so rather than reporting a silent pass", () => {
    let out = "";
    render({ verdicts: [], exitCode: 0 }, "main-tip", (s) => {
      out += s;
    });
    expect(out).toContain("no commits read — nothing was checked");
  });

  test("a refutation renders as an Actions error annotation and exits 1", () => {
    let out = "";
    const line = JSON.stringify({
      sha: "d98366df924d8d731ba7a7a6263d72af5c020434",
      message: `s\n\n${BLOCK("alexa", "dedicated-agent")}`,
      authorEmail: "aaron_bond@yahoo.com",
      committerEmail: "aaron_bond@yahoo.com",
    });
    expect(
      main(
        ["--source", "pull-request-commits"],
        () => line,
        (s) => {
          out += s;
        },
      ),
    ).toBe(1);
    expect(out).toContain("::error::REFUTED-IDENTITY");
  });
});

// ---------------------------------------------------------------------------
// THE LIVE PAIR — PR #15691, both directions, on real commits
// ---------------------------------------------------------------------------
// These are the exact messages and identities of two commits on one branch,
// same author, differing only in `Credential-Identity` and `Credential-Mode`.
// d98366df924d was GREEN under `agencysignature (PR body)` while asserting an
// identity that provably did not sign it. 7597314894619 is its author's own
// correction, landed independently — and it is the values this check would have
// demanded, which is why the pair is evidence the check is useful and not merely
// possible.
//
// Verified against the real git objects on 2026-08-26 (both are reachable by
// sha from origin; d98366df924d is no longer the head and is pinned here on
// purpose so the fix cannot erase the red case).
describe("THE LIVE PAIR — PR #15691", () => {
  const authorship = {
    authorEmail: "aaron_bond@yahoo.com",
    committerEmail: "aaron_bond@yahoo.com",
  } as const;

  const withBlock = (sha: string, identity: string, mode: string): CommitRecord => ({
    sha,
    message: [
      "research(decorr): W15 clause-swap is a real axis at N=400",
      "",
      "Agency-Signature-Version: 1",
      "Agent: alexa",
      "Agent-Runtime: Kiro",
      "Agent-Model: Auto",
      `Credential-Identity: ${identity}`,
      `Credential-Mode: ${mode}`,
      "Human-Review: not-implied-by-credential",
      "Human-Review-Evidence: none",
      "Action-Mode: autonomous-fail-closed",
      "Task: none",
      "",
    ].join("\n"),
    ...authorship,
  });

  test("RED — d98366df924d (`alexa` / `dedicated-agent`) is refuted", () => {
    const report = judgeAll(
      [withBlock("d98366df924d8d731ba7a7a6263d72af5c020434", "alexa", "dedicated-agent")],
      roster,
      false,
    );
    expect(report.exitCode).toBe(1);
    expect(report.verdicts[0]?.kind).toBe("REFUTED-IDENTITY");
    expect(report.verdicts[0]?.detail).toContain("alexa");
    expect(report.verdicts[0]?.detail).toContain("acehack");
  });

  test("GREEN — 759731489461 (`AceHack` / `shared`) passes", () => {
    const report = judgeAll(
      [withBlock("759731489461921b306f412bd9cdc33591f19b91", "AceHack", "shared")],
      roster,
      false,
    );
    expect(report.exitCode).toBe(0);
    expect(report.verdicts[0]?.kind).toBe("VERIFIED");
  });

  test("the pair differs ONLY in the two fields under test", () => {
    // Guards against the red case passing for an unrelated reason later.
    const red = withBlock("a", "alexa", "dedicated-agent").message;
    const green = withBlock("a", "AceHack", "shared").message;
    const diff = red
      .split("\n")
      .filter((l, i) => l !== green.split("\n")[i])
      .map((l) => l.split(":")[0]);
    expect(diff).toEqual(["Credential-Identity", "Credential-Mode"]);
  });
});
