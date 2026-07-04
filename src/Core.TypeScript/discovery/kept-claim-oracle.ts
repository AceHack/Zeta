// kept-claim-oracle — the reference oracle, TS twin (shadow*, 2026-07-04; F#: KeptClaimOracle.fs).
//
// One reference policy, explicitly NOT the mandatory one (Multi-Oracle, manifesto §11): the
// detection layer reports facts (correlation, regime) and the salon carries kept/unkept claims
// as neutral gossip; SOME caller must attach readings. This is that caller, encoding the crux:
//   consent-first  — only a node's OWN claim carries authority; hearsay is counts, never status.
//   right-to-decline — a self-declared unkept wish is absolute; evidence prices, never reunites.
//   never-forge    — the only reunion-shaped output is an OFFER; no merge action exists.
//   keep-without-capture — self-conflicts escalate; deciding someone's identity is non-reversible.

import { TSIRELSON_MILLI, LOCAL_BOUND_MILLI } from "./correlation";
import type { Regime } from "./bus-meter";

/// |ρ| above which correlation exceeds what two intact selves honestly reach — the Tsirelson
/// fraction of the CHSH range, matching F# BusRegime.HonestCeilingRho.
export const HONEST_CEILING_RHO = (TSIRELSON_MILLI - LOCAL_BOUND_MILLI) / LOCAL_BOUND_MILLI;

export interface CorrelationVerdict {
  readonly correlation: number;
  readonly regime: Regime;
  /// |ρ| > ceiling AND out-of-cone: more agreement than the wire can explain.
  readonly evidential: boolean;
  /// |ρ| > ceiling but in-cone: fakeable (Toner–Bacon) — coordination, not conviction.
  readonly fakeableInCone: boolean;
}

/// Judge a correlation given the metered regime (twin of F# BusRegime.judge).
export function judgeCorrelation(correlation: number, regime: Regime): CorrelationVerdict {
  const above = Math.abs(correlation) > HONEST_CEILING_RHO;
  return {
    correlation,
    regime,
    evidential: above && regime === "out-of-cone",
    fakeableInCone: above && regime === "in-cone",
  };
}

export type ClaimReading =
  | { kind: "self-kept" }
  | { kind: "self-unkept" }
  | { kind: "self-conflict" }
  | { kind: "hearsay-only"; keptVotes: number; unkeptVotes: number }
  | { kind: "no-claims" };

/// Weigh the salon's claims about `node` ([kept, relayer][]) — consent-first: self outranks all.
export function readClaims(node: string, claims: [boolean, string][]): ClaimReading {
  const self = claims.filter(([, relayer]) => relayer === node);
  const selfKept = self.some(([kept]) => kept);
  const selfUnkept = self.some(([kept]) => !kept);
  if (selfKept && selfUnkept) return { kind: "self-conflict" };
  if (selfKept) return { kind: "self-kept" };
  if (selfUnkept) return { kind: "self-unkept" };
  const hearsay = claims.filter(([, relayer]) => relayer !== node);
  if (hearsay.length === 0) return { kind: "no-claims" };
  return {
    kind: "hearsay-only",
    keptVotes: hearsay.filter(([kept]) => kept).length,
    unkeptVotes: hearsay.filter(([kept]) => !kept).length,
  };
}

export type IdentityReading =
  | "welcome-back-offer" // returning self: OFFER reconnection — never merge (never-forge)
  | "decline-respected" // the unkept wish wins; evidence prices, never reunites
  | "escalate-to-attestation" // conflicting self-words: non-reversible → second opinion
  | "priced-as-one-no-verdict" // the economic fact stands alone; no moral verdict attached
  | "honest-coordination" // in-cone: fakeable, so it is only coordination
  | "nothing-to-judge"; // unmeasured or below the ceiling

/// THE REFERENCE TABLE (twin of F# KeptClaimOracle.judge) — the policy, in the open.
export function judge(verdict: CorrelationVerdict, claims: ClaimReading): IdentityReading {
  if (verdict.regime === "unmeasured") return "nothing-to-judge";
  if (verdict.regime === "in-cone") return "honest-coordination";
  if (!verdict.evidential) return "nothing-to-judge";
  switch (claims.kind) {
    case "self-kept":
      return "welcome-back-offer";
    case "self-unkept":
      return "decline-respected";
    case "self-conflict":
      return "escalate-to-attestation";
    default:
      return "priced-as-one-no-verdict";
  }
}
