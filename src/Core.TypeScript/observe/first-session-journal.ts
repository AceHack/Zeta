/**
 * first-session-journal.ts — the durable record of what a stranger actually chose.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 * Before it, `first-session` had exactly ONE durable side effect: `writeMarker`,
 * a file containing an ISO timestamp. It records *that* first-login finished and
 * nothing about *what happened in it*. Five of the six action kinds
 * (`skip_credential`, `skip_optional_credentials`, `offer_cloud_helpers`,
 * `use_local_llm_only`, `complete_first_session`) were pure state transitions
 * over an in-memory record that was discarded when the process exited — a shape
 * that does not do anything. A person who deliberately skipped GitHub and a
 * person who never reached the question left byte-identical evidence behind.
 *
 * This module is the append-only fact log that closes that gap. Each applied
 * action becomes one line of JSON on disk, and `replayFirstSession` folds the
 * lines back into the `NodeSessionState` the live run reached.
 *
 * ── Fact, not command (same discipline as event-sink-folder.ts) ──────────────
 * An entry is a FACT — "at local time t, sequence n, this action was applied" —
 * never a command to re-run. Replay folds facts through `simulateFirstSession`;
 * it never re-invokes `gh auth login`. An entry is written only AFTER its effect
 * succeeded, so the log cannot claim a credential is ready when the vendor CLI
 * refused. The action recorded is the action actually *applied*, which is not
 * always the action chosen: a `setup_credential` whose provider reports `skipped`
 * is journalled as the `skip_credential` it was downgraded to.
 *
 * ── Ordering: sequence, never wall clock ─────────────────────────────────────
 * `at` is local proper time. It is carried for humans reading the file and for
 * local decisions ONLY — replay orders strictly by `seq` / file order and never
 * by `at`. Sorting a fold by a local clock is the failure that
 * `.claude/rules/local-time-never-enters-the-shared-fold.md` exists to prevent,
 * and it would bite here the moment a node's clock stepped mid-session.
 *
 * ── Result-over-exception ────────────────────────────────────────────────────
 * Appending never throws. A full disk or a read-only home yields
 * `{ ok: false, reason }` and the conductor logs a serial marker. A first login
 * that cannot journal must still be able to finish; losing the record is a
 * degradation to report, not a reason to strand someone on a fresh machine.
 *
 * ── What this is NOT (deliberately, and not mine to decide) ──────────────────
 * Local, unsigned, unreplicated. It is not an attestation, not a claim any peer
 * should trust, and it never leaves the machine. Turning "this person chose
 * local-only" into a signed, cluster-visible claim is an identity/attestation
 * surface with real security consequences and belongs to the distributed-IdP
 * work (ADR 2026-07-08), not to a journal file.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  defaultNodeSession,
  foldFirstSession,
  type FirstSessionAction,
  type NodeSessionState,
} from "./first-session";

/** Sibling of the completion marker; one JSON object per line. */
export const JOURNAL_FILENAME = "first-session-journal.jsonl";

/** One applied action, as a durable fact. */
export interface FirstSessionJournalEntry {
  /** 1-based position in the log. The ONLY ordering key replay may use. */
  readonly seq: number;
  /** Local proper time. Human-facing and local-only — never an ordering key. */
  readonly at: string;
  /** The action that was actually applied (not necessarily the one chosen). */
  readonly action: FirstSessionAction;
}

export type JournalAppendResult =
  | { readonly ok: true; readonly seq: number; readonly path: string }
  | { readonly ok: false; readonly reason: string };

export interface JournalReadResult {
  readonly entries: readonly FirstSessionJournalEntry[];
  /** Lines that did not parse as an entry. Reported, never silently dropped. */
  readonly malformedLines: number;
}

/** The journal that belongs to a given completion marker. */
export function journalPathFor(markerPath: string): string {
  return join(dirname(markerPath), JOURNAL_FILENAME);
}

/**
 * The ONE ordering key. Explicit comparison, never `localeCompare` and never the
 * `at` field — see the header note on local time.
 */
function bySeq(a: FirstSessionJournalEntry, b: FirstSessionJournalEntry): number {
  if (a.seq < b.seq) return -1;
  if (a.seq > b.seq) return 1;
  return 0;
}

const ACTION_KINDS: ReadonlySet<string> = new Set([
  "setup_credential",
  "skip_credential",
  "skip_optional_credentials",
  "offer_cloud_helpers",
  "use_local_llm_only",
  "complete_first_session",
]);

function isEntry(value: unknown): value is FirstSessionJournalEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.seq !== "number" || !Number.isInteger(candidate.seq)) return false;
  if (typeof candidate.at !== "string") return false;
  const action = candidate.action;
  if (typeof action !== "object" || action === null) return false;
  const kind = (action as Record<string, unknown>).kind;
  return typeof kind === "string" && ACTION_KINDS.has(kind);
}

/**
 * Read the log back. Missing file is an empty log, not an error — a node whose
 * first login predates this journal is a legitimate state, not a corrupt one.
 */
export function readFirstSessionJournal(journalPath: string): JournalReadResult {
  if (!existsSync(journalPath)) return { entries: [], malformedLines: 0 };

  let raw: string;
  try {
    raw = readFileSync(journalPath, "utf8");
  } catch {
    return { entries: [], malformedLines: 0 };
  }

  const entries: FirstSessionJournalEntry[] = [];
  let malformedLines = 0;
  for (const line of raw.split("\n")) {
    if (line.trim() === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      malformedLines++;
      continue;
    }
    if (isEntry(parsed)) entries.push(parsed);
    else malformedLines++;
  }
  return { entries, malformedLines };
}

/**
 * Append one applied action. Idempotency note: this is an append, NOT an upsert
 * — the natural key is `seq`, and a caller that applies the same action twice
 * genuinely did it twice. Replay is idempotent where the action is
 * (`simulateFirstSession` on a `skip_credential` is), which is what makes a
 * partially-written log safe to fold.
 */
export function appendFirstSessionEvent(
  journalPath: string,
  action: FirstSessionAction,
  now: () => Date = () => new Date(),
): JournalAppendResult {
  const seq = readFirstSessionJournal(journalPath).entries.length + 1;
  const entry: FirstSessionJournalEntry = { seq, at: now().toISOString(), action };
  try {
    mkdirSync(dirname(journalPath), { recursive: true });
    // Single sub-4KB line, O_APPEND: the write does not interleave with a
    // concurrent one on a local filesystem. Two first-logins racing on one
    // machine is not a case this substrate has (the marker serialises them).
    appendFileSync(journalPath, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
  return { ok: true, seq, path: journalPath };
}

/**
 * Fold the journal into the state the live run reached.
 *
 * Returns `undefined` when there is no journal to read — an HONEST unknown, not
 * a fabricated default. The caller decides what an absent record means; this
 * function refuses to invent one. (That distinction is the whole point: the
 * value it replaces was a `defaultNodeSession()` that reported every credential
 * missing regardless of what the machine actually had.)
 */
export function replayFirstSession(journalPath: string): NodeSessionState | undefined {
  const { entries } = readFirstSessionJournal(journalPath);
  if (entries.length === 0) return undefined;
  // Ordered by seq — explicitly NOT by `at`. See the header note on local time.
  const ordered = [...entries].sort(bySeq);
  return foldFirstSession(defaultNodeSession(), ordered.map((e) => e.action));
}

/**
 * Combine what is OBSERVABLE NOW with what was CHOSEN THEN.
 *
 * The journal cannot reconstruct a session on its own, and finding out why is
 * worth recording. A live run starts from `sessionFromProbe` — `gh` reads
 * "ready" because `gh auth status` said so, not because anyone *chose* it.
 * Replaying actions from `defaultNodeSession()` therefore loses every credential
 * the machine already had, and a replay that then reported them missing would be
 * the same fabrication the journal was built to remove.
 *
 * So the two halves are split by change rate (DV2.0), each taken from the source
 * that actually knows it:
 *
 * - **Credential readiness is observable.** Re-probe it. A remembered "ready" is
 *   strictly worse than a fresh one — tokens expire, and the person may have run
 *   `gh auth logout` yesterday. The probe wins whenever it says `ready`.
 * - **A deliberate skip is NOT observable.** `probe = missing` looks identical
 *   for "chose to skip GitHub" and "never got asked". Only the record separates
 *   them, so a journalled `skipped` is kept wherever the probe says `missing`.
 * - **`cloudHelpersOffered` is pure choice.** Nothing on disk implies it.
 *
 * Precedence, stated once: probe `ready` > recorded `skipped` > `missing`.
 */
export function reconcileSessionRecord(
  probed: NodeSessionState,
  recorded: NodeSessionState,
): NodeSessionState {
  const vendors = ["gh", "claude", "codex", "gemini"] as const;
  const credentials = { ...probed.credentials };
  for (const vendor of vendors) {
    if (probed.credentials[vendor] !== "ready" && recorded.credentials[vendor] === "skipped") {
      credentials[vendor] = "skipped";
    }
  }
  return {
    credentials,
    complete: recorded.complete,
    cloudHelpersOffered: recorded.cloudHelpersOffered,
  };
}
