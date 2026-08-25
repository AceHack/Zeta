/**
 * src/Core.TypeScript/observe/event-sink-folder.ts — the real EventSink: folder-direct-to-main.
 *
 * The sovereign transport for `execute` (per the observe-act + DB-design + keystone
 * ADRs). Where `execute.ts` defines the `EventSink` port (append a chosen action to
 * the durable log), THIS is the production adapter: it writes the event as a
 * ZetaId-named JSON file into a git folder and commits it **direct to `main`,
 * no-PR** (081KSNY2Z0008QG0R000E5KTPX folders-on-main; same mechanism as the agent-bus G-Set,
 * 081KSXN940008QG0R00171YAZW). Corporate batch-to-main (081KSNY2Z0008QG0R0017JSTGD) is the same event shape behind a
 * different commit fn — swap `commit`, not the envelope.
 *
 * ── Fact, not command (per the design review) ────────────────────────────────
 * Replay must fold FACTS, not redo COMMANDS. So the durable record is an
 * `EventEnvelope` — `{ id, at, by, action }` — a fact ("at t, actor X recorded
 * this action"), carrying a **stable ZetaId identity** (design-review caution #2) so the
 * log is idempotent (the filename IS the id; re-appending the same id is a
 * no-op — the G-Set CRDT property). The richer executed-event envelope
 * (ActionExecutionStarted/Succeeded/Failed/ModeChanged) is the next refinement;
 * this slice logs the chosen action as the fact, with identity + actor + time.
 *
 * ── Conflict discipline (design-review cautions #5/#6) ───────────────────────
 * Direct-to-main is safe here for the same reason the bus is: events are
 * **disjoint ZetaId files** — two agents appending never touch the same path, so
 * a concurrent peer advancing `main` only causes a non-fast-forward push, which
 * `git pull --rebase` + retry resolves cleanly (G-Set merge = set union). The
 * on-main guard + ahead-check (mirrored from the bus) prevent shoving unrelated
 * local commits to main.
 *
 * ── Never throws (Result discipline) ─────────────────────────────────────────
 * Every failure (not-on-main, local-ahead, write error, push failure) becomes an
 * `AppendOutcome { ok: false; reason }` — the sink AUTHORS its outcome channel
 * (asymmetric-authorship); the caller (`execute`) surfaces it as feedback.
 *
 * I/O is injectable (`mint` / `now` / `commit`) so the whole adapter is testable
 * with no real git and a temp dir.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/execute.ts (the EventSink port this implements)
 *   - src/Core.TypeScript/observe/observe.ts (NextAction — the action recorded)
 *   - tools/agent-bus/publish.ts (the proven atomic-write + git-direct-to-main pattern this mirrors)
 *   - src/Core.TypeScript/zeta-id (the ZetaId codec — Category.WorkItem ids)
 *   - docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md
 *   - docs/backlog/P1/081KSNY2Z0008QG0R000E5KTPX-fast-lane-as-folders-on-main-not-branches-supersedes-coordinator-complexity-per-operator-2026-05-28-zeta-native-branch-protection.md
 *   - docs/backlog/P2/081KSXN940008QG0R000R76H45-git-native-eventually-consistent-text-indexes-sorted-inverted-graph-plus-git-native-hindsight-storage-interface-aaron-2026-05-31.md (the read side: indexes over this log)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pack, DEFAULT_ENV, type SimulationEnvironment } from "../zeta-id/zeta-id";
import { isCanonicalZetaIdHex } from "../zeta-id/canonical-hex";
import {
  Category,
  IdVersion,
  Chromosome,
  Persona,
  LocationHint,
  type ZetaObservation,
  type Milliseconds,
} from "../zeta-id/types";
import type { AppendOutcome, EventSink } from "./execute";
import type { NextAction } from "./observe";
import type { EntropyTracker } from "../algebra/entropy-tracker";
import { APPEND_ONLY_ERASURE_BITS, decisionErasureBits } from "../algebra/erasure-derivation";
import type { PhaseClock, PhaseStamp } from "./phase-clock";
import { stampPhase } from "./phase-clock";

/**
 * Mint a WorkItem-category ZetaId as 32-hex — the observe-event identity.
 * `DEFAULT_ENV` (crypto randomness) makes each call unique; pass a deterministic
 * env in tests for reproducible ids. Mirrors the bus minter but tags the id
 * `Category.WorkItem` (planning/workflow), not `Category.Bus`.
 */
export function mintObserveEventIdHex(env: SimulationEnvironment = DEFAULT_ENV, atMs: number = Date.now()): string {
  const obs: ZetaObservation = {
    version: IdVersion.V1,
    timestamp: atMs as Milliseconds,
    chromosome: Chromosome.MetaCoherence,
    category: Category.WorkItem,
    authority: { type: "TrustedAgent" },
    persona: Persona.FireflyCoherence,
    momentum: { type: "Normal" },
    location: LocationHint.EastUS_VA1,
  };
  return pack(obs, env).toString(16).padStart(32, "0");
}

/**
 * A canonical observe-event id is 32 lowercase hex chars that DECODE as a ZetaId
 * (`mintObserveEventIdHex` output).
 *
 * This was a bare `/^[0-9a-f]{32}$/`. That tests the encoding and never the value, so it
 * accepted any 32 hex characters — including the hex-encoded JSON that a hashless "mint"
 * in `emit-attestation.ts` produced (`7b22` = `{"`). The shape check remains necessary
 * and is now not the whole check; `isCanonicalZetaIdHex` decodes via the codec.
 */
export function isCanonicalEventId(id: string): boolean {
  return isCanonicalZetaIdHex(id);
}

/** Entropy snapshot carried per event (the thermodynamic cost-of-commit accounting). */
export interface EntropySnapshot {
  readonly entropy_state: number; // Ledger A: bits of uncertainty remaining in state
  readonly entropy_heat: number;  // Ledger B: cumulative bits discharged (Landauer cost)
}

/** The durable FACT: a recorded action with stable identity + actor + time. */
export interface EventEnvelope {
  readonly id: string; // ZetaId hex — stable identity; the filename; G-Set dedup key
  readonly at: string; // canonical ISO-8601 ms timestamp (human readability — NOT the semantic time)
  readonly by: string; // acting agent id (the actor trail)
  readonly action: NextAction; // the chosen action this event records
  readonly entropy?: EntropySnapshot; // the thermodynamic accounting at this commit (absent = tracker not wired)
  readonly phase?: PhaseStamp; // the semantic time coordinate (phase clock tick — the REAL time for multi-planet)
}

/** Outcome of committing the event file (sync; mirrors the bus's git pattern). */
export type CommitOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export interface FolderSinkOptions {
  /** The git folder events land in (folders-not-branches, on a main checkout). */
  readonly eventDir: string;
  /** Acting agent id, stamped into every envelope. */
  readonly by: string;
  /** Id minter (default: WorkItem ZetaId). Inject a deterministic one in tests. */
  readonly mint?: () => string;
  /** Clock (default: Date.now). Inject in tests. */
  readonly now?: () => number;
  /** Commit the written file (default: gitCommitToMain). Inject a fake in tests. */
  readonly commit?: (filePath: string, envelope: EventEnvelope) => CommitOutcome;
  /** Entropy tracker (injected effect). When present, each append stamps {entropy_state, entropy_heat}. */
  readonly entropy?: EntropyTracker;
  /**
   * How many candidate actions the DECISION collapsed from, for the action being appended.
   *
   * The append itself erases nothing (see the call site), so without this the sink charges zero.
   * The erasure in this pipeline is the choice — `observe.ts` `buildMenu()` produces N candidates
   * and exactly one is recorded, which destroys `log2(N)` bits. The sink never sees the menu, so it
   * cannot derive N; a caller that knows it supplies it here and the charge becomes real. Returning
   * `undefined` (or nothing at all) means "not declared", and the append is metered as the
   * append-only write it is, rather than as a literal.
   */
  readonly decisionCandidates?: (action: NextAction) => number | undefined;
  /** Phase clock (injected — the 4th traveler). When present, each append ticks and stamps {phase, derived}. */
  readonly phaseClock?: PhaseClock;
}

/**
 * Write the envelope as an atomic, ZetaId-named file. `flag: "wx"` fails if the
 * file exists — but for a G-Set the same id means the same event already landed,
 * so EEXIST is idempotent SUCCESS, not an error.
 */
// `created` distinguishes a file WE wrote this append (safe to clean up on failure) from a
// pre-existing durable event found via EEXIST-replay (must NEVER be deleted — that would drop a
// landed G-Set event, Copilot #6312 P0).
function writeEventFile(
  envelope: EventEnvelope,
  eventDir: string,
): { ok: true; path: string; created: boolean } | { ok: false; reason: string } {
  const path = join(eventDir, `${envelope.id}.json`);
  try {
    mkdirSync(eventDir, { recursive: true });
    writeFileSync(path, `${JSON.stringify(envelope, null, 2)}\n`, { flag: "wx" });
    return { ok: true, path, created: true }; // WE created it → ours to clean up on failure
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EEXIST") {
      // Same id already on disk. Idempotent SUCCESS only if the content matches
      // (the true G-Set property). A reused id with a different action/by/at is a
      // real collision — surface it, never silently accept stale (Codex #6312 P2).
      try {
        const existing = readFileSync(path, "utf-8");
        if (existing === `${JSON.stringify(envelope, null, 2)}\n`) return { ok: true, path, created: false }; // pre-existing → do NOT delete
        return { ok: false, reason: `id collision: ${envelope.id} already exists with different content` };
      } catch (readErr) {
        return { ok: false, reason: `EEXIST but re-read failed: ${(readErr as Error).message}` };
      }
    }
    return { ok: false, reason: `write failed: ${e.message}` };
  }
}

/**
 * Harness-specific `Co-Authored-By` trailer derived from the acting agent id.
 * The sink is SHARED — Vera/Riven/Alexa/Lior all use it — and the repo requires
 * per-surface trailers (agent-roster-reference-card), so a hardcoded Claude
 * trailer mis-attributes every non-Otto surface's events (Codex #6312 P2).
 * Mirrors the agent-bus `coauthorFor` map; falls back to naming the sender.
 */
export function coauthorFor(by: string): string {
  const id = by.toLowerCase();
  // Match the EXACT surface id or a hyphen-delimited variant (otto, otto-cli, otto-desktop) —
  // NOT a bare prefix, so "ottobot" / "liorx" fall back to the sender trailer instead of being
  // mis-stamped (Codex #6312: mirror the agent-bus exact-or-hyphen matching, not startsWith).
  const TRAILERS: readonly (readonly [string, string])[] = [
    ["otto", "Co-Authored-By: Claude <noreply@anthropic.com>"],
    ["alexa", "Co-Authored-By: Kiro <noreply@kiro.dev>"],
    ["riven", "Co-Authored-By: Grok <noreply@x.ai>"],
    ["vera", "Co-Authored-By: Codex <noreply@openai.com>"],
    ["lior", "Co-Authored-By: Gemini <noreply@google.com>"],
  ];
  for (const [surface, trailer] of TRAILERS) {
    if (id === surface || id.startsWith(`${surface}-`)) return trailer;
  }
  return `Co-Authored-By: ${by}[bot] <${by}[bot]@users.noreply.github.com>`;
}

/**
 * Default commit: folder-direct-to-`main`, no-PR. Mirrors the agent-bus
 * `gitPushEnvelope` (081KSXN940008QG0R00171YAZW): on-main guard, fetch + 0-ahead check (never shove
 * unrelated local commits to main), add ONLY this file, `--no-verify` (events are
 * DATA not code), push `HEAD:main` with rebase-retry (disjoint ZetaId files →
 * G-Set union, never a real conflict). Returns a CommitOutcome; never throws.
 */
type GitRun = (args: readonly string[]) => string;

/**
 * Push HEAD:main with rebase-retry. A concurrent peer advancing main rejects the push
 * non-fast-forward, but disjoint ZetaId files (G-Set CRDT) never conflict → `pull --rebase
 * --autostash` (tolerates a dirty checkout) + retry. On exhausted/failed rebase, `undoLocalCommit`
 * leaves no local residue. Extracted from gitCommitToMain to keep each function's complexity bounded.
 */
function pushWithRebaseRetry(run: GitRun, undoLocalCommit: () => void): CommitOutcome {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      run(["push", "origin", "HEAD:main"]);
      return { ok: true };
    } catch {
      try {
        run(["pull", "--rebase", "--autostash", "origin", "main"]);
      } catch {
        try {
          run(["rebase", "--abort"]);
        } catch {
          /* no rebase in progress to abort — fine */
        }
        undoLocalCommit();
        return { ok: false, reason: "push rejected and rebase failed (peer contention); local commit undone" };
      }
    }
  }
  undoLocalCommit();
  return { ok: false, reason: "push failed after 3 rebase-retry attempts; local commit undone" };
}

export function gitCommitToMain(filePath: string, envelope: EventEnvelope): CommitOutcome {
  const run: GitRun = (args) =>
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    execFileSync("git", [...args], { encoding: "utf-8" }).trim();
  const gitPath = filePath.replaceAll("\\", "/");
  try {
    const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch !== "main") {
      // Allow if HEAD is at origin/main's commit (worktree at main commit, different branch name)
      const headSha = run(["rev-parse", "HEAD"]);
      run(["fetch", "origin", "main"]);
      const mainSha = run(["rev-parse", "origin/main"]);
      if (headSha !== mainSha) {
        return { ok: false, reason: `observe event sink must run on a main checkout (on '${branch}')` };
      }
    } else {
      run(["fetch", "origin", "main"]);
    }
    const ahead = run(["rev-list", "--count", "origin/main..HEAD"]);
    if (ahead !== "0") {
      return {
        ok: false,
        reason: `local main is ${ahead} commit(s) ahead of origin/main; reconcile before appending events`,
      };
    }
    run(["add", gitPath]);
    // Idempotent re-append: if the file is already committed + unchanged, `git add` stages
    // nothing, so `git commit` would fail ("nothing to commit"). That's a no-op, not an error —
    // return ok (the event already landed durably). `git diff --cached --quiet` exits 0 when
    // nothing is staged (Copilot #6312 — re-append of an already-landed event must be idempotent ok).
    let staged = false;
    try {
      run(["diff", "--cached", "--quiet", "--", gitPath]);
    } catch {
      staged = true; // non-zero exit = staged changes present
    }
    if (!staged) return { ok: true };
    const msg = [
      `observe(${envelope.by}): ${envelope.action.kind} ${gitPath}`,
      "",
      `Observe event ${envelope.id} appended folder-direct-to-main (sovereign transport, 081KSNY2Z0008QG0R000E5KTPX).`,
      "",
      coauthorFor(envelope.by),
    ].join("\n");
    run(["commit", "--no-verify", "-q", "-m", msg, "--", gitPath]);
    // After this point the commit exists on local main. If the push never lands we MUST undo it
    // WITHOUT clobbering unrelated edits: a `reset --hard` would wipe an agent's concurrent
    // uncommitted work in other files (Codex #6312 P1). Targeted undo instead: `reset --soft`
    // (move HEAD back; stages ONLY our commit's diff = our event file; other files untouched) then
    // `restore --staged -- <our path>` (unstage ONLY our file → untracked; nothing else touched).
    // The orphaned event file itself is removed by `append` on the ok:false return (so it can't be
    // half-read by loadWorld). Net: commit gone, our file gone, every other file exactly as it was.
    const undoLocalCommit = (): void => {
      try {
        run(["reset", "--soft", "HEAD~1"]);
        run(["restore", "--staged", "--", gitPath]);
      } catch {
        /* nothing to undo — fine */
      }
    };
    return pushWithRebaseRetry(run, undoLocalCommit);
  } catch (err) {
    // If `git commit` itself failed AFTER `git add` (e.g. missing git identity, a commit hook),
    // our path is left STAGED; append's rmSync would then remove the worktree file but leave a
    // staged-add of a now-deleted file = dirty index that blocks the next rebase. Unstage our path
    // (best-effort; no-op if nothing was staged) so the index is clean too (Codex #6312 P2).
    try {
      run(["restore", "--staged", "--", gitPath]);
    } catch {
      /* nothing staged for our path — fine */
    }
    return { ok: false, reason: `git commit failed: ${(err as Error).message}` };
  }
}

/** Best-effort remove a file WE created this append (null = we created nothing → nothing to remove). */
function removeOurFile(path: string | null): void {
  if (path === null) return;
  try {
    rmSync(path, { force: true });
  } catch {
    /* already gone (e.g. undo removed it) — fine */
  }
}

/**
 * The real folder-direct-to-main EventSink. `append` mints a ZetaId, builds the
 * fact envelope, atomically writes `<eventDir>/<id>.json`, and commits it to main.
 * Pure-shaped (Result; never throws); I/O injected for tests.
 */
export function folderSink(opts: FolderSinkOptions): EventSink {
  const mint = opts.mint ?? (() => mintObserveEventIdHex());
  const now = opts.now ?? (() => Date.now());
  const commit = opts.commit ?? gitCommitToMain;
  const entropy = opts.entropy;
  const phaseClock = opts.phaseClock;
  return {
    append: (action: NextAction): Promise<AppendOutcome> => {
      // `ourFile` is set ONLY to a file WE created this append — so failure-cleanup removes our own
      // residue but NEVER a pre-existing durable event found via EEXIST-replay (Copilot #6312 P0).
      let ourFile: string | null = null;
      // Wrap the whole body: the injected `mint` / `now` / `commit` could throw (e.g. now()=NaN
      // makes toISOString() throw, or commit() throws). The documented contract is Result-only —
      // ANY throw converts to { ok: false } AND still cleans up our own file (Copilot #6312 P1).
      try {
        const id = mint();
        // `mint` is injectable + FolderSinkOptions is exported, so a caller could return a
        // path-traversal segment ("../outside") or a Windows-reserved name. The id is used as a
        // path segment — reject anything but a canonical 32-hex ZetaId before joining a path
        // (the bus guards its segments the same way). Security-relevant (Copilot #6312 P1).
        if (!isCanonicalEventId(id)) {
          return Promise.resolve({ ok: false, reason: `non-canonical event id (expected 32 lowercase hex): '${id}'` });
        }
        const at = new Date(now()).toISOString();

        // ── Entropy accounting: each append IS a measurement (non-Adj, irreversible) ──
        // Record the measurement on the tracker BEFORE stamping the snapshot,
        // so the envelope carries the POST-commit entropy state (the cost has been paid).
        let entropySnapshot: EntropySnapshot | undefined;
        if (entropy) {
          // ── The charge is DERIVED here, and it is zero unless a caller declares otherwise ──
          //
          // This used to be `entropy.measure(1)`, justified as "the decision collapsed from N
          // possibilities to 1". Two things were wrong with it. The number 1 was a literal — the
          // collapse costs log2(N), which is 1 only when N = 2. And the collapse does not happen
          // here: `append` receives an action already chosen, so N is not in scope. What `append`
          // does is add a fact to an append-only log; the post-state contains the event, so the
          // pre-state is the post-state minus it, and a re-append of the same id is the identity
          // (the G-Set property this file already relies on). Both are injective, so
          // APPEND_ONLY_ERASURE_BITS = 0 — Bennett 1973 gives a bijection no floor.
          //
          // Charging 1 bit per append is also what drove `entropy_state` negative and stamped
          // those negatives into durable envelopes (entropy-tracker.ts header, the
          // `unadmittedErasureBits` deficit). Deriving the figure closes that on this path.
          //
          // A caller that DOES know the menu size supplies `decisionCandidates`, and the real
          // erasure — log2(N) — is charged through the same declared door (§13).
          const candidates = opts.decisionCandidates?.(action);
          const bits = candidates === undefined ? APPEND_ONLY_ERASURE_BITS : decisionErasureBits(candidates);
          if (bits > 0) entropy.measure(bits);
          else entropy.permutation(); // bijective: recorded, not erased
          entropySnapshot = {
            entropy_state: entropy.state.entropy_state,
            entropy_heat: entropy.state.entropy_heat,
          };
        }

        const envelope: EventEnvelope = {
          id, at, by: opts.by, action,
          ...(entropySnapshot ? { entropy: entropySnapshot } : {}),
          ...(phaseClock ? { phase: (() => { phaseClock.tick("heartbeat"); return stampPhase(phaseClock); })() } : {}),
        };
        const written = writeEventFile(envelope, opts.eventDir);
        if (!written.ok) return Promise.resolve({ ok: false, reason: written.reason });
        if (written.created) ourFile = written.path; // only OUR new file is ours to clean up
        const committed = commit(written.path, envelope);
        if (!committed.ok) {
          removeOurFile(ourFile); // pre-existing durable events are NOT touched (created === false)
          return Promise.resolve({ ok: false, reason: committed.reason });
        }
        return Promise.resolve({ ok: true, eventId: id });
      } catch (err) {
        // A throw (e.g. from an injected commit) must route through the SAME cleanup, so a failed
        // append never leaves a half-written file we created (Copilot #6312 P1).
        removeOurFile(ourFile);
        return Promise.resolve({ ok: false, reason: `append failed: ${(err as Error).message}` });
      }
    },
  };
}
