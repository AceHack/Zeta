// Falsifiers for the retraction commit message (`retraction-actuator.ts`).
//
// WHY THIS IS ON THE COMMIT AND NOT ONLY THE PR BODY. The repository's
// `squash_merge_commit_message` is COMMIT_MESSAGES, so what lands on `main` is built
// from the branch's commit messages, not from the PR body. `git revert` writes no
// trailers of its own, so before 2026-08-22 a retraction would have arrived unsigned.
//
// The actuator's push path cannot be exercised end-to-end here — `push_retraction` is
// only emitted after `main` has been red for several consecutive ticks with no fleet
// heal in flight — so what IS testable is tested, and the rest is named as untested in
// the change that introduced it rather than implied to be covered.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { isFullCommitSha, normalizeFullCommitSha, retractionCommitMessage } from "./retraction-actuator.ts";
import { indexWorkItems } from "./audit-task-zetaid-resolves.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const msg = retractionCommitMessage(SHA, "ep-012345678", 3);

describe("retractionCommitMessage", () => {
  test("the signature block is the FINAL paragraph, contiguous", () => {
    // git's trailer parser reads only the last blank-line-delimited paragraph, so a
    // blank line inside the block silently drops everything above it (the Trailer
    // Contiguity Survival Failure). This is the assertion that catches that.
    const paragraphs = msg.split("\n\n");
    const last = paragraphs[paragraphs.length - 1] ?? "";
    expect(last.startsWith("Agency-Signature-Version: 1")).toBe(true);
    for (const line of last.split("\n")) {
      expect(line).toMatch(/^[A-Za-z-]+: /);
    }
  });

  test("carries all ten AgencySignature v1 keys plus Co-authored-by", () => {
    for (const key of [
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
      "Co-authored-by",
    ]) {
      expect(msg).toContain(`${key}: `);
    }
  });

  // The ten-keys test above asserts every key is PRESENT. Presence is not a value:
  // this block's `Task:` read `081KZHGP45V` — a TRUNCATED ZetaId — and passed it,
  // because `toContain("Task: ")` cannot see what follows the colon. That is the
  // vacuity class in a test rather than in the code it guards.
  test("Task carries a FULL ZetaId the shape gate accepts — a prefix is not an id", () => {
    const task = /^Task: (.+)$/m.exec(msg)?.[1];
    expect(task).toBeDefined();
    // Same construction as agencysignature-block.ts TASK_RE. Written out rather than
    // imported so a change there cannot silently relax this assertion too.
    expect(String(task)).toMatch(/^[0-9][0-9A-HJKMNP-TV-Z]{25}$/);
    expect(String(task)).toBe("081KZHGP45V08QG0R001C0NFFS");
  });

  test("the Task id resolves to a committed work-item (AH006, locally)", () => {
    // AH006 runs this in CI against a PR BODY. This actuator writes a COMMIT
    // message at incident time, which that step never reads — so without this the
    // id is unchecked by anything until the lane fires. Worse, AH006 would not
    // have caught the truncation anyway: its extractor keeps only well-shaped ids,
    // so a prefix yields zero ids and exits 0.
    const known = indexWorkItems(join(import.meta.dir, "..", "..", ".."));
    expect(known.size).toBeGreaterThan(100);
    expect(known.has("081KZHGP45V08QG0R001C0NFFS")).toBe(true);
    // The falsifier for the falsifier: the truncated form must NOT resolve.
    expect(known.has("081KZHGP45V")).toBe(false);
  });

  test("Credential-Mode is a member of the enum — `none` is not a value", () => {
    const mode = /^Credential-Mode: (.+)$/m.exec(msg)?.[1];
    // Assert presence separately: a MISSING key and an INVALID key are different
    // defects, and `String(undefined)` would otherwise report the wrong one.
    expect(mode).toBeDefined();
    expect(["shared", "dedicated-agent", "operator-delegated", "human-only", "unknown"]).toContain(String(mode));
  });

  test("Action-Mode is fail-CLOSED — the actuator stands down rather than proceeding", () => {
    // Not cosmetic: `push_result: pushed=false` is a real transition in the state
    // machine, so claiming fail-open here would misdescribe what the lane does.
    expect(msg).toContain("Action-Mode: autonomous-fail-closed");
  });

  test("names the reverted commit in full, so the retraction is traceable from `main`", () => {
    expect(msg).toContain(`This reverts commit ${SHA}.`);
  });

  test("carries NO CI-skip token — that would strand the PR forever", () => {
    // On the old direct-push route `[skip ci]` was harmless. On this route it would
    // suppress the `pull_request` run of `gate`, the required check would never report,
    // and the PR could never merge. `flush-via-staging.assertNoSkipCi` refuses such a
    // message; this pins that the actuator never produces one.
    expect(msg).not.toMatch(/\[(skip ci|ci skip|skip actions|actions skip)\]/i);
  });

  test("the subject line stays within a readable git subject budget", () => {
    expect((msg.split("\n")[0] ?? "").length).toBeLessThanOrEqual(100);
  });
});

describe("isFullCommitSha — the guard between the network and a shell command", () => {
  test("accepts a full 40-hex object name", () => {
    expect(isFullCommitSha(SHA)).toBe(true);
  });

  test("rejects an abbreviated sha — the value is interpolated, so partial is not enough", () => {
    expect(isFullCommitSha(SHA.slice(0, 9))).toBe(false);
  });

  test("rejects shell metacharacters", () => {
    // The value reaches `git revert --no-commit <sha>` as a shell string. This is the
    // assertion that makes that safe rather than merely lucky.
    expect(isFullCommitSha(`${SHA}; rm -rf /`)).toBe(false);
    expect(isFullCommitSha("$(whoami)")).toBe(false);
    expect(isFullCommitSha(`${SHA} --force`)).toBe(false);
  });

  test("rejects path traversal — it also becomes a file path", () => {
    expect(isFullCommitSha("../../etc/passwd")).toBe(false);
    expect(isFullCommitSha(`../${SHA.slice(3)}`)).toBe(false);
  });

  test("rejects uppercase hex and empty", () => {
    // Anchored and lowercase-only: git object names are lowercase, and accepting a
    // superset here would weaken the guard for no gain.
    expect(isFullCommitSha(SHA.toUpperCase())).toBe(false);
    expect(isFullCommitSha("")).toBe(false);
  });

  test("is anchored at BOTH ends", () => {
    expect(isFullCommitSha(`x${SHA}`)).toBe(false);
    expect(isFullCommitSha(`${SHA}x`)).toBe(false);
  });
});
describe("normalizeFullCommitSha — a value the sinks can use, not a verdict about one", () => {
  // WHY THIS EXISTS ALONGSIDE `isFullCommitSha`. CodeQL's `js/http-to-file-access` flagged
  // the two file paths built from `breakSha` even with the boolean guard in place, and it
  // was RIGHT to: a predicate returns a verdict while the value reaching the sink is still
  // the original HTTP response string. These falsify the replacement's actual claim —
  // that the returned string is assembled from a literal in our own source.

  const HEX = "0123456789abcdef";

  test("accepts a full 40-hex object name and round-trips it exactly", () => {
    expect(normalizeFullCommitSha(SHA)).toBe(SHA);
  });

  test("every character of the result comes from the hex alphabet", () => {
    // The provenance claim cannot be tested by identity — JS strings compare by value, so
    // a reconstruction of a valid sha is `===` to its input, and must be. What IS testable
    // is that the output alphabet is closed: nothing outside `HEX` can survive.
    const out = normalizeFullCommitSha(SHA);
    expect(out).not.toBeNull();
    for (const ch of out ?? "") expect(HEX).toContain(ch);
  });

  test("the result is always exactly 40 characters", () => {
    expect((normalizeFullCommitSha(SHA) ?? "").length).toBe(40);
  });

  // The rejection table. Each row is a value that must never reach a path or a shell.
  test("rejects a 39-character sha (one short)", () => {
    expect(normalizeFullCommitSha(SHA.slice(0, 39))).toBeNull();
  });

  test("rejects a 41-character sha (one long)", () => {
    expect(normalizeFullCommitSha(`${SHA}0`)).toBeNull();
  });

  test("rejects uppercase hex", () => {
    expect(normalizeFullCommitSha(SHA.toUpperCase())).toBeNull();
  });

  test("rejects path traversal", () => {
    expect(normalizeFullCommitSha("../../etc/passwd")).toBeNull();
  });

  test("rejects 40 characters with exactly one non-hex character", () => {
    // The sharpest row: correct length, correct shape, one byte wrong. A length check or
    // a `slice` would pass this; only a per-character parse refuses it.
    expect(normalizeFullCommitSha(`${SHA.slice(0, 39)}z`)).toBeNull();
    expect(normalizeFullCommitSha(`/${SHA.slice(1)}`)).toBeNull();
    expect(normalizeFullCommitSha(`${SHA.slice(0, 20)}.${SHA.slice(21)}`)).toBeNull();
  });

  test("rejects shell metacharacters and the empty string", () => {
    expect(normalizeFullCommitSha(`${SHA}; rm -rf /`)).toBeNull();
    expect(normalizeFullCommitSha("$(whoami)")).toBeNull();
    expect(normalizeFullCommitSha("")).toBeNull();
  });

  test("rejects whitespace padding that a trim-then-check would have accepted", () => {
    expect(normalizeFullCommitSha(` ${SHA}`)).toBeNull();
    expect(normalizeFullCommitSha(`${SHA}\n`)).toBeNull();
  });

  test("agrees with the predicate on every row — one definition, two shapes", () => {
    // `isFullCommitSha` now delegates. This is the falsifier for that delegation: if the
    // two ever disagree, the file has two notions of "is a git object name" again.
    const rows = [
      SHA,
      SHA.slice(0, 39),
      `${SHA}0`,
      SHA.toUpperCase(),
      "../../etc/passwd",
      `${SHA.slice(0, 39)}z`,
      "",
      `${SHA}\n`,
    ];
    for (const row of rows) expect(isFullCommitSha(row)).toBe(normalizeFullCommitSha(row) !== null);
  });
});

describe("the sinks consume the reconstructed value, not the parameter", () => {
  // This is a SOURCE-level falsifier for the non-local property that the boolean guard
  // could not carry. The letter path exists on `main` today with no guard above it at all
  // (CodeQL alert #670) — the sink was written first and the guard arrived later, covering
  // it by accident of ordering. If a future edit reintroduces the raw `sha` at a path or a
  // shell, this fails loudly instead of silently re-opening the alert.
  const source = readFileSync(new URL("./retraction-actuator.ts", import.meta.url), "utf8");
  const body = source.slice(
    source.indexOf('if (r.command.kind === "push_retraction")'),
    source.indexOf("} catch (err)"),
  );

  test("the commit-message temp path is built from safeSha", () => {
    expect(body).toContain(".git/RETRACTION_MSG_${safeSha.slice(0, 9)}");
  });

  test("the author letter path is built from safeSha", () => {
    expect(body).toContain("-retraction-${safeSha.slice(0, 9)}.md");
  });

  test("the revert's sha ARGUMENT is the reconstructed value, and there is no shell at all", () => {
    // This assertion used to read `git revert --no-commit ${safeSha}` — a template string
    // handed to a shell. That is no longer what the actuator does: the merge from `main`
    // brought the `git(...)` helper (`execFileSync`, no shell), so the sha is passed as an
    // argv element rather than interpolated into a command line. Both hardenings are kept
    // and this row now pins the surviving one. Note it is STRICTLY stronger than the
    // string it replaced: argv removes the quoting question entirely, and `safeSha` still
    // removes the argument-injection one.
    expect(body).toContain('git("revert", "--no-commit", safeSha)');
    // And the shell form must not creep back in beside it.
    expect(body).not.toContain("git revert --no-commit");
  });

  test("no raw `sha` reaches a `git(...)` argument past the guard", () => {
    // The interpolation test below catches `${sha}` in a template. Under the argv form the
    // dangerous shape is different and would slip past it: `git("revert", ..., sha)` passes
    // the raw response string as a bare identifier, with no `${}` anywhere to match on.
    const guard = "if (safeSha === null) throw new Error(";
    const guardEnd = body.indexOf("\n", body.indexOf(guard));
    expect(guardEnd).toBeGreaterThan(0);
    const afterGuard = body.slice(guardEnd);
    // Every `git(` call site in the window, checked for a bare `sha` argument.
    const calls = afterGuard.match(/git\([^)]*\)/g) ?? [];
    for (const call of calls) {
      const args = call.slice(call.indexOf("(") + 1, -1).split(",");
      for (const arg of args) expect(arg.trim()).not.toBe("sha");
    }
    // A control: the loop above is only meaningful if it saw the revert call at all.
    expect(calls).toContain('git("revert", "--no-commit", safeSha)');
  });

  test("no raw `sha` interpolation survives past the guard", () => {
    // The guard line itself interpolates the raw value into the Error message, and that
    // is the ONE permitted use: a refusal has to name what it refused, and an Error
    // string is neither a path nor a shell word. So the window opens on the line AFTER
    // the throw — everything from there to the catch must speak only in `safeSha`.
    const guard = "if (safeSha === null) throw new Error(";
    const guardEnd = body.indexOf("\n", body.indexOf(guard));
    expect(guardEnd).toBeGreaterThan(0);
    const afterGuard = body.slice(guardEnd);
    expect(afterGuard).not.toContain("${sha}");
    expect(afterGuard).not.toContain("${sha.");
    expect(afterGuard).toContain("${safeSha.");
  });
});

describe("the API door reconstructs, it does not merely check", () => {
  // WHY THIS EXISTS. The `safeSha` guard above is the LAST hop, and it was the only one.
  // CodeQL's `js/http-to-file-access` reported two sinks the tests above declared clean
  // (alerts #768 and #776, `writeFileSync` at the commit message and the author letter) and
  // it was right: the boundary above spelled `runs.every((r) => isSha(r.headSha))` and then
  // carried the RAW `head_sha` onward, so two derived values reached both writes as HTTP
  // response bytes —
  //
  //     episodeId    = `ep-${iso.redHead.slice(0, 9)}`
  //     relandRecipe = `git cherry-pick ${breakSha}  # episode ${episodeId}; …`
  //
  // Neither spells `${sha}`, which is exactly why the source-level falsifier above could
  // not see them. That is the predicate-vs-value mistake this file's own
  // `normalizeFullCommitSha` docstring warns about, made one level further up: a boolean is
  // a verdict about the input, and the string that travels on is still the response body.
  //
  // These rows pin the repair at the DOOR, where it fixes the class rather than two
  // instances. They are deliberately source-level: the property is "no raw byte reaches any
  // derived value", which is non-local and has no single call to observe.
  const source = readFileSync(new URL("./retraction-actuator.ts", import.meta.url), "utf8");

  test("the head shas are parsed and re-emitted before anything else touches them", () => {
    expect(source).toContain("runsRaw.workflow_runs.map((r) => normalizeFullCommitSha(r.head_sha))");
  });

  test("a single unparseable head refuses the WHOLE picture — no partial trust", () => {
    // Filtering the bad row out would silently narrow the evidence set the isolation runs
    // over, which is a worse failure than standing down: it would isolate a break against a
    // picture that is missing runs.
    expect(source).toContain("if (normalizedHeads.some((s) => s === null))");
    expect(source).toContain("standing down");
  });

  test("`runs` is built from the normalized values, never from `r.head_sha`", () => {
    const start = source.indexOf("const runs: GateRunFact[]");
    expect(start).toBeGreaterThan(0);
    const decl = source.slice(start, source.indexOf("});", start));
    expect(decl).toContain("normalizedHeads[i]");
    expect(decl).not.toContain("r.head_sha");
  });

  test("`r.head_sha` is read in exactly ONE place in the whole file — the normalize call", () => {
    // The control that makes the three rows above non-vacuous. If a second reader appears,
    // the door has been bypassed and this fails, whatever the new reader is named.
    const readers = source.match(/r\.head_sha/g) ?? [];
    expect(readers).toHaveLength(1);
  });
});
