/**
 * tick-dial.ts — the agent-control OPTIMIZATION axes as a closed discriminated union.
 *
 * Design doc:
 *   docs/research/2026-08-15-the-dial-axis-agent-control-optimization-is-a-closed-du-disjoint-from-the-gate.md
 *
 * ══ What kind of dispatch this is ══════════════════════════════════════════════
 *
 * The repo now carries three layers of capability dispatch, and they differ by
 * WHAT HAPPENS WHEN YOU PICK WRONG:
 *
 *   codegen over source types      soundness gate  → wrong bytes; Merkle roots diverge
 *   target-native emission (#10774) preference     → still byte-locks, just unidiomatic
 *   agent control (this module)    optimization    → scores worse; nothing breaks
 *
 * This module is the THIRD kind. Saying so is load-bearing: an "optimization"
 * that could break something is a gate wearing the wrong hat, and a "gate" that
 * cannot fail is the vacuity class.
 *
 * ══ Kind is orthogonal to layer — the agent layer already HAS a gate ═══════════
 *
 * `workflow-engine/types.ts` already ships `ActionGate`, `ActionClass` and
 * `ReviewLevel` with a `determineReviewLevel` discriminator. Those are the
 * agent layer's SOUNDNESS GATE: they decide what may land and who must review
 * it. They are not tunable, and an optimizer permitted to turn them would
 * "improve its score" by lowering the review bar — reward hacking aimed
 * squarely at the guardrail.
 *
 * So the central invariant of this module is DISJOINTNESS:
 *
 *     no TickDial may name anything the gate DUs govern.
 *
 * `GATE_OWNED` below is that boundary, made checkable. It is enforced by
 * `proposeDial`, which REFUSES rather than silently accepting.
 *
 * ══ Vacuity ═══════════════════════════════════════════════════════════════════
 *
 * PR #10774 established the rule for this family: "dispatch with exactly one
 * applicable method is not dispatch." Applied here: AN AXIS WITH ONE CANDIDATE
 * IS NOT AN AXIS. Most dials in this repo have exactly one realised candidate
 * today, so `proposeDial` refuses them with `single-candidate`. That refusal is
 * the honest state of the world, not a defect — and it means this framework is
 * TOY until a dial acquires a second candidate and a measured trajectory
 * difference. (`.claude/rules/toy-is-free-metered-must-be-earned.md`.)
 */

// ══ The closed set ═════════════════════════════════════════════════════════════

/**
 * The agent-control optimization axes. CLOSED: adding a member is a compile
 * error at every exhaustive site, which is the property that makes it safe to
 * close over in more than one consumer.
 *
 * Names are ours. Five of the eight sit inside the shipped OPLE decomposition
 * (Observe / Persist / Limit / Emit — `.claude/rules.bak/ople-primitives-*.md`);
 * three do not, because they configure the loop rather than run inside it.
 */
export type TickDial =
  /** What is resident at wake: rules, CLAUDE.md, agent front-matter. Pre-loop. */
  | "framing"
  /** Which hat/skill is active for this run. Pre-loop. The one axis with a measured history. */
  | "hat"
  /** Which tool a request goes to, and by which path. OPLE: Emit. */
  | "routing"
  /** What is written to and read back from memory. OPLE: Persist + Observe. */
  | "recall"
  /** What is assembled into a single call's context window. OPLE: Observe. */
  | "context"
  /** Pacing: retry counts, delegation fan-out, stopping. OPLE: Emit. */
  | "cadence"
  /** WHICH checks run (linters, tests, reviewer ensemble). NOT the objective itself. */
  | "verification"
  /** Token and compute spend. OPLE: Limit. Explicitly NOT permissions or safety. */
  | "budget";

/**
 * The registry. `satisfies` pins every entry to a real variant; `_NoneMissing`
 * below pins the converse. Together they make the array and the union one thing:
 * add a variant to `TickDial` without adding it here and the file fails to compile.
 */
export const TICK_DIALS = [
  "framing",
  "hat",
  "routing",
  "recall",
  "context",
  "cadence",
  "verification",
  "budget",
] as const satisfies readonly TickDial[];

/** Compile-time proof that TICK_DIALS covers TickDial. Never evaluated. */
type _Missing = Exclude<TickDial, (typeof TICK_DIALS)[number]>;
export type _NoneMissing = _Missing extends never ? true : ["TICK_DIALS is missing", _Missing];
const _noneMissing: _NoneMissing = true;
void _noneMissing;

/** Exhaustiveness helper for `switch` over TickDial. */
export function assertNever(x: never, context: string): never {
  throw new Error(`${context}: unhandled variant ${JSON.stringify(x)}`);
}

// ══ The gate boundary — what a dial may never name ═════════════════════════════

/**
 * Concerns owned by the agent layer's SOUNDNESS GATE, not by any dial.
 *
 * Each entry names the shipped surface that owns it. A proposal touching one of
 * these is refused — the optimizer is not permitted to optimize its own
 * guardrail. This list is the disjointness invariant in data form so a test can
 * check it rather than a reviewer having to remember it.
 */
export const GATE_OWNED: Readonly<Record<string, string>> = {
  "review-level": "workflow-engine/types.ts ReviewLevel",
  "action-gate": "workflow-engine/types.ts ActionGate",
  "action-class": "workflow-engine/types.ts ActionClass",
  permissions: ".claude/rules/mechanical-authorization-check.md",
  safety: ".claude/rules/methodology-hard-limits.md",
  authorization: ".claude/rules/no-directives.md (gated classes)",
  "hard-limits": ".claude/rules/methodology-hard-limits.md",
};

/** The objective function is not an axis of its own optimization. */
export const OBJECTIVE_OWNED = "trajectory-score" as const;

// ══ Propose / apply / score / settle — four separable operations (R5) ══════════

/** A proposed change to exactly one dial. `from`/`to` are opaque to this layer. */
export interface DialProposal {
  readonly dial: TickDial;
  readonly from: string;
  readonly to: string;
  /**
   * Every candidate the proposer believes this dial can take, INCLUDING `from`.
   * Supplied by the proposer, checked here: fewer than two and the axis is not
   * an axis. This is the vacuity guard, typed.
   */
  readonly candidates: readonly string[];
  /** Concerns this proposal would touch. Checked against GATE_OWNED. */
  readonly touches: readonly string[];
}

/** Why a proposal was refused. Closed. */
export type DialRefusal =
  /** The proposal reaches into the gate. The disjointness invariant. */
  | { readonly kind: "gate-owned"; readonly concern: string; readonly owner: string }
  /** Fewer than two realised candidates — not an axis. */
  | { readonly kind: "single-candidate"; readonly candidateCount: number }
  /** The proposal would grade itself. */
  | { readonly kind: "self-scoring" };

/**
 * The outcome channel. Same shape as `ferry-throttler/mux-transport-bridge.ts`'s
 * `BatchAck` — a closed `kind`-tagged union of readonly records — because that
 * IS the repo's feedback-corner idiom and the OPLE `T, TFeedback` requirement.
 */
export type DialOutcome =
  | { readonly kind: "accepted"; readonly dial: TickDial; readonly runId: string }
  | { readonly kind: "refused"; readonly dial: TickDial; readonly reason: DialRefusal }
  | { readonly kind: "reverted"; readonly dial: TickDial; readonly runId: string };

/**
 * PROPOSE — the only operation implemented here, because it is the only one whose
 * behaviour is decidable without a running agent. Apply / score / settle need a
 * trajectory and a ledger; their signatures are declared below and left unbuilt
 * rather than stubbed into something that cannot fail.
 *
 * Returns a refusal, or `undefined` when the proposal is admissible.
 */
export function proposeDial(p: DialProposal): DialRefusal | undefined {
  for (const concern of p.touches) {
    if (concern === OBJECTIVE_OWNED) return { kind: "self-scoring" };
    const owner = GATE_OWNED[concern];
    if (owner !== undefined) return { kind: "gate-owned", concern, owner };
  }
  const distinct = new Set(p.candidates).size;
  if (distinct < 2) return { kind: "single-candidate", candidateCount: distinct };
  return undefined;
}

/**
 * Scale-free across arity (R6, manifesto §1): one dial and all eight take the
 * SAME path, differing only by the length of the array — the DoP knob shape from
 * `.claude/rules/async-all-the-way-truthful-signatures.md`, not a second code path.
 */
export function proposeDials(
  ps: readonly DialProposal[],
): ReadonlyArray<{ readonly proposal: DialProposal; readonly refusal: DialRefusal | undefined }> {
  return ps.map((proposal) => ({ proposal, refusal: proposeDial(proposal) }));
}

// ══ Declared, not built ════════════════════════════════════════════════════════

/**
 * The remaining three of R5's four operations. Declared as types so the seam is
 * legible and so a future implementation has a shape to satisfy; NOT implemented,
 * because there is no trajectory runner in the tree (the three
 * `docs/research/harness-run-2026-04-20-*.md` runs were driven by hand).
 *
 * `applyDial` is where the ace Z-set delta shape belongs: a dial change is a +1
 * delta and its revert is the -1 retraction, which is what "reversible without
 * residue" means here — `ace-cli.ts applyDelta` already deletes the key when the
 * weight returns to zero.
 */
export type ApplyDial = (p: DialProposal) => Promise<DialOutcome>;

/**
 * Scores a WHOLE RUN (R4), never a step. The `correlation` argument is not
 * optional and not cosmetic: repeated runs of one agent are correlated, so N
 * runs are not N observations. See `effectiveTrialCount` in
 * `src/Core/SocietyUsefulWork.fs`.
 *
 * For a MEASURED value of `correlation` rather than a guessed one:
 * `src/Core.TypeScript/society/effective-agent-count.ts` estimates inter-agent
 * rho over `db/mutation-findings/` (ICC(1,1), rho = 0.40 at time of writing,
 * so 3 agents are worth 1.67). That number is **backward-looking over that
 * corpus** and is not a prior for a trajectory run — take the method, not the
 * constant.
 */
export type ScoreTrajectory = (runId: string, correlation: number) => Promise<number>;

/** Accept or revert. Separate from scoring so a worse score can be undone. */
export type SettleDial = (runId: string, accept: boolean) => Promise<DialOutcome>;
