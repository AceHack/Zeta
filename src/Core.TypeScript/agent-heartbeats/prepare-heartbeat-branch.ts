#!/usr/bin/env bun

import { spawnSync } from "node:child_process";

export interface PreparedHeartbeatBranch {
  readonly head: string;
  readonly remoteFound: boolean;
  readonly carried: boolean;
  /**
   * Conflicting paths resolved by the insertion-only rule below, in index order.
   *
   * Empty on every clean carry, which is the ordinary case. A non-empty value is not a
   * warning — it is the record of which paths the squash-flush's lost ancestry would
   * otherwise have wedged the lane on, and it is printed by the CLI so a tick that
   * healed itself says so out loud rather than looking like a tick that never diverged.
   */
  readonly healed: readonly string[];
}

export type PrepareHeartbeatResult =
  | { readonly ok: true; readonly value: PreparedHeartbeatBranch }
  | { readonly ok: false; readonly error: string };

interface GitResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

const AGENT_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9_-])){0,62}$/;

function git(cwd: string, args: readonly string[]): GitResult {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.error) {
    return { status: -1, stdout: "", stderr: result.error.message };
  }
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function failed(operation: string, result: GitResult): PrepareHeartbeatResult {
  const detail = (result.stderr || result.stdout).trim();
  return { ok: false, error: `${operation} failed${detail ? `: ${detail}` : ""}` };
}

/** Read one blob out of the conflicted index as raw bytes; `undefined` when that stage is absent. */
function stageBlob(cwd: string, stage: 1 | 2 | 3, path: string): Buffer | undefined {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["cat-file", "blob", `:${String(stage)}:${path}`], {
    cwd,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.status === 0 && result.stdout ? result.stdout : undefined;
}

/**
 * Split a blob into newline-TERMINATED lines, byte-faithfully.
 *
 * `latin1` is deliberate: it is the one Node encoding that is a bijection on bytes, so an
 * arbitrary non-UTF-8 byte survives the round trip instead of becoming U+FFFD and comparing
 * equal to a different byte. A trailing fragment with no `\n` is kept as its own element so the
 * caller can see that the blob does not end on a line boundary.
 */
function terminatedLines(blob: Buffer): readonly string[] {
  const text = blob.toString("latin1");
  const lines: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 0x0a) {
      lines.push(text.slice(start, index + 1));
      start = index + 1;
    }
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

/**
 * Does `theirs` differ from `ours` by INSERTIONS ONLY — every line of `ours` present, in order?
 *
 * This is the losslessness condition stated at the level it actually holds. Taking `theirs` is
 * safe exactly when main's copy embeds in the lane's as a line SUBSEQUENCE: each complete line
 * main holds still appears, verbatim, with its neighbours still on the correct side of it. A line
 * main holds that is absent, rewritten, or reordered breaks the embedding and the rule refuses.
 *
 * WHY SUBSEQUENCE AND NOT PREFIX (widened 2026-08-27). The original rule required main's copy to
 * be a whole-line PREFIX, which is the shape an append-only log has — new records land after the
 * old ones, so the old ones sit at the front. It is NOT the shape of a canonically-ORDERED
 * accumulating set: `docs/room-evidence/index.json` re-serialises its entries sorted by `eventId`
 * (`canonicalIndex` in `observe/room/durable-room-evidence-live-feed.ts`), so a new entry whose id
 * sorts low lands BEFORE main's entries and the prefix test is false on a file that lost nothing.
 * Measured on the live alexa lane at 07:10Z (run 33048649621, job 98438518098):
 *
 *     stage2 (main)  333 bytes, entries [59e83513…]
 *     stage3 (lane)  591 bytes, entries [11d5cf2c…, 59e83513…]
 *     prefix?        NO  — the two copies diverge at byte 60, inside the first eventId
 *     subsequence?   YES — main's 11 lines embed in the lane's 17; the diff is pure `+`
 *
 * Prefix is the special case of subsequence where the insertions all land at the end, so nothing
 * the old rule accepted is now refused; the widening only reaches cases the old rule failed on.
 *
 * WHY IT STILL CANNOT CLOBBER, which is the only thing that makes an automatic resolution
 * admissible. Subsequence is not "the sides look similar" — it is a proof obligation discharged
 * against the actual index bytes, and it fails on every way a copy can lose content:
 *   - main holds a line the lane never saw (a rival writer, a backfill) → not embeddable
 *   - main's line was rewritten in place (an edited row, a changed `file` field) → not embeddable
 *   - main's lines appear but out of order (a re-sort under a different key) → not embeddable
 * `data/ci-runs.jsonl` — main 539 rows, lane 516 — is the live refusal: main holds rows this lane
 * never had, so it fails subsequence exactly as it failed prefix. Union resolves that path first
 * (it is declared in `.gitattributes`), so it never reaches here; the point is that if the
 * declaration were removed, this rule would refuse it rather than silently drop 23 rows.
 *
 * THE WHOLE-LINE PROPERTY NOW LIVES IN THE TOKENISATION, and that relocation is deliberate. The
 * prefix rule needed a separate `ours` ends-with-newline guard, because a byte prefix that stops
 * mid-line rewrites main's final record rather than appending after it — `{"row":2}` silently
 * becoming `{"row":22}`. `terminatedLines` carries the newline INSIDE each token, so an
 * unterminated trailing fragment is a distinct token that can only match another unterminated
 * fragment; `{"row":2}` and `{"row":22}\n` are simply unequal and the embedding fails. The
 * explicit guard was kept for one revision and then removed on measurement: mutating it away
 * killed no test, which makes it a check that cannot fail — the thing this file is otherwise
 * built to refuse. The property it asserted is pinned instead by the mid-line refusals below,
 * which DO die when the tokeniser drops its trailing fragment.
 *
 * An EMPTY `ours` is the degenerate true case, and it is the exact signature this whole class was
 * first measured with: "main's side of the hunk is EMPTY (`ours=0`)". Nothing of main's is at risk
 * because main has nothing on that path.
 *
 * Binary is refused outright. A NUL byte means the line-boundary reasoning above does not apply,
 * and there is no insertion-only argument to make about a blob with no lines.
 */
export function isLosslessLineExtension(ours: Buffer, theirs: Buffer): boolean {
  if (ours.includes(0) || theirs.includes(0)) return false;
  // A strict extension is strictly longer. Equal blobs never conflict, and a longer `ours` holds
  // content the lane cannot be carrying, so both are refused before any line work happens.
  if (ours.length >= theirs.length) return false;

  const oursLines = terminatedLines(ours);
  const theirsLines = terminatedLines(theirs);
  let matched = 0;
  for (const line of theirsLines) {
    if (matched < oursLines.length && oursLines[matched] === line) matched += 1;
  }
  return matched === oursLines.length;
}

/** What the insertion-only rule concluded about the conflicted index as a whole. */
export type LosslessExtensionHealResult =
  | { readonly ok: true; readonly healed: readonly string[] }
  | { readonly ok: false; readonly blocked: readonly string[] };

/**
 * Resolve the conflicts a squash-flush's LOST ANCESTRY creates, and only those.
 *
 * WHY THIS EXISTS — the self-sustaining loop, measured 2026-08-26.
 * ----------------------------------------------------------------
 * The flush lands a lane on `main` with `--squash`, so main's copy of a lane-written file has no
 * ancestry connecting it back to the lane that wrote it. The next tick's merge base therefore
 * predates the flush and holds NEITHER side, and git reports ADD/ADD on a file whose two sides are
 * the same append-only stream at two different lengths. Measured on the live alexa lane at 00:54Z:
 *
 *     merge-base 443cdacdb5 (22:27:58Z)  data/tick-reasoning.jsonl absent
 *     main       16 rows                 lane 30 rows, main's 16 are rows 1..16 VERBATIM
 *
 * That failure is self-sustaining, and this is the part a per-path declaration does not address: a
 * failed tick never pushes, so the lane ref stays frozen, so the merge base never advances past the
 * flush, so the next tick reproduces the identical add/add. Eight lanes-worth of this class since
 * 2026-08-16, each cleared only by a human diagnosing it and hand-writing a `.gitattributes` line;
 * the loop itself survived every one of those fixes. Resolving the conflict lets the tick commit
 * and push, which re-parents the lane onto current main — the base advances, and the divergence is
 * gone rather than deferred.
 *
 * WHY IT CANNOT CLOBBER, which is the only thing that makes an automatic resolution admissible:
 * it fires on a path ONLY when the lane's copy differs from main's by INSERTIONS ONLY — every line
 * main holds still present, in order — which is checked against the actual bytes in the index at
 * merge time. Under that condition taking the lane's copy is losslessness by construction. This is
 * strictly narrower than the `merge=union` declarations in `.gitattributes`, and deliberately:
 * union is a per-path ASSERTION that a human made once and that nothing rechecks, while this is a
 * per-tick MEASUREMENT. It is also free of union's documented duplicate-row hazard (`.gitattributes`
 * stated limit 3), because inserting nothing cannot duplicate anything.
 *
 * WHAT IT REFUSES, which is what keeps the backpressure typed. If main holds a single line the lane
 * does not — a rival writer, a backfill, a rewritten row — or holds main's lines in an order the
 * lane reversed, the embedding fails and the tick dies exactly as it does today, with the original
 * git error. Measured live on the same refs: `data/ci-runs.jsonl` is main=539 lane=516 and fails,
 * because all three lanes append to it and main therefore holds rows this lane never saw, so this
 * rule leaves it to its declared driver. That is the intended split, not a gap.
 *
 * ALL-OR-NOTHING. The index is inspected in full before a single path is written, so a run that
 * refuses one path mutates nothing and the caller reports git's own message unchanged.
 */
export function healLosslessExtensionConflicts(cwd: string): LosslessExtensionHealResult {
  const unmerged = git(cwd, ["diff", "--name-only", "--diff-filter=U", "-z"]);
  if (unmerged.status !== 0) return { ok: false, blocked: [] };
  const paths = unmerged.stdout.split("\0").filter((p) => p.length > 0);
  if (paths.length === 0) return { ok: false, blocked: [] };

  const blocked = paths.filter((path) => {
    const ours = stageBlob(cwd, 2, path) ?? Buffer.alloc(0);
    const theirs = stageBlob(cwd, 3, path);
    return theirs === undefined || !isLosslessLineExtension(ours, theirs);
  });
  if (blocked.length > 0) return { ok: false, blocked };

  for (const path of paths) {
    const take = git(cwd, ["checkout", "--theirs", "--", path]);
    if (take.status !== 0) return { ok: false, blocked: [path] };
    const stage = git(cwd, ["add", "--", path]);
    if (stage.status !== 0) return { ok: false, blocked: [path] };
  }
  return { ok: true, healed: paths };
}

/**
 * Register the merge drivers named by the repository `.gitattributes` heartbeat block.
 *
 * `union` is built into git; `theirs` is NOT, and an unregistered driver is silently ignored
 * rather than erroring — so without this call `merge=theirs` degrades to an ordinary conflict.
 * Registering it here (local repo config, never global) keeps the lane's merge semantics
 * source-owned: no runner provisioning, and a developer's clone that never calls this keeps
 * stock conflict behaviour on those paths.
 */
function configureLaneMergeDrivers(cwd: string): PrepareHeartbeatResult | undefined {
  // `%B` is the other side's blob, `%A` the working copy the driver must leave the result in.
  const driver = git(cwd, ["config", "merge.theirs.driver", "cp -f -- %B %A"]);
  return driver.status === 0 ? undefined : failed("register lane merge drivers", driver);
}

/**
 * Rebuild a mutable heartbeat lane over current main without discarding its unflushed tree delta.
 *
 * The previous lane is merged with `--squash`: commits that already landed through an earlier
 * squash contribute no staged change, while still-unflushed files remain staged for this tick's
 * ordinary commit. A content conflict is typed backpressure; the remote lane is never modified.
 *
 * PARTIAL FLUSH is why the merge needs declared per-path semantics (2026-08-17). "Already-flushed
 * state contributes no staged change" holds only when the flush carried the lane's delta in FULL.
 * A flush snapshots the lane, but the lane keeps ticking while the flush PR is in flight, so main
 * routinely lands a strict PREFIX of the lane's delta. The next tick then has a merge base
 * predating the flush, and for an append-only file both sides insert at the same end-of-file
 * anchor with different content -- main added `A`, the lane added `A,B,C`. Git conflicts, and the
 * conflict is vacuous: measured on the live lanes, main's side of the hunk is EMPTY (`ours=0`).
 * Because the flush is a squash, no shared ancestry exists for git to notice `A` already landed.
 *
 * The three paths that wedge are all SINGLE-WRITER -- `db/mutation-findings/<agent>.jsonl` and
 * `docs/observe-events/.rs-buffer-<agent>.json` are agent-scoped, and `data/vault-state.json` is
 * generated by otto's lane alone (agent-heartbeat.yml: "only otto generates vault-state"). Main's
 * copy is therefore never a rival author's work, only an older snapshot of this lane's own output,
 * which is what makes an automatic resolution honest rather than a clobber. The per-event
 * `docs/observe-events/<zetaid>.json` files never conflict -- their unique filenames still hold
 * the original conflict-freedom invariant, and the fix restores that guarantee for the three files
 * that lost it. Any OTHER conflicting path still fails the tick as typed backpressure.
 */
export function prepareHeartbeatBranch(agent: string, cwd: string = process.cwd()): PrepareHeartbeatResult {
  if (!AGENT_RE.test(agent) || agent.endsWith(".lock")) {
    return { ok: false, error: `agent must be one safe branch component; got ${agent}` };
  }

  const head = `heartbeat/${agent}`;
  const remoteRef = `refs/remotes/origin/${head}`;
  const fetchMain = git(cwd, ["fetch", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
  if (fetchMain.status !== 0) return failed("fetch main", fetchMain);

  const probe = git(cwd, ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${head}`]);
  if (probe.status !== 0 && probe.status !== 2) return failed("probe heartbeat lane", probe);
  const remoteFound = probe.status === 0;
  if (remoteFound) {
    const fetchLane = git(cwd, ["fetch", "origin", `+refs/heads/${head}:${remoteRef}`]);
    if (fetchLane.status !== 0) return failed("fetch heartbeat lane", fetchLane);
  }

  const checkout = git(cwd, ["checkout", "-B", head, "origin/main"]);
  if (checkout.status !== 0) return failed("reset heartbeat lane over main", checkout);

  const drivers = configureLaneMergeDrivers(cwd);
  if (drivers !== undefined) return drivers;

  let healed: readonly string[] = [];
  if (remoteFound) {
    const merge = git(cwd, ["merge", "--squash", "--no-commit", remoteRef]);
    if (merge.status !== 0) {
      // FALLBACK-ONLY, and that ordering is the safety property. Every carry that succeeds today
      // still takes the branch above and never reaches this line, so the healthy path is
      // byte-identical to before. This runs only where the tick is already dead.
      const rescue = healLosslessExtensionConflicts(cwd);
      if (!rescue.ok) return failed("carry unflushed heartbeat state", merge);
      healed = rescue.healed;
    }
  }

  const staged = git(cwd, ["diff", "--cached", "--quiet", "--exit-code"]);
  if (staged.status !== 0 && staged.status !== 1) return failed("inspect carried heartbeat state", staged);
  return { ok: true, value: { head, remoteFound, carried: staged.status === 1, healed } };
}

/**
 * Render the preparer's failure as a GitHub Actions `::error::` annotation.
 *
 * WHY THIS EXISTS. On 2026-08-26 the alexa lane failed every tick from 23:42Z, and the run's only
 * annotation was `Process completed with exit code 1` — which names the exit status and nothing
 * about the cause. The cause (`CONFLICT (add/add): Merge conflict in data/tick-reasoning.jsonl`)
 * was in the step log the whole time, 1250 lines down, reachable only by downloading the job log.
 * That is the third failure that night whose annotation said nothing useful, and the diagnosis
 * each time is one line of text that the process already had in hand.
 *
 * The class this belongs to matters more than the instance: the conflicting-path failures are
 * DESIGNED to recur — the preparer's typed backpressure refuses any undeclared conflicting path,
 * so each genuinely-new append-only file surfaces exactly this way (eight times since 2026-08-16,
 * per the `.gitattributes` heartbeat block). The remedy is always "declare the path", and the
 * only thing standing between the alarm and the remedy is knowing WHICH path. Putting it in the
 * annotation puts it on the run summary, where a watchdog or a person sees it without fetching
 * logs — the same move #15692 made for `build-and-test`.
 *
 * Newlines are percent-encoded because a workflow command is terminated by a literal newline:
 * an unencoded multi-line message is silently truncated at the first one, which for a git merge
 * failure discards every line after `Auto-merging <first path>` — i.e. exactly the CONFLICT line
 * that carries the diagnosis. `%0A` is the documented escape and renders as a line break.
 */
export function annotateFailure(error: string): string {
  return `::error title=heartbeat lane preparation failed::${error.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}`;
}

function parseAgent(argv: readonly string[]): { readonly ok: true; readonly agent: string } | { readonly ok: false } {
  return argv.length === 2 && argv[0] === "--agent" && argv[1] !== undefined
    ? { ok: true, agent: argv[1] }
    : { ok: false };
}

if (import.meta.main) {
  const parsed = parseAgent(process.argv.slice(2));
  if (!parsed.ok) {
    console.error("usage: prepare-heartbeat-branch.ts --agent <lane>");
    process.exit(2);
  }
  const result = prepareHeartbeatBranch(parsed.agent);
  if (!result.ok) {
    console.error(`prepare-heartbeat-branch: ${result.error}`);
    console.error(annotateFailure(result.error));
    process.exit(1);
  }
  console.log(
    `[heartbeat] ${result.value.head}: ${result.value.remoteFound ? "remote found" : "new lane"}; ` +
      `${result.value.carried ? "unflushed state staged" : "no unflushed state"}`,
  );
  if (result.value.healed.length > 0) {
    // A notice, not a warning: the lane diverged and repaired itself, which is the designed
    // outcome. It is announced because a silent self-heal is indistinguishable from never having
    // diverged, and the difference is exactly what tells us whether this rule is load-bearing.
    console.log(
      `::notice title=heartbeat lane healed a squash-flush divergence::` +
        `carried ${String(result.value.healed.length)} path(s) whose copy on main embeds in the ` +
        `lane's by insertions only: ${result.value.healed.join(", ")}`,
    );
  }
}
