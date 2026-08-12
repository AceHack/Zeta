/**
 * The false-alarm rate for the mutation runner — SLAM's metric, and an honest account of how much
 * of it we can actually compute.
 *
 * WHY THIS EXISTS. Microsoft's Static Driver Verifier became a REQUIRED Windows 7 gate not when it
 * became correct — the underlying problem is undecidable and it never stopped being so — but when
 * its false-alarm rate fell from 25.7% (SLAM1) to under 4% (SLAM2). That number is what bought it
 * the right to block. Our runner is deliberately a report and not a gate, and it stays that way
 * until unexplained survivors are rare; this module is how we would ever know.
 *
 * WHAT A FALSE ALARM IS HERE. The runner reports INDISTINGUISHABLE UNDER SUITE — a fact it is
 * entitled to. The alarm is false when the honest resolution turns out NOT to be a missing test:
 *
 *   write-test      -> TRUE alarm. A real gap; the suite could not hold a behaviour that matters.
 *   declare-free    -> false alarm. The dimension is genuinely unconstrained.
 *   note-redundant  -> false alarm. The code was masked/redundant, so no test could ever hold it.
 *   defer           -> UNRESOLVED. Excluded from the ratio, never silently counted as either.
 *   escape / undefined-cell -> a VOCABULARY miss, counted separately (the grammar was too narrow).
 *   read-declarer   -> not a resolution at all.
 *   supersede-mine  -> a REVISION: an earlier classification proved wrong. This is the §6 falsifier
 *                      ("a registry converges") measured directly — if entries keep needing
 *                      revision, the ledger is a mute button rather than accumulated knowledge.
 *
 * ══ THE DENOMINATOR PROBLEM, STATED UP FRONT BECAUSE IT INVALIDATES THE NAIVE READING ══
 *
 * SLAM's rate is false-alarms / ALL REPORTS. We cannot compute that, and the reason is structural
 * rather than an oversight:
 *
 *   - The runner records a transcript entry only when someone passes `--choose`. A finding that is
 *     looked at and fixed by opening a PR — which is how every resolution so far actually landed —
 *     leaves NO transcript entry.
 *   - `agent-heartbeat.yml` never stages `db/`, so a write from a CI tick lands in a checkout that
 *     is thrown away. The per-tick findings are not recoverable from the ledger either.
 *
 * So what this module computes is false / RESOLVED, and resolution is voluntary. That is a
 * different and BIASED quantity: whoever bothers to record a cell is not a random sample of
 * findings. Reporting it as "our false-alarm rate" would be the same category of overclaim the
 * runner itself was fixed to stop making, so `coverage` says `resolutions-only` and
 * `slamComparable` is false. Making it SLAM-comparable needs findings recorded per tick, which
 * needs the heartbeat to stage `db/` — a real decision about main-branch churn, not a code change
 * to make quietly.
 *
 * And below `MIN_SAMPLE` the rate is not reported at all. A ratio over five findings is noise, and
 * a noisy number with a percent sign attached is worse than no number: it gets quoted.
 */

import { escapeProfile, type TranscriptEntry } from "./mutation-readout";
import { loadAllLedgers, readTranscript, TRANSCRIPT_DIR, type DeclarerLedger } from "./mutation-freedoms";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Below this many resolutions the rate is withheld. SLAM's 25.7% -> <4% was measured over the
 * Windows driver corpus; a percentage over a handful of findings describes the handful, not the
 * runner. Withholding is the same discipline as the runner's own `unresolved`.
 */
export const MIN_SAMPLE = 20;

export type ResolutionKind =
  | "real-gap"
  | "declared-free"
  | "redundant"
  | "revision"
  | "deferred"
  | "frontier"
  | "non-resolving";

/** Map a recorded cell choice onto what it says about the ALARM, not about the code. */
export function resolutionOf(actionKind: string): ResolutionKind {
  switch (actionKind) {
    case "write-test":
      return "real-gap";
    case "declare-free":
      return "declared-free";
    case "note-redundant":
      return "redundant";
    case "supersede-mine":
      return "revision";
    case "defer":
      return "deferred";
    case "escape":
    case "undefined-cell":
      return "frontier";
    default:
      return "non-resolving";
  }
}

export interface FalseAlarmReadout {
  /** One count per resolution kind, so the shape is inspectable and not just the ratio. */
  readonly counts: Readonly<Record<ResolutionKind, number>>;
  /** real-gap + declared-free + redundant. Deferred and non-resolving are NOT in here. */
  readonly resolved: number;
  /** declared-free + redundant. */
  readonly falseAlarms: number;
  /** `null` when `resolved < MIN_SAMPLE` — withheld, not zero, not guessed. */
  readonly falseAlarmRate: number | null;
  /** Why the rate is withheld, when it is. */
  readonly withheld: string | null;
  /** Declared freedoms that later needed superseding, over all declared. The §6 falsifier. */
  readonly revisionRate: number | null;
  readonly declaredTotal: number;
  readonly declaredSuperseded: number;
  /** Where escapes landed. Two numbers deliberately, never summed. */
  readonly frontier: { readonly intoDefined: number; readonly intoUndefined: number };
  /** Always `resolutions-only` today. See the denominator problem above. */
  readonly coverage: "resolutions-only";
  /** Always false today, and the field exists so nobody has to remember the caveat. */
  readonly slamComparable: false;
}

const EMPTY_COUNTS: Record<ResolutionKind, number> = {
  "real-gap": 0,
  "declared-free": 0,
  redundant: 0,
  revision: 0,
  deferred: 0,
  frontier: 0,
  "non-resolving": 0,
};

/** Pure core: everything above the filesystem, so the arithmetic is testable without fixtures. */
export function falseAlarmReadout(
  entries: readonly TranscriptEntry[],
  ledgers: readonly DeclarerLedger[],
): FalseAlarmReadout {
  const counts: Record<ResolutionKind, number> = { ...EMPTY_COUNTS };
  for (const e of entries) counts[resolutionOf(e.action.kind)] += 1;

  const resolved = counts["real-gap"] + counts["declared-free"] + counts.redundant;
  const falseAlarms = counts["declared-free"] + counts.redundant;

  const enough = resolved >= MIN_SAMPLE;
  const withheld = enough
    ? null
    : `insufficient sample: ${String(resolved)} resolved, need ${String(MIN_SAMPLE)} — ` +
      `a ratio over this few findings describes the findings, not the runner`;

  const allFreedoms = ledgers.flatMap((l) => l.freedoms);
  const declaredSuperseded = allFreedoms.filter((f) => f.supersededAt !== undefined).length;

  return {
    counts,
    resolved,
    falseAlarms,
    falseAlarmRate: enough ? falseAlarms / resolved : null,
    withheld,
    // Revision rate is withheld on the same principle, against its own denominator.
    revisionRate: allFreedoms.length >= MIN_SAMPLE ? declaredSuperseded / allFreedoms.length : null,
    declaredTotal: allFreedoms.length,
    declaredSuperseded,
    frontier: escapeProfile(entries),
    coverage: "resolutions-only",
    slamComparable: false,
  };
}

/** A transcript line is only usable if it carries the two fields the readout reads. */
function isTranscriptEntry(value: unknown): value is TranscriptEntry {
  if (value === null || typeof value !== "object") return false;
  const action = (value as { action?: unknown }).action;
  if (action === null || typeof action !== "object") return false;
  return typeof (action as { kind?: unknown }).kind === "string";
}

/** Every declarer that keeps a transcript. Missing directory is empty, never an error. */
export function transcriptDeclarers(root: string): readonly string[] {
  try {
    return readdirSync(join(root, TRANSCRIPT_DIR))
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.slice(0, -".jsonl".length))
      .sort();
  } catch {
    return [];
  }
}

/** Read every declarer's transcript and ledger and fold them into one readout. */
export function readFalseAlarmReadout(root: string): FalseAlarmReadout {
  const entries = transcriptDeclarers(root)
    .flatMap((d) => readTranscript(root, d))
    .filter(isTranscriptEntry);
  return falseAlarmReadout(entries, loadAllLedgers(root));
}

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

export function formatReadout(r: FalseAlarmReadout): string {
  const lines = [
    `[false-alarm] resolutions recorded: ${String(r.resolved)}`,
    `  real gap (write-test):        ${String(r.counts["real-gap"])}`,
    `  false alarm (declared free):  ${String(r.counts["declared-free"])}`,
    `  false alarm (redundant):      ${String(r.counts.redundant)}`,
    `  deferred (excluded):          ${String(r.counts.deferred)}`,
    `  revisions (supersede):        ${String(r.counts.revision)}`,
    `  frontier: ${String(r.frontier.intoDefined)} into defined, ${String(r.frontier.intoUndefined)} into undefined`,
    r.falseAlarmRate === null
      ? `  false-alarm rate: WITHHELD — ${r.withheld ?? ""}`
      : `  false-alarm rate: ${pct(r.falseAlarmRate)} (SLAM2 shipped a gate at <4%)`,
    r.revisionRate === null
      ? `  revision rate:    WITHHELD — ${String(r.declaredSuperseded)}/${String(r.declaredTotal)} declared entries superseded`
      : `  revision rate:    ${pct(r.revisionRate)} of declared freedoms later superseded`,
    ``,
    `  NOT SLAM-COMPARABLE. This is false/RESOLVED, not false/REPORTED: a finding fixed by opening`,
    `  a PR leaves no transcript entry, and the heartbeat never stages db/, so per-tick findings are`,
    `  not recorded anywhere. Resolution is voluntary, so this sample is biased by construction.`,
  ];
  return lines.join("\n");
}

const invokedDirectly =
  typeof process.argv[1] === "string" && /mutation-false-alarm-rate\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const i = process.argv.indexOf("--repo-root");
  const root = i >= 0 ? (process.argv[i + 1] ?? process.cwd()) : process.cwd();
  const readout = readFalseAlarmReadout(root);
  if (process.argv.includes("--json")) console.log(JSON.stringify(readout, null, 2));
  else console.log(formatReadout(readout));
}
