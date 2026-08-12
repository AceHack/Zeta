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
 * ══ THE DENOMINATOR, AND WHY IT USED TO BE UNCOMPUTABLE ══
 *
 * SLAM's rate is false-alarms / ALL REPORTS. The first version of this module could not compute
 * that, and the reason was structural rather than an oversight:
 *
 *   - the runner recorded a transcript entry only under `--choose`, so a finding fixed by opening
 *     a PR — how every resolution actually landed — left NO entry;
 *   - `agent-heartbeat.yml` never staged `db/`, so a write from a CI tick landed in a checkout that
 *     was thrown away.
 *
 * So it computed false / RESOLVED, and resolution is VOLUNTARY — a biased sample, since whoever
 * bothers to record a cell is not a random draw. The measured consequence was stark: 2 resolutions,
 * both false alarms, ZERO real gaps, in a session where four real gaps were found and fixed by PR.
 *
 * Both halves are now closed (Aaron 2026-08-12, "stage db/ in the heartbeat so findings get
 * recorded"): `mutation-findings.ts` records every observation per tick whatever the outcome, and
 * the heartbeat stages `db/`. `alarmsReported` is therefore the real population.
 *
 * WHAT STILL IS NOT AUTOMATIC. Recording the population does not make the resolved SUBSET
 * representative — an unresolved alarm is still an alarm nobody classified. So the rate is withheld
 * on TWO independent conditions, reported separately because they have different fixes:
 *
 *   MIN_SAMPLE   — too few resolutions for a ratio to mean anything. Fix: resolve more.
 *   MIN_COVERAGE — too small a slice of the alarm population. Fix: resolve a FAIRER slice.
 *
 * A ratio over five findings is noise, and a noisy number with a percent sign is worse than no
 * number: it gets quoted. `slamComparable` is a FIELD, true only when both conditions hold, because
 * a caveat that lives in a docstring gets separated from its number the first time it travels.
 */

import { escapeProfile, type TranscriptEntry } from "./mutation-readout";
import { loadAllLedgers, readTranscript, TRANSCRIPT_DIR, type DeclarerLedger } from "./mutation-freedoms";
import { alarmKeys, readAllFindings, type FindingRecord } from "./mutation-findings";
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
  /** Distinct dimensions ever reported INDISTINGUISHABLE — the alarms SLAM's rate is a fraction of. */
  readonly alarmsReported: number;
  /**
   * Resolved / reported. The honesty number: a rate computed over 3 of 200 alarms describes those
   * three. Low coverage is the bias the findings ledger exists to EXPOSE, not to hide.
   */
  readonly resolutionCoverage: number | null;
  readonly coverage: "resolutions-only" | "reports-recorded";
  /**
   * True only when the alarm population is recorded AND enough of it is resolved to be worth a
   * percentage. A field rather than a docstring note, because a caveat gets separated from its
   * number the first time someone quotes it.
   */
  readonly slamComparable: boolean;
}

/** Below this fraction of alarms resolved, a rate describes the resolvers rather than the runner. */
export const MIN_COVERAGE = 0.5;

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
  findings: readonly FindingRecord[] = [],
): FalseAlarmReadout {
  const counts: Record<ResolutionKind, number> = { ...EMPTY_COUNTS };
  for (const e of entries) counts[resolutionOf(e.action.kind)] += 1;

  const resolved = counts["real-gap"] + counts["declared-free"] + counts.redundant;
  const falseAlarms = counts["declared-free"] + counts.redundant;

  const alarmsReported = alarmKeys(findings).size;
  const resolutionCoverage = alarmsReported > 0 ? Math.min(1, resolved / alarmsReported) : null;

  const enoughSample = resolved >= MIN_SAMPLE;
  const enoughCoverage = resolutionCoverage !== null && resolutionCoverage >= MIN_COVERAGE;
  const enough = enoughSample && enoughCoverage;

  // Two independent reasons to withhold, and they are reported separately: "too few" and "too
  // unrepresentative" are different problems with different fixes — resolve more, versus resolve a
  // fairer slice. Collapsing them into one message would hide which one is biting.
  const reasons: string[] = [];
  if (!enoughSample) {
    reasons.push(
      `insufficient sample: ${String(resolved)} resolved, need ${String(MIN_SAMPLE)} — ` +
        `a ratio over this few findings describes the findings, not the runner`,
    );
  }
  if (!enoughCoverage) {
    reasons.push(
      resolutionCoverage === null
        ? `no alarms recorded yet, so there is no population to be a fraction of`
        : `insufficient coverage: ${String(resolved)} of ${String(alarmsReported)} alarms resolved ` +
          `(${(resolutionCoverage * 100).toFixed(0)}%, need ${String(MIN_COVERAGE * 100)}%) — ` +
          `resolution is voluntary, so a partial slice is biased by who bothered`,
    );
  }
  const withheld = enough ? null : reasons.join("; ");

  const allFreedoms = ledgers.flatMap((l) => l.freedoms);
  const declaredSuperseded = allFreedoms.filter((f) => f.supersededAt !== undefined).length;

  return {
    counts,
    resolved,
    falseAlarms,
    falseAlarmRate: enough ? falseAlarms / resolved : null,
    withheld,
    alarmsReported,
    resolutionCoverage,
    // Revision rate is withheld on the same principle, against its own denominator.
    revisionRate: allFreedoms.length >= MIN_SAMPLE ? declaredSuperseded / allFreedoms.length : null,
    declaredTotal: allFreedoms.length,
    declaredSuperseded,
    frontier: escapeProfile(entries),
    coverage: alarmsReported > 0 ? "reports-recorded" : "resolutions-only",
    slamComparable: enough,
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
  return falseAlarmReadout(entries, loadAllLedgers(root), readAllFindings(root));
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
    `  alarms reported (population): ${String(r.alarmsReported)}`,
    r.resolutionCoverage === null
      ? `  resolution coverage: no alarms recorded yet`
      : `  resolution coverage: ${pct(r.resolutionCoverage)} of alarms classified`,
    r.falseAlarmRate === null
      ? `  false-alarm rate: WITHHELD — ${r.withheld ?? ""}`
      : `  false-alarm rate: ${pct(r.falseAlarmRate)} (SLAM2 shipped a gate at <4%)`,
    r.revisionRate === null
      ? `  revision rate:    WITHHELD — ${String(r.declaredSuperseded)}/${String(r.declaredTotal)} declared entries superseded`
      : `  revision rate:    ${pct(r.revisionRate)} of declared freedoms later superseded`,
    ``,
    r.slamComparable
      ? `  SLAM-comparable: the alarm population is recorded and enough of it is classified.`
      : `  NOT SLAM-COMPARABLE yet. The population is ${r.coverage === "reports-recorded" ? "recorded" : "NOT recorded"},` +
        ` and an unresolved alarm is still an alarm nobody classified — so the resolved subset is not\n` +
        `  a fair sample of it. Resolution is voluntary; that bias does not go away by ignoring it.`,
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
