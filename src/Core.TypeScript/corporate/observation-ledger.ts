/**
 * observation-ledger.ts — one name for "nobody looked", and a place it is counted.
 *
 * ── THE DEFECT THIS EXISTS TO MAKE VISIBLE ───────────────────────────────────
 * Nine modules in this register independently invented the same distinction and gave it nine
 * names: `notChecked` (reconciliation, lag-detection), `not_recorded` (handoff-brief), `degraded`
 * and its omissions (context-pack), `UNDERIVED_EDGE_KINDS` (org-graph), `unresolved` (providers),
 * `configuredNotCalled` (observe-act-window), `notChecked` again in budget, and the `unknown`
 * fidelity.
 *
 * Each was right locally. Together they were the register's own blind spot, because the ONE
 * question an organization cannot answer from inside — *how much of this report is silence?* —
 * had to be asked nine times, in nine vocabularies, by somebody who already knew all nine existed.
 *
 * The defect is always the same shape:
 *
 *   > **A thing nobody looked at, rendered identically to a thing looked at and found clean.**
 *
 * A report of a healthy organization and a report of an unobserved one are the same document. That
 * is not a reporting inconvenience; it is the failure mode that makes every other detector in this
 * register optional without anyone deciding to make it optional.
 *
 * ── THREE STATES, AND THE THIRD IS THE ONE NOBODY BUILDS ─────────────────────
 * Most systems that get this right have two states — checked and not-checked. This has three,
 * because there is a difference between *a detector that was not given its inputs* and *a question
 * nothing in the system can answer at all*:
 *
 *   - `observed`      — a detector ran. Findings may be empty, and empty MEANS clean.
 *   - `not_run`       — a detector exists and was not supplied what it needs.
 *   - `no_detector`   — nothing here can answer this question. The honest bottom.
 *
 * The third is what `UNDERIVED_EDGE_KINDS` was reaching for and what nothing else had: a gap in
 * the SYSTEM rather than in this run. `not_run` is fixed by wiring; `no_detector` is fixed by
 * building something, and conflating them makes the second look like the first forever.
 *
 * ── COMPLETENESS IS DERIVED ──────────────────────────────────────────────────
 * Nothing may declare its own coverage. `completeness` is a count over the entries, so a caller
 * cannot hand back a ledger claiming a sweep it did not perform — the same rule this register
 * applies to fidelity, replayability and the context pack's `degraded`.
 */

/** Whether a question about the organization was actually answered. */
export const ObservationState = {
  /** A detector ran. `findings` may be empty, and empty means CLEAN. */
  Observed: "observed",
  /** A detector exists and was not given what it needs. Fixed by wiring. */
  NotRun: "not_run",
  /** Nothing in this system can answer this question. Fixed by building something. */
  NoDetector: "no_detector",
} as const;

export type ObservationState = (typeof ObservationState)[keyof typeof ObservationState];

/**
 * One question, and what is known about the answer.
 *
 * `subject` is the module or area asking; `question` is what it asks. Both are free strings,
 * because this ledger must be able to record a question from a module it has never heard of —
 * a registry that only accepts known questions cannot record the arrival of an unknown gap.
 */
export interface Observation {
  readonly subject: string;
  readonly question: string;
  readonly state: ObservationState;
  /**
   * How many things the detector found. `0` with `observed` is CLEAN; `0` with anything else is
   * NOT A FINDING AT ALL, which is the distinction this whole module exists for.
   */
  readonly findings: number;
  /** Why it did not run, or what would have to be built. Required for the two silent states. */
  readonly why?: string;
}

export interface ObservationLedger {
  readonly entries: readonly Observation[];
  /** Questions actually answered. */
  readonly observed: number;
  /** Questions with a detector that did not run. */
  readonly notRun: number;
  /** Questions nothing here can answer. */
  readonly noDetector: number;
  /** Total findings across everything that DID run. */
  readonly findings: number;
  /**
   * DERIVED: the fraction of questions that were actually answered, `0` when there are none.
   *
   * Never declared. A caller cannot hand back a ledger claiming a sweep it did not perform, which
   * is the same rule applied to fidelity, replayability and the context pack's `degraded`.
   */
  readonly completeness: number;
  readonly summary: string;
}

export type LedgerResult =
  | { readonly ok: true; readonly ledger: ObservationLedger }
  | { readonly ok: false; readonly reason: string };

/**
 * Fold observations into a ledger.
 *
 * REFUSES a silent entry with no reason. `not_run` and `no_detector` are the two states whose whole
 * value is the explanation — "we did not look" with no why is the original defect wearing this
 * module's clothes, and accepting it here would make the ledger the ninth silent thing rather than
 * the end of them.
 *
 * Also refuses findings on a state that did not run: a detector that did not execute cannot have
 * found anything, and a number there would be read as a measurement.
 */
export function foldObservations(entries: readonly Observation[]): LedgerResult {
  for (const e of entries) {
    if (e.state !== ObservationState.Observed) {
      if ((e.why ?? "").trim() === "") {
        return { ok: false, reason: `'${e.subject}/${e.question}' is ${e.state} with no stated reason` };
      }
      if (e.findings !== 0) {
        return {
          ok: false,
          reason: `'${e.subject}/${e.question}' is ${e.state} and reports ${String(e.findings)} finding(s); a detector that did not run found nothing`,
        };
      }
    }
    if (e.findings < 0 || !Number.isInteger(e.findings)) {
      return { ok: false, reason: `'${e.subject}/${e.question}' reports ${String(e.findings)} findings, which is not a count` };
    }
  }

  const ordered = ordinal(entries);
  const observed = ordered.filter((e) => e.state === ObservationState.Observed).length;
  const notRun = ordered.filter((e) => e.state === ObservationState.NotRun).length;
  const noDetector = ordered.filter((e) => e.state === ObservationState.NoDetector).length;
  const findings = ordered.reduce((n, e) => n + e.findings, 0);

  return {
    ok: true,
    ledger: {
      entries: ordered,
      observed,
      notRun,
      noDetector,
      findings,
      completeness: ordered.length === 0 ? 0 : observed / ordered.length,
      summary:
        `${String(observed)} of ${String(ordered.length)} question(s) answered` +
        ` (${String(notRun)} not run, ${String(noDetector)} with no detector);` +
        ` ${String(findings)} finding(s)`,
    },
  };
}

/**
 * Everything the organization did NOT look at.
 *
 * The list a reader of a clean report has to see before believing it. `blindSpots(ledger)` being
 * empty is the only thing that makes `findings === 0` mean what it looks like it means.
 */
export function blindSpots(ledger: ObservationLedger): readonly Observation[] {
  return ledger.entries.filter((e) => e.state !== ObservationState.Observed);
}

/**
 * Is this report safe to read as a statement about the organization?
 *
 * TRUE only when everything was observed. Deliberately NOT "no findings": a ledger with findings
 * and no blind spots is a trustworthy report of problems, and a ledger with no findings and eleven
 * blind spots is not a report at all.
 */
export function fullyObserved(ledger: ObservationLedger): boolean {
  return ledger.entries.length > 0 && blindSpots(ledger).length === 0;
}

/**
 * The questions nothing here can answer — gaps in the SYSTEM, not in the run.
 *
 * Separated because the remedy differs: `not_run` is fixed by wiring an input, `no_detector` by
 * building something that did not exist. A backlog that mixes them cannot be prioritised.
 */
export function missingDetectors(ledger: ObservationLedger): readonly Observation[] {
  return ledger.entries.filter((e) => e.state === ObservationState.NoDetector);
}

/** ORDINAL by subject then question, so two runs over one organization compare line for line. */
function ordinal(entries: readonly Observation[]): readonly Observation[] {
  return [...entries].sort((a, b) => {
    if (a.subject !== b.subject) return a.subject < b.subject ? -1 : 1;
    if (a.question === b.question) return 0;
    return a.question < b.question ? -1 : 1;
  });
}
