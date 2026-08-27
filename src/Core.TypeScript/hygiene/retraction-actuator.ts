#!/usr/bin/env bun
// retraction-actuator.ts — the sovereign edge for episode-protocol.ts
// (workitem 081KZHGP45V, final piece; consent: RFC round 2026-08-10 —
// Vera+Riven builder assents, Lior/Soraya conditions folded in, operator
// word "lets do it"). ALL decisions live in the proven state machine; this
// edge only GATHERS facts, STEPS the machine, and EXECUTES its commands.
//
// Per sovereign doctrine the command is push_retraction: a `git revert`
// commit that lands on main.
//
// HOW IT LANDS (changed 2026-08-22 — it previously could not land at all).
// This edge used to run `git push origin HEAD:main`. That push cannot
// succeed: ruleset "CI Gate" (16134995) makes `gate (required)` a required
// status check on `main`, and a required check is evaluated at PUSH time
// against the pushed tip, so a commit that has never been through a check
// run is rejected before any check could start:
//
//     remote: - Required status check "gate (required)" is expected.
//
// `drift-sweep.yml` runs this file on every sweep and was GREEN throughout,
// because `push_retraction` is only ever emitted after main has been red for
// several consecutive ticks with no fleet heal in flight — a state the fleet
// has not reached. That is the same latent vacuity class as the two workflows
// fixed alongside this (`lockfile-healer`, `zetadb-scheduled-node`), one level
// deeper: the fatal push is not in any workflow's YAML, it is behind a bun
// invocation, so grepping `.github/workflows/**` never finds it. The failure
// would have arrived at the worst possible moment — main already red, the
// healer's one job now also failing, and the cause months old.
//
// The retraction now parks on `heartbeat/retraction-<sha>` and lands through a
// PR with squash auto-merge armed, the same proven route as the telemetry
// lanes. Three consequences worth naming:
//   - The gate.yml-dispatch-on-main workaround is GONE. It existed because
//     GITHUB_TOKEN pushes do not trigger workflows; a PAT-opened PR triggers
//     them normally, so `gate` now runs on the retraction itself rather than
//     being kicked off separately against main.
//   - `pushedSha` is the revert commit on the staging branch, which is exactly
//     the SHA `gate` reports its `build-and-test` check-runs against. The next
//     tick's post_push_gate lookup is unchanged and still reads by SHA.
//   - The revert commit carries its own AgencySignature block, because
//     `squash_merge_commit_message` is COMMIT_MESSAGES: the landed commit
//     message is built from the branch's commit messages, not the PR body.
//
// Fact-gathering (pure functions over plain data; the CLI fetches):
//   openTicks   — trailing sweeps whose findings include BD001 (ledger).
//   isolation   — commits between the last green gate push-run head and
//                 the first red one; unique iff exactly one.
//   in-flight   — any queued/in-progress gate push-run, OR main has moved
//                 beyond the first-red head (someone acted; stand down and
//                 re-evaluate next tick — conservative by design).
//   vector-touch— the breaking commit's own paths against the byte-lock
//                 contract patterns (the revert touches the same paths).
//
// Episode bookkeeping: docs/drift-events/retraction-episodes.json
// ({ [episodeId]: { machine: EpisodeState, pushedSha?, updatedTick } }),
// committed by the sweep workflow's existing bookkeeping step. The author
// notification letter is written to docs/letters/ and rides the same
// bookkeeping commit (Riven-2: recipe verbatim).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import { openMergePR } from "../agent-heartbeats/merge-heartbeats-to-main.ts";
import { isValidLane, stagingRef } from "../forge-host/github/flush-via-staging.ts";
import { readLedger } from "./drift-ledger.ts";
import { IDLE, step, type EpisodeEvent, type EpisodeState } from "./episode-protocol.ts";

// ── Pure fact computations ──────────────────────────────────────────────────

/** Trailing consecutive sweeps whose findings include a BD001 entry. */
export function bd001OpenTicks(
  ledger: ReadonlyArray<{ readonly tick: number; readonly findings: ReadonlyArray<{ readonly rule: string }> }>,
): number {
  const sorted = [...ledger].sort((a, b) => a.tick - b.tick);
  let n = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i]!.findings.some((f) => f.rule === "BD001")) n += 1;
    else break;
  }
  return n;
}

export interface GateRunFact {
  readonly headSha: string;
  readonly conclusion: string | null; // "success" | "failure" | null (running)
}

/** From newest-first push-run facts: the first red run after the last green,
 * with its predecessor green head — or null when the picture is not clean. */
export function isolateBreak(
  runsNewestFirst: readonly GateRunFact[],
): { readonly redHead: string; readonly greenHead: string } | null {
  const completed = runsNewestFirst.filter((r) => r.conclusion === "success" || r.conclusion === "failure");
  if (completed.length === 0 || completed[0]!.conclusion !== "failure") return null; // newest completed must be red
  let redHead = completed[0]!.headSha;
  for (const r of completed.slice(1)) {
    if (r.conclusion === "failure") {
      redHead = r.headSha;
      continue;
    } // walk to the FIRST red
    return { redHead, greenHead: r.headSha };
  }
  return null; // no green in window
}

export const VECTOR_PATTERNS = [/golden-vectors[^/]*\.json$/, /^tests\/cross-verification\//];

export function touchesVectors(paths: readonly string[]): boolean {
  return paths.some((p) => VECTOR_PATTERNS.some((re) => re.test(p)));
}

// ── Attribution ─────────────────────────────────────────────────────────────
//
// Semantics deliberately identical to `isAttributable` in
// `src/Core.TypeScript/ci/stalled-pr-classifier.ts` (PR #15698): exact
// repo-relative path equality, and empty-means-NOT-attributable. Two copies of
// one rule is a reconcilability risk, so the shape is kept byte-for-byte
// comparable rather than "improved" here; if #15698 lands, this is the call
// site to collapse onto its export.

/**
 * Is the failure attributable to this candidate commit?
 *
 * Attributable iff the failing run's subject paths INTERSECT the candidate's
 * own diff. The asymmetry is the safety property: empty or absent
 * `subjectPaths` yields NOT attributable, so an underivable subject WITHHOLDS
 * the remedy rather than licensing it. Being wrong in this direction costs a
 * delay; being wrong in the other direction retracts an innocent commit.
 *
 * Not a skip and not a default-permit. `[]` means "not derivable", which is
 * `unknown` — never "unrelated", and never "fine to proceed".
 */
export function isAttributable(subjectPaths: readonly string[], candidatePaths: readonly string[]): boolean {
  if (subjectPaths.length === 0) return false;
  const diff = new Set(candidatePaths);
  return subjectPaths.some((p) => diff.has(p));
}

/**
 * Repo-relative paths the RED gate run is ABOUT.
 *
 * THERE IS NO DERIVER WIRED, AND THIS RETURNS THE HONEST EMPTY SET RATHER THAN
 * A PLAUSIBLE GUESS. The actuator reduces the red run to a single boolean
 * before the machine sees it — `GateRunFact` carries `headSha` and
 * `conclusion` and nothing else. No failing job, no failing step, no
 * annotation, no log is ever fetched for the red run, so there is no evidence
 * from which a subject could be derived.
 *
 * Consequence, stated plainly: `isAttributable` therefore returns false for
 * every candidate, and the machine refuses every retraction. That is the
 * correct behaviour for a mechanism that cannot tell whose fault a failure is
 * — not a bug to route around. Wiring a real deriver (annotations via
 * `/actions/runs/{id}/jobs`, per `src/Core.TypeScript/ci/toolchain-install-stall.ts`)
 * is what would let it act, and that is an operator decision, not a lint fix.
 */
export function redRunSubjectPaths(): readonly string[] {
  return [];
}

// ── Capability preflight ────────────────────────────────────────────────────
//
// A mechanism that cannot complete its own happy path must SAY SO on every
// run. The actuator's terminal act is opening a PR; under
// `.github/workflows/drift-sweep.yml` the job grants `contents: write` and
// `actions: read` only, so `POST /repos/{repo}/pulls` 403s. The old code
// caught that, printed one truncated line, and called `process.exit(0)` — a
// silent refusal indistinguishable from a tick with nothing to do, which is
// why nobody noticed in the four days since 2026-08-22.
//
// This check is STATIC (it reads the workflow's own permissions block) so it
// reports the incapacity whether or not the actuator would have acted this
// tick. A check that only fires on the path it is guarding tells you nothing
// on every run where that path is not taken.

/** Scopes the actuator needs to complete a retraction end to end. */
export const REQUIRED_SCOPES = ["contents: write", "pull-requests: write"] as const;

/** The workflow whose `permissions:` block governs the actuator at runtime. */
export const ACTUATOR_WORKFLOW = ".github/workflows/drift-sweep.yml";

/**
 * Scopes granted by a workflow's TOP-LEVEL `permissions:` mapping.
 *
 * Top-level only, and column 0 is how that is enforced: a `permissions:` nested
 * under a job is indented, and reading one of those as the effective grant
 * would over-report. Returns `[]` for a workflow with no top-level block —
 * which, per GitHub's model, means the default grant applies, so an empty
 * result is reported as "unknown", never as "nothing granted".
 */
export function grantedScopes(workflowYaml: string): string[] {
  const lines = workflowYaml.split("\n");
  const start = lines.findIndex((l) => /^permissions:\s*$/.test(l));
  if (start === -1) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const m = /^\s+([a-z-]+):\s*([a-z]+)/.exec(line);
    if (m === null) break; // first non-entry line ends the block
    out.push(`${m[1]!}: ${m[2]!}`);
  }
  return out;
}

/** Required scopes absent from `granted`. */
export function missingScopes(granted: readonly string[], required: readonly string[] = REQUIRED_SCOPES): string[] {
  const have = new Set(granted);
  return required.filter((r) => !have.has(r));
}

/**
 * Emit the incapacity as a GitHub `::error` annotation.
 *
 * An annotation and not a non-zero exit, on purpose: failing the step would
 * take the whole drift sweep red for a condition that is a standing design
 * state, and a lane that is always red gets muted, which would recreate the
 * silence this is fixing. The annotation surfaces on every run in the checks
 * UI and in `GET /check-runs/{id}/annotations`, so it is machine-readable too.
 */
export function reportIncapacity(missing: readonly string[], log: (s: string) => void = console.log): boolean {
  if (missing.length === 0) return false;
  log(
    `::error title=Retraction actuator cannot complete its happy path::` +
      `${ACTUATOR_WORKFLOW} does not grant ${missing.join(", ")}. ` +
      `The actuator's terminal act is opening a PR, so it will 403 and refuse. ` +
      `This step has therefore never fired since 2026-08-22. ` +
      `Granting the scope is an operator decision (#15698 §5.1) — this message is the report, not a request.`,
  );
  return true;
}

// ── Edge state ──────────────────────────────────────────────────────────────

interface EpisodeRecord {
  readonly machine: EpisodeState;
  readonly pushedSha?: string;
  readonly updatedTick: number;
}
type EpisodeFile = Record<string, EpisodeRecord>;

const EPISODES_PATH = "docs/drift-events/retraction-episodes.json";

function readEpisodes(): EpisodeFile {
  if (!existsSync(EPISODES_PATH)) return {};
  return JSON.parse(readFileSync(EPISODES_PATH, "utf8")) as EpisodeFile;
}

function writeEpisodes(e: EpisodeFile): void {
  const sorted = Object.fromEntries(Object.entries(e).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(EPISODES_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

// ── IO shell ────────────────────────────────────────────────────────────────

/**
 * One `git` invocation. Arguments as an ARRAY, and NO SHELL.
 *
 * This was `execSync` over a concatenated string, which put `head_sha` from the Actions
 * API onto a shell command line (`git rev-list ${greenHead}..${redHead}`) inside a job
 * that holds a `GH_TOKEN` with push access to `main` -- CodeQL `js/command-line-injection`,
 * critical, and correct. The usual dismissal ("GitHub only returns real shas") is a claim
 * about the server that is checked nowhere.
 *
 * `execFileSync` removes the shell entirely, so there is no command line for a response
 * body to be read as. It also removes the quoting: the `git config user.name` calls below
 * used to carry literal `"` characters that only worked because a shell stripped them.
 *
 * Exported so the absence of the shell is a FALSIFIER rather than a claim: the test feeds
 * it an argument containing `;` and asserts git rejects it as a revision, which is the
 * assertion that goes red the moment anyone reintroduces a concatenated command line.
 */
export function git(...args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Lowercase hex, 7..64 -- sha1 (40) and a future sha256 (64). Ordinal, anchored. */
const SHA_RE = /^[0-9a-f]{7,64}$/;

/**
 * Is this a sha? The gate for any API- or `git`-derived value that becomes an ARGUMENT.
 *
 * Removing the shell closes command injection; it does not close ARGUMENT injection --
 * `git revert --no-edit <x>` with `x` of `--upload-pack=...` is still a git option, not a
 * revision. Every value that reaches `git` as data is checked against this first, and a
 * value that fails makes the picture UNCLEAN rather than being repaired into one.
 */
export function isSha(value: string): boolean {
  return SHA_RE.test(value);
}

/**
 * The retraction commit's message, signature block last and contiguous.
 *
 * It must be on the COMMIT and not only on the PR: the repository's
 * `squash_merge_commit_message` is COMMIT_MESSAGES, so what lands on `main` is built
 * from the branch's commit messages. `git revert` writes no trailers of its own, so a
 * bare revert would arrive on main unsigned.
 *
 * `Action-Mode: autonomous-fail-closed` is the honest value: the actuator refuses and
 * stands down (the `push_result: pushed=false` transition) rather than proceeding when
 * the route fails.
 */
/**
 * The sixteen bytes a git object name may contain — and the ONLY source of bytes
 * `normalizeFullCommitSha` returns. Every character of that function's result is read
 * out of this literal, so it is the whole provenance of every sanitised sha in this file.
 */
const HEX_DIGITS = "0123456789abcdef";

/**
 * Parse a full 40-hex git object name and RE-EMIT it from `HEX_DIGITS`, or refuse.
 *
 * `breakSha` reaches this edge from the GitHub API (`workflow_runs[].head_sha`) via
 * `isolateBreak`, and it is then interpolated into a SHELL COMMAND
 * (`git revert --no-commit <sha>`) and into two FILE PATHS (the commit-message temp file
 * and the author letter). CodeQL flags exactly that shape — `js/http-to-file-access`,
 * "write to file system depends on untrusted data" — and it is right to.
 *
 * A boolean predicate cannot fix that, and the earlier `isFullCommitSha(sha)` guard did
 * not: a predicate returns a VERDICT while the value that goes on to the sink is still
 * the original response byte-string. Any tool that treated a boolean as a barrier would
 * be unsound, so the tool was correct and the code was merely safe-in-fact.
 *
 * This function returns the SANITISED VALUE instead. Each character is looked up in
 * `HEX_DIGITS` and the copy appended to the result comes from `HEX_DIGITS`, never from
 * `value` — so no byte of the HTTP response body survives into the returned string. The
 * input is used only to choose indices; the output is assembled from a literal in this
 * file. (Same discipline as re-emitting a timestamp from parsed epoch milliseconds:
 * validate, then rebuild from something we own.)
 *
 * The improvement is structural, not cosmetic. With a predicate, the safety of a sink is
 * a NON-LOCAL property — the author-letter path is safe only because a guard happens to
 * sit above it in the same `try`, which the type system cannot see and a reviewer reading
 * that line alone cannot either. That is not hypothetical: the identical letter-path sink
 * exists on `main` today with no guard at all (alert #670) — the sink was written first
 * and the guard arrived later, covering it by accident of ordering. Returning
 * `string | null` makes the safe value a DIFFERENT BINDING from the tainted one, so a
 * future sink that reaches for `sha` instead of `safeSha` is a visible mistake in review
 * rather than an invisible one.
 *
 * Fail-closed: `null` makes the caller record `push_result: pushed=false` and stand down.
 */
export function normalizeFullCommitSha(value: string): string | null {
  if (value.length !== 40) return null;
  const out: string[] = [];
  for (const ch of value) {
    const i = HEX_DIGITS.indexOf(ch);
    if (i < 0) return null;
    out.push(HEX_DIGITS[i]!);
  }
  // Code-point count, not UTF-16 length: 40 units containing a surrogate pair would
  // yield fewer iterations. Belt-and-braces — an astral character fails the lookup above.
  if (out.length !== 40) return null;
  return out.join("");
}

/**
 * Predicate form, kept for the existing callers and tests that ask a yes/no question.
 * Delegates so there is exactly ONE definition of "is a git object name" in this file.
 * Prefer `normalizeFullCommitSha` anywhere the value then reaches a shell or a path:
 * a boolean is an assertion about the input, the returned string IS the safe value.
 */
export function isFullCommitSha(value: string): boolean {
  return normalizeFullCommitSha(value) !== null;
}

export function retractionCommitMessage(breakSha: string, episodeId: string, openTicks: number): string {
  return [
    `revert: retract ${breakSha.slice(0, 9)} (LD/BD001 sovereign auto-revert, episode ${episodeId})`,
    "",
    `main's build-and-test was red for ${String(openTicks)} consecutive tick(s) with no`,
    "fleet heal in flight, and the break isolated to a single commit. A retraction is a",
    "retraction of bytes, never a judgment of the lane.",
    "",
    `This reverts commit ${breakSha}.`,
    "",
    "Agency-Signature-Version: 1",
    "Agent: retraction-actuator",
    "Agent-Runtime: GitHub Actions",
    "Agent-Model: deterministic TypeScript state machine (episode-protocol.ts)",
    "Credential-Identity: github-actions[bot]",
    "Credential-Mode: dedicated-agent",
    "Human-Review: not-implied-by-credential",
    "Human-Review-Evidence: none",
    "Action-Mode: autonomous-fail-closed",
    // FULL 26-char ZetaId. This read `081KZHGP45V` — the first 11 characters of
    // `081KZHGP45V08QG0R001C0NFFS` (workitems/done/2026/08/...auto-revert-healer...).
    // A TRUNCATED id is worse than a wrong one, because it falls between the two
    // checks instead of into either: `agencysignature-block.ts` TASK_RE requires the
    // full width and REJECTS it, so every commit this actuator writes would fail the
    // signature gate at the moment it is needed most (main red, auto-revert firing);
    // while AH006 `audit-task-zetaid-resolves.ts` extracts only well-SHAPED ids, so a
    // prefix contributes zero ids and the audit reports "no Task ids" with rc=0. Loud
    // in the lane that runs during an incident, silent in the audit built to catch it.
    "Task: 081KZHGP45V08QG0R001C0NFFS",
    "Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>",
  ].join("\n");
}

async function gh(path: string): Promise<unknown> {
  const token = process.env["GH_TOKEN"];
  const repo = process.env["REPO"];
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`gh ${path}: ${String(res.status)}`);
  return res.json();
}

/**
 * The workflow file, or "" when it is absent.
 *
 * NOT `existsSync(p) ? readFileSync(p) : ""`: that is two syscalls with a window between
 * them, so the answer the check returned is already stale when the read runs (TOCTOU,
 * CWE-367) — and a preflight whose own guard prevents nothing is exactly the vacuity this
 * file exists to close. One syscall, and ENOENT is the absence answer. Any other errno
 * rethrows: an unreadable workflow is not an ungranted scope, and reporting it as one
 * would manufacture a false incapacity.
 */
function readWorkflowOrEmpty(): string {
  try {
    return readFileSync(ACTUATOR_WORKFLOW, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw e;
  }
}

const invokedDirectly = typeof process.argv[1] === "string" && /retraction-actuator\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const repo = process.env["REPO"];
  if (!process.env["GH_TOKEN"] || !repo) {
    console.error("retraction-actuator: GH_TOKEN and REPO required");
    process.exit(2);
  }

  // CAPABILITY PREFLIGHT — runs before any decision, on every tick, pass or
  // fail. Placed here rather than at the push site so the incapacity is
  // reported even on the (overwhelmingly common) ticks where main is green and
  // the push site is never reached.
  reportIncapacity(missingScopes(grantedScopes(readWorkflowOrEmpty())));

  const ledger = readLedger("docs/drift-events");
  const openTicks = bd001OpenTicks(ledger);
  const latestTick = ledger.reduce((m, e) => Math.max(m, e.tick), 0);
  console.log(`actuator: BD001 open ${String(openTicks)} consecutive tick(s) at tick ${String(latestTick)}`);

  const runsRaw = (await gh("/actions/workflows/gate.yml/runs?branch=main&event=push&per_page=15")) as {
    workflow_runs: { head_sha: string; status: string; conclusion: string | null }[];
  };
  const anyRunning = runsRaw.workflow_runs.some((r) => r.status !== "completed");
  // THE DOOR. The API's `head_sha` becomes a `git` argument, two file PATHS, and — via
  // `episodeId` and `relandRecipe` — the CONTENT of a commit message and an author letter.
  // This is the one place it enters, so it is PARSED AND RECONSTRUCTED here rather than
  // merely checked, and the whole picture is refused if any head fails.
  //
  // It used to be `runs.every((r) => isSha(r.headSha))` over the raw values, and that was
  // the predicate-vs-value mistake this file's own `normalizeFullCommitSha` docstring warns
  // about, made one level up. A boolean is a verdict about the input; the string that
  // travelled on was still the HTTP response body. `safeSha` re-sanitised it at the last
  // hop, which is why the two file PATHS were clean — but `episodeId` (`ep-${redHead.slice(0,9)}`)
  // and `relandRecipe` (`git cherry-pick ${breakSha}`) are built upstream of that hop and
  // carried raw bytes into both `writeFileSync` calls. CodeQL's `js/http-to-file-access` was
  // RIGHT about exactly those two sinks (alerts #768, #776), and the source-level falsifier
  // in `retraction-actuator-message.test.ts` could not see it: neither alias spells `${sha}`.
  //
  // Reconstructing at the door fixes the class rather than the two instances. Every value
  // derived from a gate run below is now assembled from `HEX_DIGITS`, a literal in this
  // file. `safeSha` downstream is kept as belt-and-braces, not as the only guard.
  const normalizedHeads = runsRaw.workflow_runs.map((r) => normalizeFullCommitSha(r.head_sha));
  if (normalizedHeads.some((s) => s === null)) {
    console.log("actuator: a gate run head_sha is not a sha - the picture is not trustworthy, standing down");
    process.exit(0);
  }
  const runs: GateRunFact[] = runsRaw.workflow_runs.map((r, i) => ({
    headSha: normalizedHeads[i] ?? "",
    conclusion: r.conclusion,
  }));
  const iso = isolateBreak(runs);

  const episodes = readEpisodes();
  const episodeId = iso
    ? `ep-${iso.redHead.slice(0, 9)}`
    : latestTick > 0
      ? `ep-tick-${String(latestTick)}`
      : "ep-none";
  const rec: EpisodeRecord = episodes[episodeId] ?? { machine: IDLE, updatedTick: latestTick };
  let machine = rec.machine;
  let pushedSha = rec.pushedSha;

  // Post-push validation first, if we previously pushed (post_push_gate by SHA).
  if (machine.kind === "landed" && pushedSha !== undefined) {
    const checks = (await gh(`/commits/${pushedSha}/check-runs?per_page=100`)) as {
      check_runs: { name: string; status: string; conclusion: string | null }[];
    };
    const legs = checks.check_runs.filter((c) => c.name.startsWith("build-and-test"));
    if (legs.length > 0 && legs.every((c) => c.status === "completed")) {
      const pass = legs.every((c) => c.conclusion === "success");
      const r = step(episodeId, machine, { kind: "post_push_gate", tick: latestTick, pass });
      machine = r.state;
      console.log(`actuator: post_push_gate pass=${String(pass)} → ${machine.kind} (${r.command.kind})`);
    } else {
      console.log("actuator: post-push gate still running — nothing to do this tick");
    }
  }

  // Heal observed while attempted → stand down (Vera-2 sovereign form).
  if (machine.kind === "attempted" && openTicks === 0) {
    const r = step(episodeId, machine, { kind: "sweep_healed", tick: latestTick });
    machine = r.state;
    console.log(`actuator: healed before landing → ${machine.kind}`);
  }

  // Trigger evaluation.
  if (machine.kind === "idle" && iso !== null) {
    const mainHead = git("rev-parse", "origin/main");
    const fleetInFlight = anyRunning || mainHead !== iso.redHead;
    const candidates = git("rev-list", `${iso.greenHead}..${iso.redHead}`)
      .split("\n")
      .filter((l) => isSha(l));
    const single = candidates.length === 1 ? candidates[0]! : null;
    const paths =
      single === null
        ? []
        : git("diff-tree", "--no-commit-id", "--name-only", "-r", single).split("\n").filter(Boolean);
    const author = single === null ? "unknown" : git("log", "-1", "--format=%an", single);
    const event: EpisodeEvent = {
      kind: "break_detected",
      tick: latestTick,
      openTicks,
      candidateShas: single === null ? candidates : [single],
      fleetHealInFlight: fleetInFlight,
      touchesVectorContracts: touchesVectors(paths),
      authorPersona: author,
      // `redRunSubjectPaths()` is the honest empty set — no deriver is wired,
      // so nothing is known about WHAT the red run was about. Empty ⇒ not
      // attributable ⇒ the machine refuses. See both functions for why that is
      // the correct outcome rather than a gap to paper over.
      attributable: isAttributable(redRunSubjectPaths(), paths),
    };
    const r = step(episodeId, machine, event);
    machine = r.state;
    console.log(
      `actuator: break_detected → ${machine.kind} (${r.command.kind}: ${"reason" in r.command ? r.command.reason : r.command.breakSha})`,
    );

    if (r.command.kind === "push_retraction") {
      const sha = r.command.breakSha;
      // MAIN'S NO-SHELL FORM, THE PR'S STAGING ROUTE. Two independent hardenings landed
      // on the two sides of this merge and both are kept: `git(...)` (execFileSync, no
      // shell — see its docstring) is how every command below is spelled, and the
      // retraction lands via `heartbeat/*` + PR rather than a push at `main`.
      git("config", "user.name", "github-actions[bot]");
      git("config", "user.email", "github-actions[bot]@users.noreply.github.com");
      git("fetch", "origin", "main");
      git("checkout", "-B", "retraction-work", "origin/main");
      let msgFile = "";
      try {
        // Parse-and-RECONSTRUCT before the value reaches a `git` argument or a path.
        // `safeSha` is rebuilt character-by-character out of `HEX_DIGITS`, a literal in
        // this file, so no byte of the GitHub API response survives into it. Removing the
        // shell closed command injection; this closes ARGUMENT injection, which it did
        // not. Inside the try so a refusal is recorded as `push_result: pushed=false` and
        // the machine stands down. The raw `sha` appears ONLY in the diagnostic below,
        // which is what makes a refusal legible; it never reaches a path or a command.
        const safeSha = normalizeFullCommitSha(sha);
        if (safeSha === null) throw new Error(`breakSha is not a 40-hex git object name: ${sha}`);
        const lane = `retraction-${safeSha.slice(0, 9)}`;
        if (!isValidLane(lane)) throw new Error(`retraction lane name is not a safe ref: ${lane}`);
        const ref = stagingRef(lane);
        msgFile = `.git/RETRACTION_MSG_${safeSha.slice(0, 9)}`;
        // `--no-commit` so the message is ours: the revert must carry an
        // AgencySignature block to arrive on main signed (see retractionCommitMessage).
        git("revert", "--no-commit", safeSha);
        writeFileSync(msgFile, `${retractionCommitMessage(safeSha, episodeId, openTicks)}\n`);
        git("commit", "--no-verify", `--file=${msgFile}`);
        pushedSha = git("rev-parse", "HEAD");
        // `heartbeat/*` (ruleset 16934633) carries `deletion` only — no required checks,
        // no non-fast-forward rule — so parking here always succeeds and the retraction
        // is never lost even if the PR is slow to land.
        git("push", "--force-with-lease", "origin", `HEAD:refs/heads/${ref}`);
        const opened = openMergePR(
          repo,
          ref,
          "main",
          `revert: retract ${safeSha.slice(0, 9)} — sovereign auto-revert (episode ${episodeId})`,
          [
            `Automated retraction of \`${safeSha}\` by the sovereign auto-revert healer (081KZHGP45V).`,
            "",
            `main's \`build-and-test\` was red for ${String(openTicks)} consecutive tick(s) with no fleet`,
            "heal in flight, and the break isolated to this single commit.",
            "",
            'This PR exists rather than a direct push because ruleset "CI Gate" makes',
            "`gate (required)` a required status check on `main`, evaluated at push time — a",
            "direct push of a never-checked commit is rejected before any check can start.",
            "The signature block that lands on `main` rides the revert COMMIT, not this body,",
            "because `squash_merge_commit_message` is COMMIT_MESSAGES.",
          ].join("\n"),
        );
        if ("error" in opened) throw new Error(opened.error);
        const pr = step(episodeId, machine, { kind: "push_result", tick: latestTick, pushed: true });
        machine = pr.state;
        console.log(
          `actuator: retraction ${pushedSha.slice(0, 9)} (reverts ${safeSha.slice(0, 9)}) parked on ${ref}; ` +
            `PR #${String(opened.ok.number)} ${opened.ok.reused ? "re-used" : "opened"} (${opened.ok.url})` +
            (opened.ok.armed
              ? ", squash auto-merge armed"
              : `, auto-merge NOT armed: ${opened.ok.armError ?? "unknown"}`),
        );
        // Riven-2: the letter, recipe verbatim.
        const letter = `docs/letters/to-${r.command.notifyAuthor.persona.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-retraction-${safeSha.slice(0, 9)}.md`;
        writeFileSync(
          letter,
          [
            `# Retraction notice — ${safeSha.slice(0, 9)} (episode ${episodeId})`,
            "",
            `Your commit ${safeSha.slice(0, 9)} was retracted by the sovereign`,
            "auto-revert healer: main's build-and-test was red for",
            `${String(openTicks)} consecutive tick(s) with no fleet heal in flight.`,
            "A retraction is a retraction of bytes, never a judgment of the",
            "lane. Re-land is one command:",
            "",
            "```bash",
            r.command.notifyAuthor.relandRecipe,
            "```",
            "",
            "— the retraction actuator (081KZHGP45V), on behalf of the fleet",
            "",
          ].join("\n"),
        );
        console.log(`actuator: letter written ${letter}`);
      } catch (err) {
        const pr = step(episodeId, machine, { kind: "push_result", tick: latestTick, pushed: false });
        machine = pr.state;
        // LOUD, not a bare log. This is the branch a 403 lands in, and until
      // 2026-08-26 it printed one line among hundreds and exited 0 — a
      // mechanism failing to act looked exactly like one with nothing to do.
      // The annotation makes the refusal visible in the checks UI and via
      // `GET /check-runs/{id}/annotations` without taking the sweep red.
      console.log(
        `::error title=Retraction actuator failed to push::` +
          `episode ${episodeId} reached the push and did not complete it: ` +
          `${(err as Error).message.slice(0, 200)}`,
      );
      } finally {
        if (msgFile !== "") rmSync(msgFile, { force: true });
        // Was `2>/dev/null || true` -- shell for "best effort". With no shell the
        // best-effort is a `catch`, which is also the honest place for it.
        try {
          git("checkout", "--detach", "origin/main");
        } catch {
          /* best effort */
        }
      }
    }
  } else if (machine.kind === "idle") {
    console.log("actuator: no clean red/green picture — nothing to do");
  }

  const next: EpisodeFile = {
    ...episodes,
    [episodeId]: { machine, updatedTick: latestTick, ...(pushedSha !== undefined ? { pushedSha } : {}) },
  };
  // Persist only meaningful state: never mint brand-new idle records (one
  // per tick of quiet would be ledger noise, not bookkeeping).
  if (episodeId !== "ep-none" && (machine.kind !== "idle" || episodes[episodeId] !== undefined)) writeEpisodes(next);
  console.log(`actuator: episode ${episodeId} → ${machine.kind}`);
  process.exit(0);
}
