import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { type CoverageEnv } from "./agencysignature-commit-coverage.ts";
import {
  diagnoseParseFailure,
  finalParagraph,
  hasMisspelledVersionKey,
  isGrandfatheredPr,
  isUnfilledPlaceholder,
  main,
  parseExternalActors,
  repoAssertedAttribution,
  type RepoAssertedActor,
} from "./validate-agencysignature-pr-body";

const CUTOVER = "2026-08-15T00:00:00Z";

// ---------------------------------------------------------------------------
// END-TO-END harness. The pure helpers below are unit-tested, but the two
// defects this file was extended for (the `---` divider, the external-actor
// path) live in `main()`'s wiring, and a unit test of a helper cannot see a
// wiring bug. So these run the REAL script, over a REAL stdin body, and read
// the REAL exit code -- the same three things CI does.
// ---------------------------------------------------------------------------

const SCRIPT = join(import.meta.dir, "validate-agencysignature-pr-body.ts");

/**
 * Run the REAL `main()` over a real body and capture its real output + exit
 * code — the same three things CI reads.
 *
 * In-process rather than a subprocess per case, for a measured reason: a
 * spawn-per-case version of this file made an unrelated real-git test's 5s
 * `beforeEach` hook time out in 2 of 6 full-directory runs (0 of 6 without it).
 * `main()` still does everything it does in CI — spawns git, reads the roster
 * off disk, writes the same bytes — the only substitution is stdin. The process
 * boundary itself is covered once, by the CLI smoke test below.
 */
/**
 * The environment these cases run in, stated rather than inherited.
 *
 * `main()` now consults the environment for COMMIT COVERAGE (see
 * agencysignature-commit-coverage.ts). Left ambient, this whole file would read
 * `GITHUB_ACTIONS` / the Actions event payload when it runs INSIDE CI and behave
 * differently there than on a laptop — a test suite whose verdict depends on
 * where it runs, which is the §13 leak the coverage module itself refuses. So
 * the env is injected and empty: these cases judge one authored body and make no
 * completeness claim. The coverage behaviour is tested where it belongs, in
 * agencysignature-commit-coverage.test.ts.
 */
const HERMETIC_ENV: CoverageEnv = {
  vars: {},
  readFile: () => {
    throw new Error("no ambient environment in this suite");
  },
};

function runValidator(
  body: string,
  args: readonly string[] = [],
): { readonly status: number; readonly out: string } {
  const chunks: string[] = [];
  const capture = (chunk: unknown): boolean => {
    chunks.push(String(chunk));
    return true;
  };
  const realOut = process.stdout.write;
  const realErr = process.stderr.write;
  process.stdout.write = capture as typeof process.stdout.write;
  process.stderr.write = capture as typeof process.stderr.write;
  try {
    return { status: main(args, body, HERMETIC_ENV), out: chunks.join("") };
  } finally {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
  }
}

/**
 * The ONE place a subprocess is spawned. Both smoke tests go through it, and the
 * environment is always STATED rather than inherited: inside CI the ambient
 * `GITHUB_ACTIONS` + `GITHUB_EVENT_PATH` would put the child in the commit-
 * coverage lane and make a verdict depend on the host PR's commit count. Same
 * reason as `HERMETIC_ENV` above.
 */
/**
 * The ONE spawn in this file, with the argv stated EXACTLY. Everything that
 * needs a real process goes through here -- including the case that must NOT
 * carry `--source`, which is why the argv is a parameter rather than a constant.
 */
function runScriptRaw(
  input: string,
  argv: readonly string[],
  overrides: Readonly<Record<string, string>> = {},
): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
  const result = spawnSync("bun", [SCRIPT, ...argv], {
    input,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GITHUB_ACTIONS: "", GITHUB_EVENT_NAME: "", ...overrides },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/**
 * The ordinary CI shape: an author identity and a DECLARED artifact. `source`
 * defaults to `pr-body` only because most cases here read like a description;
 * the squash-preimage case states `commit-messages` explicitly, exactly as the
 * workflow's second step does.
 */
function runScript(
  input: string,
  overrides: Readonly<Record<string, string>>,
  source = "pr-body",
): { readonly status: number | null; readonly stdout: string } {
  const result = runScriptRaw(
    input,
    ["--author-identity", "AceHack", "--source", source],
    overrides,
  );
  return { status: result.status, stdout: result.stdout };
}

// The subprocess test. Everything else calls `main()` directly, so this is
// what proves the shebang, the argv slice, the stdin read and the exit-code
// propagation are wired — i.e. that the thing CI actually invokes runs.
test("CLI smoke: the script itself validates a good body over real stdin", () => {
  const result = runScript(`## Summary\n\nWork.\n\n---\n\n${GOOD_BLOCK}\n`, {});
  expect(result.stdout).toContain("PASS: AgencySignature v1");
  expect(result.status).toBe(0);
});

// The second subprocess test, and the one that pins the CI wiring: a real
// process, a real event payload on disk, a real underscan. This is the shape
// `.github/workflows/agencysignature-enforcement.yml` runs in — a `pull_request`
// event whose PR has more commits than `pulls/{n}/commits` can return — and the
// exit code that must come back is 3 (REFUSED, UNMEASURED), never 0.
test("CLI smoke: an underscanned commit list REFUSES through the process boundary", () => {
  // `mkdtempSync`, NOT `join(tmpdir(), <predictable name>)`. The first version of
  // this test keyed the filename on `process.pid` and CodeQL was right to flag it
  // (js/insecure-temporary-file, high, alert #721 on PR #11630): a predictable path
  // in a world-writable directory, written with no O_EXCL, follows whatever symlink
  // a local attacker left there first (CWE-377/CWE-378). `mkdtempSync` creates the
  // directory atomically, mode 0700, with a random suffix — the pattern the rest of
  // this repo already uses (check-bash-retirement-inventory.test.ts, audit-worktree-
  // survey.ts, and ~10 more).
  const eventDir = mkdtempSync(join(tmpdir(), "zeta-agencysignature-underscan-"));
  const eventPath = join(eventDir, "event.json");
  // 475 is not a placeholder: it is PR #11528's real commit count, measured
  // 2026-08-17 against a forge that returned 250 of them.
  writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 11528, commits: 475 } }));
  try {
    const result = runScript(
      `${GOOD_BLOCK}\n`,
      {
        GITHUB_ACTIONS: "true",
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_EVENT_PATH: eventPath,
        PR_BODY: "a different text — this stdin is the squash preimage, not the body",
      },
      // This stdin IS the squash preimage, so it says so -- the same declaration
      // the workflow's second step now makes.
      "commit-messages",
    );
    expect(result.stdout).toContain("REFUSED (UNMEASURED)");
    expect(result.stdout).not.toContain("PASS: AgencySignature");
    expect(result.status).toBe(3);
  } finally {
    rmSync(eventDir, { recursive: true, force: true });
  }
});

/** A valid, contiguous, terminal v1 block. */
const GOOD_BLOCK = [
  "Agency-Signature-Version: 1",
  "Agent: shadow",
  "Agent-Runtime: Claude Code",
  "Agent-Model: claude-opus-5",
  "Credential-Identity: AceHack via gh",
  "Credential-Mode: shared",
  "Human-Review: not-implied-by-credential",
  "Human-Review-Evidence: none",
  "Action-Mode: supervised",
  "Task: agencysignature-gate-divider-and-external-actors",
].join("\n");

// ---------------------------------------------------------------------------
// DEFECT 1 -- a bare `---` anywhere in the body silently killed trailer parsing.
//
// `git interpret-trailers` reads stdin as a commit message with a patch possibly
// appended, so `---` is the diff boundary and everything after it is discarded.
// A PR body is not that, and the artifact made a flawless trailer block
// invisible while the error text blamed blank-line discipline a hundred lines
// away. MEASURED 2026-08-15: nine open PR bodies carry a bare `---`, including
// all five dependabot PRs.
//
// MUTATION PROOF (run 2026-08-15): with `--no-divider` removed from
// TRAILER_PARSE_ARGS all four shapes below fail with exit 1 and
// "no parseable git trailers found"; restored, all four pass with exit 0.
// ---------------------------------------------------------------------------
describe("the `---` divider artifact (defect 1)", () => {
  test("a bare `---` horizontal rule above the block does not hide it", () => {
    const body = `## Summary\n\nSomething shipped.\n\n---\n\nMore prose.\n\n${GOOD_BLOCK}\n`;
    const { status, out } = runValidator(body);
    expect(out).toContain("PASS");
    expect(status).toBe(0);
  });

  test("a `--- text ---` line inside a fenced evidence block does not hide it", () => {
    // The literal shape hit twice on 2026-08-15. Note `stripCodeFences` removes
    // the ``` lines but keeps their CONTENT, so the `--- ... ---` line survives
    // into what git sees -- which is exactly why the fence strip did not save it.
    const body =
      "## Evidence\n\n```\n--- MEASURED ZERO (0 of 12 open PRs) ---\nrows: 0\n```\n\n" +
      `${GOOD_BLOCK}\n`;
    const { status, out } = runValidator(body);
    expect(out).toContain("PASS");
    expect(status).toBe(0);
  });

  test("a dependabot-style footer `---` does not hide it", () => {
    const body =
      "Bumps xunit.v3 from 3.2.2 to 4.0.0.\n\n" +
      "[//]: # (dependabot-automerge-start)\n[//]: # (dependabot-automerge-end)\n\n" +
      "---\n\n<details>\n<summary>Dependabot commands and options</summary>\n" +
      "You can trigger Dependabot actions by commenting on this PR.\n</details>\n\n" +
      `${GOOD_BLOCK}\n`;
    const { status, out } = runValidator(body);
    expect(out).toContain("PASS");
    expect(status).toBe(0);
  });

  test("a line beginning `--- ` (the other boundary spelling) does not hide it", () => {
    const body = `Prose.\n\n--- a trailing note ---\n\n${GOOD_BLOCK}\n`;
    const { status, out } = runValidator(body);
    expect(out).toContain("PASS");
    expect(status).toBe(0);
  });

  test("MUTATION: the divider fix did not make the gate unable to fail", () => {
    // Everything above proves `---` is no longer a cause. This proves the
    // check still HAS causes: a body with no block at all is still rejected,
    // `---` or no `---`.
    const { status, out } = runValidator("## Summary\n\n---\n\nNo block here.\n");
    expect(status).toBe(1);
    expect(out).toContain("FAIL");
  });
});

// The error text has to name the cause it actually found. The old message
// asserted "block missing OR blank-line discipline broken" unconditionally --
// a fixed sentence, and (before the divider fix) wrong in the commonest case.
describe("parse-failure diagnosis names the real cause", () => {
  test("absent: no version key anywhere", () => {
    const d = diagnoseParseFailure("## Summary\n\nnothing here\n");
    expect(d.cause).toBe("absent");
    expect(d.keyLine).toBe(0);
  });

  test("unreadable: the key IS present, so the cause is placement", () => {
    const d = diagnoseParseFailure(`${GOOD_BLOCK}\n\nA trailing footer paragraph.\n`);
    expect(d.cause).toBe("unreadable");
    expect(d.keyLine).toBe(1);
    expect(d.finalParagraph).toEqual(["A trailing footer paragraph."]);
  });

  test("the emitted text distinguishes the two", () => {
    const absent = runValidator("## Summary\n\nno block\n", [
      "--source",
      "commit-messages",
    ]);
    // Wording updated 2026-08-17: the message used to say "PR body" while the check
    // reads COMMIT MESSAGES (it pipes `pulls/N/commits`). Corrected again 2026-08-18:
    // the artifact is now DECLARED by the caller rather than hardcoded, because one
    // hardcoded provenance cannot be true for two opposite inputs — so this case
    // must state which artifact it is asserting about. The assertion tracks the
    // distinguishing phrase, not the prose, so a rewording does not silently drop
    // coverage.
    expect(absent.out).toContain("no commit on this PR carries a");
    expect(absent.out).toContain("read the COMMIT MESSAGES and nothing else");
    expect(absent.out).not.toContain("RECOVERED-MALFORMED");

    // REVERSED 2026-08-16 by Aaron's layout-tolerance ruling, and kept here as
    // the before/after record rather than deleted. In #10922 this body FAILED
    // (RECOVERED-MALFORMED, exit 1). It now PASSES: the block is complete and
    // every value is valid, and the author cannot control what a forge or an IDE
    // appends below it. Trailing text is a layout fact, not a defect.
    const misplaced = runValidator(`${GOOD_BLOCK}\n\nA trailing footer paragraph.\n`);
    expect(misplaced.status).toBe(0);
    expect(misplaced.out).toContain("PASS:");
    expect(misplaced.out).not.toContain("RECOVERED-MALFORMED");
  });

  test("the placement diagnosis is still reached when there is no complete block", () => {
    // The `unreadable` branch of diagnoseParseFailure is NOT dead code: an
    // INCOMPLETE block in the wrong place cannot be recovered (recovery requires
    // all ten keys), so it still falls through to the missing-keys diagnosis.
    const partial = runValidator(
      "Agency-Signature-Version: 1\nAgent: shadow\n\nA trailing footer paragraph.\n",
    );
    expect(partial.status).toBe(1);
    expect(partial.out).not.toContain("PASS:");
  });

  test("finalParagraph is the last contiguous non-blank run", () => {
    expect(finalParagraph("a\n\nb\nc\n\n\n")).toEqual(["b", "c"]);
    expect(finalParagraph("only\n")).toEqual(["only"]);
    expect(finalParagraph("\n\n")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DEFECT 3 -- ONE validator, TWO opposite artifacts, ONE hardcoded provenance.
//
// The workflow pipes the PR DESCRIPTION into this tool in one step and the
// PR's COMMIT MESSAGES into it in the next. Until 2026-08-18 the parse-failure
// text asserted COMMIT MESSAGES either way, so on the PR-body step every
// sentence was false for the artifact actually read -- and the text explicitly
// denied the fix that works ("a perfect block in the PR description does NOT
// satisfy it"). It was the vacuity class inside the tool built to enforce
// against it: a message that cannot be right for both inputs is evidence for
// neither.
//
// Measured cost (2026-08-17, work item 081M092W2E7087G0R000KDKHWS): PR #11707
// was CLOSED and its branch rebuilt chasing a commit-side defect that was not
// the cause (#11710, which failed identically); the real remedy was one
// `gh pr edit --body-file`. A second agent hit the same sentence within the
// hour (#11712) and had to be intercepted mid-rebuild.
//
// THE FALSIFIER: the two invocations must not emit the same bytes, and each
// must carry ONLY its own artifact's remedy. Before the `--source` option
// existed the two outputs were byte-identical, so this describe block cannot
// pass against the old code -- it is not a restatement of behaviour that was
// already there.
// ---------------------------------------------------------------------------
describe("the failure text names the artifact it was actually handed", () => {
  const NO_BLOCK = "## Summary\n\nWork with no trailer block at all.\n";

  test("pr-body and commit-messages produce DIFFERENT text, each naming its own", () => {
    const prBody = runValidator(NO_BLOCK, ["--source", "pr-body"]);
    const commits = runValidator(NO_BLOCK, ["--source", "commit-messages"]);

    // Same verdict -- only the diagnostic moves. Behaviour is unchanged.
    expect(prBody.status).toBe(1);
    expect(commits.status).toBe(1);

    // ... and the diagnostic really does move.
    expect(prBody.out).not.toEqual(commits.out);

    expect(prBody.out).toContain("the PR DESCRIPTION");
    expect(commits.out).toContain("the PR's COMMIT MESSAGES");
  });

  test("the pr-body path does NOT send the reader to edit the commit message", () => {
    const prBody = runValidator(NO_BLOCK, ["--source", "pr-body"]);

    // The remedy it names is the one that works for THIS job, and it is cheap.
    expect(prBody.out).toContain("gh pr edit");

    // The sentences that cost a closed PR. Each is the old hardcoded text, and
    // each is false when the artifact read was the description.
    expect(prBody.out).not.toContain("no commit on this PR carries a");
    expect(prBody.out).not.toContain("COMMIT MESSAGES, not the PR description");
    expect(prBody.out).not.toContain("at the very bottom of the COMMIT MESSAGE");

    // Nor does it prescribe the commit-side verification ritual, which cannot
    // fix a missing block in a description.
    expect(prBody.out).not.toContain("git interpret-trailers");
    expect(prBody.out).not.toContain("then push");
  });

  test("the commit-messages path keeps the commit-side remedy and drops the body one", () => {
    const commits = runValidator(NO_BLOCK, ["--source", "commit-messages"]);

    expect(commits.out).toContain("no commit on this PR carries a");
    expect(commits.out).toContain("git interpret-trailers --parse");
    // Editing the description cannot put a block in a commit message, so this
    // path must not offer it.
    expect(commits.out).not.toContain("gh pr edit");
  });

  test("BOTH requirements stay stated -- neither job claims to be the only one", () => {
    // The fix must not read as "the block is only needed here". Each message
    // says the other artifact is judged by a separate job and both are required.
    for (const source of ["pr-body", "commit-messages"]) {
      const out = runValidator(NO_BLOCK, ["--source", source]).out;
      expect(out).toContain("SEPARATE job");
      expect(out).toContain("BOTH are required");
    }
  });

  test("an undeclared source names NEITHER artifact and prescribes both", () => {
    // The in-process register. It is not a guess dressed as a diagnosis: it
    // says out loud that nobody declared the artifact.
    const out = runValidator(NO_BLOCK).out;
    expect(out).toContain("the text this check was handed");
    expect(out).toContain("did NOT");
    expect(out).toContain("required in BOTH places");
    expect(out).not.toContain("no commit on this PR carries a");
    expect(out).not.toContain("the PR DESCRIPTION carries no");
  });

  test("an unknown --source value is a usage error, never a silent fallback", () => {
    // A typo must not degrade to the neutral register -- that would put the
    // provenance back under something other than the caller's statement.
    expect(runValidator(NO_BLOCK, ["--source", "prbody"]).status).toBe(2);
    expect(runValidator(NO_BLOCK, ["--source"]).status).toBe(2);
  });

  test("CLI smoke: an OMITTED --source fails closed at the process boundary", () => {
    // The command line is the level the bug lived at, so it is the level that
    // refuses: exit 2 (tooling / input error), before stdin is judged, rather
    // than an undeclared-provenance diagnosis a reader might act on.
    const omitted = runScriptRaw(NO_BLOCK, ["--author-identity", "AceHack"]);
    expect(omitted.status).toBe(2);
    expect(omitted.stderr).toContain("--source is required");
    expect(omitted.stdout).not.toContain("FAIL");

    // ... and the same input WITH the flag gets a real verdict, so the refusal
    // above is the flag's absence and not a broken script.
    const declared = runScriptRaw(NO_BLOCK, [
      "--author-identity",
      "AceHack",
      "--source",
      "pr-body",
    ]);
    expect(declared.status).toBe(1);
    expect(declared.stdout).toContain("the PR DESCRIPTION");
  });
});

// ---------------------------------------------------------------------------
// DEFECT 2 -- actors that structurally cannot comply.
//
// dependabot is a third party: we cannot make it emit a trailer, and
// synthesising one that claims to come FROM it would be forging an attestation
// inside an attestation convention. It gets a REPO-ASSERTED attribution instead.
// The danger of any exemption path is that it swallows everyone, so the
// negative tests here matter more than the positive one.
// ---------------------------------------------------------------------------
const ROSTER: readonly RepoAssertedActor[] = parseExternalActors(
  readFileSync(
    join(import.meta.dir, "agency-signature-identity-roster.json"),
    "utf8",
  ),
);

describe("repo-asserted attribution for rostered external actors", () => {
  test("the shipped roster actually carries dependabot", () => {
    // Guards the case where the roster is well-formed and lists nobody, which
    // would make every test below vacuously pass.
    expect(ROSTER.length).toBeGreaterThan(0);
    expect(ROSTER.map((r) => r.actor)).toContain("dependabot[bot]");
  });

  test("a rostered actor is matched, and the profile comes with it", () => {
    const hit = repoAssertedAttribution("dependabot[bot]", ROSTER);
    expect(hit).not.toBeNull();
    expect(hit?.repoAssertedProfile.Agent).toBe("dependabot");
    expect(hit?.profileEvidence).toContain("10753");
  });

  test.each([
    ["", "an empty author"],
    ["   ", "a whitespace author"],
    ["dependabot", "a PREFIX of a rostered actor"],
    ["evil-dependabot[bot]", "a SUFFIX match on a rostered actor"],
    ["dependabot[bot]-x", "a rostered actor with a suffix appended"],
    ["renovate[bot]", "a different bot nobody rostered"],
    ["*", "a glob"],
    ["AceHack", "a human"],
  ])("MUTATION: %s (%s) is NOT matched", (actor) => {
    expect(repoAssertedAttribution(actor, ROSTER)).toBeNull();
  });

  test("matching is case-insensitive and whitespace-tolerant on an EXACT actor", () => {
    expect(repoAssertedAttribution("  Dependabot[Bot]  ", ROSTER)?.actor).toBe(
      "dependabot[bot]",
    );
  });

  test("an empty roster exempts nobody", () => {
    // The failure direction of a missing section must be MORE enforcement.
    expect(repoAssertedAttribution("dependabot[bot]", [])).toBeNull();
  });
});

describe("the external-actor path end to end", () => {
  const AFTER_CUTOVER = ["--pr-created-at", "2026-08-16T00:00:00Z", "--grandfather-cutover", CUTOVER];
  // A real dependabot body: no trailer block, and a bare `---` in the footer.
  const DEPENDABOT_BODY =
    "Bumps xunit.v3 from 3.2.2 to 4.0.0.\n\n---\n\n<details>\n" +
    "<summary>Dependabot commands and options</summary>\n</details>\n";

  test("a rostered actor with no trailer passes, marked repo-asserted", () => {
    const { status, out } = runValidator(DEPENDABOT_BODY, [
      ...AFTER_CUTOVER,
      "--author-identity",
      "dependabot[bot]",
    ]);
    expect(status).toBe(0);
    expect(out).toContain("REPO-ASSERTED ATTRIBUTION");
    expect(out).toContain("ASSERTED BY THIS REPOSITORY, not by the actor");
    // The one thing it must never do: emit the profile as a trailer block.
    expect(out).not.toContain("PASS: AgencySignature");
  });

  test("MUTATION: a NON-rostered actor with the same body still FAILS", () => {
    // The vacuity guard. If the exemption ever swallows everyone this is the
    // test that goes red.
    const { status, out } = runValidator(DEPENDABOT_BODY, [
      ...AFTER_CUTOVER,
      "--author-identity",
      "renovate[bot]",
    ]);
    expect(status).toBe(1);
    expect(out).toContain("FAIL");
  });

  test("MUTATION: an ABSENT author identity does not buy an exemption", () => {
    const { status } = runValidator(DEPENDABOT_BODY, AFTER_CUTOVER);
    expect(status).toBe(1);
  });

  test("MUTATION: a human author with no trailer still FAILS after the cutover", () => {
    const { status, out } = runValidator("## Summary\n\nJust prose.\n", [
      ...AFTER_CUTOVER,
      "--author-identity",
      "AceHack",
    ]);
    expect(status).toBe(1);
    expect(out).toContain("FAIL");
  });

  test("a non-rostered author WITH a valid block still passes", () => {
    const { status, out } = runValidator(`## Summary\n\nWork.\n\n${GOOD_BLOCK}\n`, [
      ...AFTER_CUTOVER,
      "--author-identity",
      "AceHack",
    ]);
    expect(status).toBe(0);
    expect(out).toContain("PASS: AgencySignature v1");
  });
});

describe("roster parsing is strict", () => {
  test("an absent section yields an empty roster, not a throw", () => {
    expect(parseExternalActors('{"humans":[]}')).toEqual([]);
  });

  test.each([
    ['{"externalActors": {}}', "not an array"],
    ['{"externalActors": [{"name":"x","why":"y","profileEvidence":"z","repoAssertedProfile":{}}]}', "no actor"],
    ['{"externalActors": [{"actor":"a","name":"x","why":"y","profileEvidence":"z"}]}', "no profile"],
  ])("MUTATION: a malformed section throws (%s)", (json) => {
    expect(() => parseExternalActors(json)).toThrow();
  });

  test("MUTATION: a profile missing required keys throws", () => {
    // A row that exempts an actor while asserting almost nothing is a bare
    // exemption wearing an attribution's clothes.
    const thin: string = JSON.stringify({
      externalActors: [
        {
          actor: "a[bot]",
          name: "A",
          why: "y",
          profileEvidence: "z",
          repoAssertedProfile: { Agent: "a" },
        },
      ],
    });
    expect(() => parseExternalActors(thin)).toThrow(/Agent-Runtime/);
  });

  test("every shipped row carries a full profile and its evidence", () => {
    for (const row of ROSTER) {
      expect(row.why.length).toBeGreaterThan(40);
      expect(row.profileEvidence.length).toBeGreaterThan(40);
      expect(row.repoAssertedProfile["Human-Review"]).toBeDefined();
    }
  });
});

// `Agency-Signature-Version` is canonical (this validator's REQUIRED_KEYS, the
// spec doc, the post-merge auditor, the four cadence workflows that echo it).
// `Agent-Signature-Version` reached main three times on 2026-08-13/14 as a
// hand-composition slip, and the auditor exempted those commits — unsigned AND
// exempt at once. The pre-merge side names the slip explicitly now.
describe("Agent-/Agency- version key", () => {
  test("the misspelling is recognised", () => {
    expect(hasMisspelledVersionKey("Agent-Signature-Version: 1\n")).toBe(true);
    expect(hasMisspelledVersionKey("agent-signature-version: 2\n")).toBe(true);
  });

  test("the canonical key is not flagged", () => {
    expect(hasMisspelledVersionKey("Agency-Signature-Version: 1\n")).toBe(false);
  });

  test("other Agent-* trailers in the canonical v1 block are not flagged", () => {
    // `Agent:` and `Agent-Runtime:` are REQUIRED keys — only the VERSION key
    // has a wrong-spelling twin, so the detector must not swallow the block.
    expect(hasMisspelledVersionKey("Agent: otto\nAgent-Runtime: claude-code\n")).toBe(false);
    expect(hasMisspelledVersionKey("Agent-Model: claude-opus-5\n")).toBe(false);
  });
});

// The PR template now ships the trailer block pre-populated (that is the only
// way the block survives GitHub's squash-merge, which uses the BODY as the
// commit message). The new easy failure is therefore shipping the SKELETON —
// and MEASURED before the guard existed, the template validated CLEANLY with
// `Agent: <persona>` in it. A check that accepts attribution-to-nobody is the
// same silent-green shape as the audit that exempted the whole fleet (#10564).
describe("unfilled template placeholders", () => {
  test.each([
    "<persona>",
    "<model id>",
    "<harness, e.g. claude-code | codex-cli>",
    "  <account the credential belongs to>  ",
  ])("MUTATION: %s is rejected as unfilled", (value) => {
    expect(isUnfilledPlaceholder(value)).toBe(true);
  });

  test.each([
    "the shadow",
    "claude-opus-5",
    "claude-code",
    "acehack00@gmail.com",
    "none",
    "1",
  ])("a real value (%s) is accepted", (value) => {
    expect(isUnfilledPlaceholder(value)).toBe(false);
  });

  test("a value that merely CONTAINS angle brackets is not a placeholder", () => {
    // `Credential-Identity` is plausibly written as a git-style ident. Only a
    // value that is ENTIRELY `<...>` is the template skeleton.
    expect(isUnfilledPlaceholder("Aaron Stainback <aaron_bond@yahoo.com>")).toBe(false);
  });
});

// The grandfather window is what lets a blocking pre-merge check turn on
// without red-X'ing the in-flight fleet (measured 2026-08-14: 0 of 12 open PRs
// carried a valid block). It lives here, and not in the CI yaml, precisely so
// it has falsifiers.
describe("grandfather window", () => {
  test("a PR opened before the cutover is exempt", () => {
    expect(isGrandfatheredPr("2026-08-14T23:59:59Z", CUTOVER)).toBe(true);
    expect(isGrandfatheredPr("2026-06-01T00:00:00Z", CUTOVER)).toBe(true);
  });

  test("MUTATION: a PR opened AT or AFTER the cutover is NOT exempt", () => {
    // If this ever returns true the check becomes one that cannot fail.
    expect(isGrandfatheredPr("2026-08-15T00:00:00Z", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("2026-08-15T00:00:01Z", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("2027-01-01T00:00:00Z", CUTOVER)).toBe(false);
  });

  test("MUTATION: an unparseable timestamp does NOT buy an exemption", () => {
    // Fail-closed on bad input, or a malformed/absent `created_at` silently
    // exempts every PR — the same shape as the audit that assumed
    // human-authorship whenever it did not recognise a trailer.
    expect(isGrandfatheredPr("", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("not-a-date", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("2026-08-01T00:00:00Z", "not-a-date")).toBe(false);
  });

  test("timezone offsets compare correctly, not lexically", () => {
    // 2026-08-14T21:00:00-04:00 is 2026-08-15T01:00Z — AFTER the cutover,
    // though it reads as the 14th. A string comparison would get this wrong.
    expect(isGrandfatheredPr("2026-08-14T21:00:00-04:00", CUTOVER)).toBe(false);
    expect(isGrandfatheredPr("2026-08-14T19:00:00-04:00", CUTOVER)).toBe(true);
  });
});
