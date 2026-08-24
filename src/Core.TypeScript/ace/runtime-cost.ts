// runtime-cost.ts — how ace picks the runtime it will install itself onto.
//
// THE THESIS. ace is "the package manager of package managers". What distinguishes it
// from an installer with a preference list is that it does not HAVE a preference list:
// the install order is the OUTPUT of a declared cost model, computed against the host it
// is actually standing on. A ladder written down is a guess; a ladder computed is an
// argument you can check.
//
// THE ONE DISTINCTION THIS FILE EXISTS TO PRESERVE (Aaron 2026-08-24):
//
//     "dotnet has a huge enablement on every os is a qualia over time not a fact"
//
// So the model carries TWO quantities and REFUSES to fuse them into one score:
//
//   * COST is a FACT.    Bytes added to this host. Measured, dated, attributed to a
//                        method, or explicitly `unmetered`. Never estimated inline.
//   * ENABLEMENT is a QUALIA. "Installing .NET unlocks a lot" is a judgment about future
//                        usefulness, held by a named observer, true-ish at a date, and
//                        revisable. It is not discoverable by inspecting a host, and it
//                        is different in 2020, 2026 and 2030.
//
// A single blended number would hide which half is evidence and which is opinion. That is
// the exact defect `.claude/rules/toy-is-free-metered-must-be-earned.md` names: a quantity
// that was not measured must never render like one that was. So `rank()` below returns an
// ordering that is EXPLICITLY CONDITIONAL on an enablement weight, and `sensitivity()`
// reports how far that judgment must move before the order changes. A peer may then
// dispute the judgment without disputing the byte counts.
//
// WHY THE ORDER IS A TRUST ORDER, NOT A SIZE ORDER. Source you recompile is source you can
// verify; a prebuilt binary is bytes you must trust. Preferring recompilation means the
// default path yields an artifact the user derived themselves — supply-chain control, not
// footprint golf. Size is the tiebreak, not the criterion.
//
// Register: the byte costs quoted in `CANDIDATES` are `metered` where a measurement is
// cited and `unmetered` otherwise. Every enablement figure is `unmetered-by-nature` — not
// "not measured yet", but not the kind of thing that gets measured at all.

/**
 * Three-state probe result. Reuses the repo's existing evidence vocabulary
 * (`federated-identity/ports.ts` `RootEvidenceState`) rather than coining a new one.
 *
 * `indeterminate` is the load-bearing member: THE CHECK DID NOT RUN. It must never
 * collapse into `absent`, because "no toolchain here" and "I could not tell" license
 * different actions — the first is a reportable fact, the second is a broken probe.
 */
export type ProbeState = "present" | "absent" | "indeterminate";

/** What a host looks like to the chooser: toolchain id -> probe result. */
export type HostProfile = Readonly<Record<string, ProbeState>>;

/** A measured quantity, or an honest admission that it was not measured. */
export type MeasuredCost =
  | {
      readonly register: "metered";
      /** Bytes ADDED to this host. Not the artifact's absolute size where they differ. */
      readonly addedBytes: number;
      /** How the number was obtained — a claim with no method is a claim with no check. */
      readonly method: string;
      readonly measuredOn: string;
      readonly measuredAt: string;
    }
  | {
      readonly register: "unmetered";
      /** Why there is no number. Naming the gap is the point. */
      readonly reason: string;
    };

/**
 * A judgment about what an install unlocks BEYOND running ace.
 *
 * Attributed and dated because it is contestable by construction. `score` is an ordinal
 * position on [0,1], never a measurement — see the file header.
 */
export interface EnablementJudgment {
  readonly score: number;
  readonly by: string;
  readonly on: string;
  readonly rationale: string;
  readonly register: "unmetered-by-nature";
}

/**
 * What the user must take on faith to use this rung. Lower `rank` = more verifiable.
 * This is the primary ordering criterion; cost and enablement are tiebreaks under it.
 */
export interface TrustSurface {
  readonly rank: number;
  readonly mustTrust: readonly string[];
  /** True when the artifact is produced ON the host from committed source. */
  readonly derivedByUser: boolean;
}

/** Whether this rung actually works today — measured, not hoped. */
export type Buildable =
  | { readonly state: "yes"; readonly evidence: string }
  | { readonly state: "no"; readonly blocker: string }
  | { readonly state: "unproven"; readonly whatWouldProveIt: string };

export interface RuntimeCandidate {
  readonly id: string;
  /** Toolchains that must probe `present` for this rung to be viable. */
  readonly requires: readonly string[];
  readonly cost: MeasuredCost;
  readonly enablement: EnablementJudgment;
  readonly trust: TrustSurface;
  readonly buildable: Buildable;
}

/** A rung considered, with why it was or was not eligible. Reported for ALL rungs. */
export interface RungReport {
  readonly id: string;
  readonly viable: boolean;
  /** Toolchains this rung needs that are not `present` on the host. */
  readonly missing: readonly string[];
  /** Toolchains whose probe DID NOT RUN. Non-empty here means the answer is provisional. */
  readonly indeterminate: readonly string[];
  readonly cost: MeasuredCost;
  readonly enablement: EnablementJudgment;
  readonly trust: TrustSurface;
  readonly buildable: Buildable;
}

/**
 * The chooser's answer. `toolchain-missing` is a FIRST-CLASS outcome, not a way-station:
 * an installer that silently slides from "cannot compile here" to "here is a binary" has
 * papered over the finding the user most needed.
 */
export type Selection =
  | { readonly kind: "selected"; readonly candidate: RuntimeCandidate; readonly rungs: readonly RungReport[] }
  | { readonly kind: "toolchain-missing"; readonly missing: readonly string[]; readonly rungs: readonly RungReport[] }
  | { readonly kind: "indeterminate"; readonly unprobed: readonly string[]; readonly rungs: readonly RungReport[] };

/** A rung is viable when every toolchain it requires probed `present`. */
export function viability(
  c: RuntimeCandidate,
  host: HostProfile,
): {
  viable: boolean;
  missing: readonly string[];
  indeterminate: readonly string[];
} {
  const missing: string[] = [];
  const indeterminate: string[] = [];
  for (const need of c.requires) {
    // An unprobed toolchain is NOT an absent one. Defaulting to "absent" here would be
    // the check-that-did-not-run wearing a result.
    const state: ProbeState = host[need] ?? "indeterminate";
    if (state === "absent") missing.push(need);
    else if (state === "indeterminate") indeterminate.push(need);
  }
  return { viable: missing.length === 0 && indeterminate.length === 0, missing, indeterminate };
}

/**
 * Order viable rungs. EXPLICITLY CONDITIONAL on `enablementWeight` — the caller supplies
 * how much it believes the qualia half, and the ordering is a function of that belief.
 *
 * Trust rank dominates: a more-verifiable rung is never displaced by a cheaper one. Within
 * equal trust, rungs compare on (enablementWeight * enablement) - (1 - enablementWeight) *
 * normalisedCost. `unmetered` cost sorts LAST within its trust band rather than being given
 * an invented number — an unmeasured rung must not win on a number nobody produced.
 */
export function rank(
  candidates: readonly RuntimeCandidate[],
  host: HostProfile,
  enablementWeight: number,
): readonly RuntimeCandidate[] {
  const viable = candidates.filter((c) => viability(c, host).viable && c.buildable.state !== "no");
  const metered = viable.filter((c) => c.cost.register === "metered");
  const maxBytes = Math.max(1, ...metered.map((c) => (c.cost.register === "metered" ? c.cost.addedBytes : 0)));
  const score = (c: RuntimeCandidate): number => {
    if (c.cost.register !== "metered") return Number.NEGATIVE_INFINITY;
    const normCost = c.cost.addedBytes / maxBytes;
    return enablementWeight * c.enablement.score - (1 - enablementWeight) * normCost;
  };
  return [...viable].sort((a, b) => {
    if (a.trust.rank !== b.trust.rank) return a.trust.rank - b.trust.rank;
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Full report over every rung — the audit trail, not just the winner. */
export function report(candidates: readonly RuntimeCandidate[], host: HostProfile): readonly RungReport[] {
  return candidates.map((c) => {
    const v = viability(c, host);
    return {
      id: c.id,
      viable: v.viable && c.buildable.state !== "no",
      missing: v.missing,
      indeterminate: v.indeterminate,
      cost: c.cost,
      enablement: c.enablement,
      trust: c.trust,
      buildable: c.buildable,
    };
  });
}

/**
 * Pick a rung, or report the gap. Never invents a fallback: if nothing is viable the
 * answer is `toolchain-missing` with the union of what was missing, which is rung 2 of
 * Aaron's ladder made into a return value rather than a log line.
 */
export function choose(
  candidates: readonly RuntimeCandidate[],
  host: HostProfile,
  enablementWeight: number,
): Selection {
  const rungs = report(candidates, host);
  const ordered = rank(candidates, host, enablementWeight);
  if (ordered.length > 0) return { kind: "selected", candidate: ordered[0]!, rungs };
  // Nothing viable. Distinguish "we know there is no toolchain" from "we could not look".
  const anyProbed = rungs.some((r) => r.missing.length > 0);
  if (!anyProbed) {
    const unprobed = [...new Set(rungs.flatMap((r) => r.indeterminate))].sort();
    if (unprobed.length > 0) return { kind: "indeterminate", unprobed, rungs };
  }
  const missing = [...new Set(rungs.flatMap((r) => r.missing))].sort();
  return { kind: "toolchain-missing", missing, rungs };
}

/**
 * How far must the enablement judgment move before the winner changes?
 *
 * This is the honest test the model owes its reader. If the ladder survives a wide band of
 * judgments it is robust; if it flips under a nudge, that fragility IS the finding. Scans
 * [0,1] and returns the weights at which the top rung changes.
 */
export function sensitivity(
  candidates: readonly RuntimeCandidate[],
  host: HostProfile,
  steps = 101,
): readonly { readonly weight: number; readonly winner: string }[] {
  const out: { weight: number; winner: string }[] = [];
  let prev: string | null = null;
  for (let i = 0; i < steps; i++) {
    const w = i / (steps - 1);
    const top = rank(candidates, host, w)[0]?.id ?? "(none)";
    if (top !== prev) out.push({ weight: w, winner: top });
    prev = top;
  }
  return out;
}
